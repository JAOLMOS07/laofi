import {
  type AdminOverview,
  AvatarConfigSchema,
  type BuildingFloor,
  type CellInfo,
  ChangePasswordSchema,
  type DirectoryEntry,
  type Me,
  type NoteInfo,
  type QueuedKnock,
  RETENTION_DAYS,
  type Status,
  type VoiceToken,
  normalizeTeamsLink,
  parseAvatar,
  parseCurrentWork,
} from '@laofi/shared';
import type { FastifyInstance } from 'fastify';
import { AccessToken } from 'livekit-server-sdk';
import { z } from 'zod';
import { authProvider } from '../auth/AuthProvider.js';
import { hashPassword, temporaryPassword, verifyPassword } from '../auth/passwords.js';
import { signRoomToken, signSession } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { env, voiceEnabled } from '../env.js';
import { loadFloor } from '../floors.js';
import { assignOffice } from '../offices.js';
import { presence } from '../presence/PresenceService.js';
import { HttpError, SESSION_COOKIE, parse, requireAdmin, requireUser, setSession } from './http.js';

const DEFAULT_ACCENT = '#6b7f99';
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_FAILURES = 8;
/** Intentos fallidos por email. Está en memoria: basta para frenar a quien prueba contraseñas. */
const loginFailures = new Map<string, { count: number; until: number }>();

function loginBlocked(email: string): boolean {
  const f = loginFailures.get(email);
  if (f && f.until < Date.now()) loginFailures.delete(email);
  return (loginFailures.get(email)?.count ?? 0) >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(email: string): void {
  const f = loginFailures.get(email);
  loginFailures.set(email, { count: (f?.count ?? 0) + 1, until: Date.now() + LOGIN_WINDOW_MS });
}

const since = () => new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);

async function loadMe(id: string): Promise<Me> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id }, include: { cell: true, office: true } });
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    title: u.title,
    role: u.role,
    status: u.status,
    avatar: parseAvatar(u.avatarConfig),
    cell: u.cell ? { id: u.cell.id, name: u.cell.name, color: u.cell.color, floorId: u.cell.floorId } : null,
    cellType: u.cell?.type ?? null,
    currentWork: parseCurrentWork(u.currentWork),
    mustChangePassword: u.mustChangePassword,
    homeFloorId: u.office?.floorId ?? null,
  };
}

/** ¿Puede entrar a este piso? Los pisos cerrados son solo para su célula y los admins. */
function canEnter(
  floor: { isLocked: boolean; cell: { id: string } | null },
  user: { role: string; cellId: string | null },
): boolean {
  return !floor.isLocked || user.role === 'ADMIN' || floor.cell?.id === user.cellId;
}

/** Recarga las rooms abiertas de esos pisos (cambió una oficina, una sala o un link). */
async function reloadFloors(...ids: Array<string | null | undefined>): Promise<void> {
  for (const id of new Set(ids.filter((x): x is string => !!x))) await presence.floor(id)?.reloadStatic();
}

export function registerRoutes(app: FastifyInstance): void {
  // ------------------------------------------------------------ sesión
  app.post('/api/auth/login', async (req, reply) => {
    const body = parse(
      z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(200) }),
      req.body,
    );
    const email = body.email.trim().toLowerCase();
    if (loginBlocked(email))
      throw new HttpError(
        429,
        'Demasiados intentos. Espera unos minutos o pídele a un admin que la restablezca.',
      );
    const user = await authProvider.login(body);
    if (!user) {
      recordLoginFailure(email);
      throw new HttpError(401, 'Email o contraseña incorrectos.');
    }
    loginFailures.delete(email);
    setSession(reply, await signSession(user.id));
    return loadMe(user.id);
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/me', async (req) => loadMe((await requireUser(req, { allowPendingPassword: true })).id));

  app.post('/api/me/password', async (req) => {
    const u = await requireUser(req, { allowPendingPassword: true });
    const { current, next } = parse(ChangePasswordSchema, req.body);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    if (!(await verifyPassword(current, row.passwordHash)))
      throw new HttpError(400, 'La contraseña actual no es correcta.');
    if (current === next) throw new HttpError(400, 'La contraseña nueva tiene que ser distinta.');
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: await hashPassword(next), mustChangePassword: false },
    });
    return loadMe(u.id);
  });

  /** Token corto para entrar a la room de un piso. */
  app.post('/api/auth/room-token', async (req) => {
    const u = await requireUser(req);
    return { token: await signRoomToken(u.id) };
  });

  app.put('/api/me/avatar', async (req) => {
    const u = await requireUser(req);
    const avatar = parse(AvatarConfigSchema, req.body);
    await prisma.user.update({ where: { id: u.id }, data: { avatarConfig: avatar } });
    for (const h of presence.floorHandles()) h.setUserAvatar(u.id, JSON.stringify(avatar));
    return loadMe(u.id);
  });

  // ------------------------------------------------------------ edificio
  app.get('/api/building', async (req): Promise<{ floors: BuildingFloor[]; cells: CellInfo[] }> => {
    const u = await requireUser(req);
    const [floors, cells] = await Promise.all([
      prisma.floor.findMany({ orderBy: { level: 'asc' }, include: { cell: true } }),
      prisma.cell.findMany({ orderBy: { name: 'asc' } }),
    ]);
    const online = presence.all();
    return {
      floors: floors.map((f) => {
        const here = online.filter((p) => p.floorId === f.id);
        const busyRooms: Record<string, number> = {};
        for (const p of here) if (p.roomId) busyRooms[p.roomId] = (busyRooms[p.roomId] ?? 0) + 1;
        const cell = f.cell ? { id: f.cell.id, name: f.cell.name, color: f.cell.color } : null;
        return {
          id: f.id,
          name: f.name,
          level: f.level,
          isCommon: f.isCommon,
          isLocked: f.isLocked,
          cell,
          online: here.length,
          busyRooms,
          canEnter: canEnter({ isLocked: f.isLocked, cell }, u),
        };
      }),
      cells: cells.map((c) => ({ id: c.id, name: c.name, color: c.color, floorId: c.floorId })),
    };
  });

  app.get('/api/floors/:id', async (req) => {
    await requireUser(req);
    const { id } = req.params as { id: string };
    const floor = await loadFloor(id);
    if (!floor) throw new HttpError(404, 'Ese piso no existe.');
    return floor;
  });

  app.get('/api/directory', async (req): Promise<DirectoryEntry[]> => {
    await requireUser(req);
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      include: { cell: true, office: true },
    });
    return users.map((u) => {
      const p = presence.get(u.id);
      return {
        id: u.id,
        name: u.name,
        title: u.title,
        cell: u.cell ? { id: u.cell.id, name: u.cell.name, color: u.cell.color } : null,
        status: (p?.status ?? u.status) as Status,
        online: !!p,
        floorId: p?.floorId ?? null,
        roomId: p?.roomId ?? null,
        homeFloorId: u.office?.floorId ?? null,
        currentWork: parseCurrentWork(u.currentWork),
      };
    });
  });

  // ------------------------------------------------------------ post-its y toques
  app.get('/api/notes', async (req): Promise<NoteInfo[]> => {
    const u = await requireUser(req);
    const notes = await prisma.note.findMany({
      where: { toUserId: u.id, createdAt: { gte: since() } },
      orderBy: { createdAt: 'desc' },
      include: { from: true },
      take: 100,
    });
    return notes.map((n) => ({
      id: n.id,
      fromName: n.from.name,
      fromUserId: n.fromUserId,
      text: n.text,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
    }));
  });

  app.post('/api/notes/:id/read', async (req) => {
    const u = await requireUser(req);
    const { id } = req.params as { id: string };
    const r = await prisma.note.updateMany({
      where: { id, toUserId: u.id, readAt: null },
      data: { readAt: new Date() },
    });
    const me = await loadMe(u.id);
    if (me.homeFloorId) await presence.floor(me.homeFloorId)?.refreshNotes(u.id);
    return { updated: r.count };
  });

  app.get('/api/knocks/queued', async (req): Promise<QueuedKnock[]> => {
    const u = await requireUser(req);
    const ks = await prisma.knock.findMany({
      where: { toUserId: u.id, queued: true, createdAt: { gte: since() } },
      orderBy: { createdAt: 'desc' },
      include: { from: true },
    });
    return ks.map((k) => ({ id: k.id, fromName: k.from.name, createdAt: k.createdAt.toISOString() }));
  });

  app.post('/api/knocks/queued/clear', async (req) => {
    const u = await requireUser(req);
    const r = await prisma.knock.updateMany({
      where: { toUserId: u.id, queued: true },
      data: { queued: false },
    });
    return { cleared: r.count };
  });

  // ------------------------------------------------------------ salas
  /** La Sala libre deja que cualquiera pegue el link de la reunión planeada (o lo borre). */
  app.patch('/api/rooms/:id/link', async (req) => {
    const u = await requireUser(req);
    const { id } = req.params as { id: string };
    const { teamsLink } = parse(z.object({ teamsLink: z.string().max(2000).nullable() }), req.body);
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) throw new HttpError(404, 'Esa sala no existe.');
    if (!room.linkEditableByAll && u.role !== 'ADMIN')
      throw new HttpError(403, 'Solo un admin puede cambiar el link de esta sala.');
    const link = teamsLink === null || teamsLink.trim() === '' ? null : normalizeTeamsLink(teamsLink);
    if (teamsLink && teamsLink.trim() !== '' && !link)
      throw new HttpError(400, 'Pega un link de Teams (https://teams.microsoft.com/…).');
    await prisma.room.update({ where: { id }, data: { teamsLink: link } });
    await reloadFloors(room.floorId);
    return { teamsLink: link };
  });

  // ------------------------------------------------------------ voz
  app.post('/api/voice/token', async (req, reply): Promise<VoiceToken | undefined> => {
    const u = await requireUser(req);
    if (!voiceEnabled()) {
      reply.status(503).send({ error: 'La voz no está configurada en este servidor.' });
      return;
    }
    const { room } = parse(z.object({ room: z.string().regex(/^(floor|room)-[a-z0-9-]+$/) }), req.body);
    // Solo se entrega token para el piso o la sala donde la persona está ahora.
    const p = presence.get(u.id);
    const allowed = p && (room === `floor-${p.floorId}` || (p.roomId && room === `room-${p.roomId}`));
    if (!allowed) throw new HttpError(403, 'Tienes que estar en ese piso o sala para hablar ahí.');
    const at = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
      identity: u.id,
      name: u.name,
      ttl: '2h',
    });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
    return { url: env.livekit.url, token: await at.toJwt(), room };
  });

  // ------------------------------------------------------------ administración
  app.get('/api/admin/overview', async (req): Promise<AdminOverview> => {
    await requireAdmin(req);
    const [cells, floors, rooms, users] = await Promise.all([
      prisma.cell.findMany({ orderBy: { name: 'asc' } }),
      prisma.floor.findMany({ orderBy: { level: 'asc' } }),
      prisma.room.findMany({ orderBy: [{ floorId: 'asc' }, { name: 'asc' }] }),
      prisma.user.findMany({ orderBy: { name: 'asc' }, include: { office: true } }),
    ]);
    return {
      cells: cells.map((c) => ({ id: c.id, name: c.name, color: c.color, floorId: c.floorId })),
      floors: floors.map((f) => ({
        id: f.id,
        name: f.name,
        level: f.level,
        isCommon: f.isCommon,
        isLocked: f.isLocked,
      })),
      rooms: rooms.map((r) => ({
        id: r.id,
        floorId: r.floorId,
        name: r.name,
        teamsLink: r.teamsLink,
        linkEditableByAll: r.linkEditableByAll,
      })),
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        title: u.title,
        role: u.role,
        cellId: u.cellId,
        homeFloorId: u.office?.floorId ?? null,
      })),
    };
  });

  app.patch('/api/admin/floors/:id', async (req) => {
    await requireAdmin(req);
    const { id } = req.params as { id: string };
    const body = parse(
      z.object({ isLocked: z.boolean().optional(), name: z.string().trim().min(1).max(60).optional() }),
      req.body,
    );
    const f = await prisma.floor.update({ where: { id }, data: body }).catch(() => null);
    if (!f) throw new HttpError(404, 'Ese piso no existe.');
    presence.floor(id)?.enforceLock();
    return { id: f.id, isLocked: f.isLocked, name: f.name };
  });

  app.patch('/api/admin/rooms/:id', async (req) => {
    await requireAdmin(req);
    const { id } = req.params as { id: string };
    const body = parse(
      z.object({
        name: z.string().trim().min(1).max(60).optional(),
        teamsLink: z.string().max(2000).nullable().optional(),
        description: z.string().max(200).nullable().optional(),
      }),
      req.body,
    );
    const data: { name?: string; teamsLink?: string | null; description?: string | null } = {
      name: body.name,
      description: body.description,
    };
    if (body.teamsLink !== undefined) {
      const raw = body.teamsLink?.trim() ?? '';
      const link = raw ? normalizeTeamsLink(raw) : null;
      if (raw && !link) throw new HttpError(400, 'Pega un link de Teams (https://teams.microsoft.com/…).');
      data.teamsLink = link;
    }
    const room = await prisma.room.update({ where: { id }, data }).catch(() => null);
    if (!room) throw new HttpError(404, 'Esa sala no existe.');
    await reloadFloors(room.floorId);
    return { id: room.id, name: room.name, teamsLink: room.teamsLink };
  });

  app.patch('/api/admin/cells/:id', async (req) => {
    await requireAdmin(req);
    const { id } = req.params as { id: string };
    const body = parse(
      z.object({
        name: z.string().trim().min(1).max(40).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-f]{6}$/i)
          .optional(),
      }),
      req.body,
    );
    const c = await prisma.cell.update({ where: { id }, data: body }).catch(() => null);
    if (!c) throw new HttpError(404, 'Esa célula no existe.');
    if (body.name && c.floorId)
      await prisma.floor
        .update({ where: { id: c.floorId }, data: { name: `Piso ${body.name}` } })
        .catch(() => null);
    await reloadFloors(c.floorId);
    return { id: c.id, name: c.name, color: c.color, floorId: c.floorId };
  });

  const UserPatch = z.object({
    name: z.string().trim().min(1).max(80).optional(),
    title: z.string().trim().max(80).nullable().optional(),
    role: z.enum(['ADMIN', 'MEMBER']).optional(),
    /** null = sin célula (los jefes); su oficina queda en el Lobby. */
    cellId: z.string().nullable().optional(),
  });

  /** Mueve la oficina de alguien al piso que le toca según su célula. */
  async function placeOffice(
    userId: string,
    cellId: string | null,
  ): Promise<{ from: string | null; to: string | null }> {
    const before = await prisma.office.findUnique({ where: { ownerId: userId } });
    const cell = cellId ? await prisma.cell.findUnique({ where: { id: cellId } }) : null;
    const floorId =
      cell?.floorId ??
      (await prisma.floor.findFirst({ where: { isCommon: true }, orderBy: { level: 'asc' } }))?.id ??
      null;
    if (!floorId) return { from: before?.floorId ?? null, to: null };
    const id = await assignOffice(userId, floorId, cell?.color ?? DEFAULT_ACCENT);
    if (!id) throw new HttpError(409, 'Ese piso ya no tiene oficinas libres.');
    return { from: before?.floorId ?? null, to: floorId };
  }

  app.patch('/api/admin/users/:id', async (req) => {
    const admin = await requireAdmin(req);
    const { id } = req.params as { id: string };
    const body = parse(UserPatch, req.body);
    if (id === admin.id && body.role === 'MEMBER')
      throw new HttpError(400, 'No puedes quitarte tu propio rol de admin.');
    const prev = await prisma.user.findUnique({ where: { id } });
    if (!prev) throw new HttpError(404, 'Esa persona no existe.');
    if (body.cellId && !(await prisma.cell.findUnique({ where: { id: body.cellId } })))
      throw new HttpError(400, 'Esa célula no existe.');
    await prisma.user.update({ where: { id }, data: body });
    if (body.cellId !== undefined && body.cellId !== prev.cellId) {
      const moved = await placeOffice(id, body.cellId);
      await reloadFloors(moved.from, moved.to);
    } else if (body.name) {
      const office = await prisma.office.findUnique({ where: { ownerId: id } });
      await reloadFloors(office?.floorId);
    }
    return loadMe(id);
  });

  /** Genera una contraseña temporal. Se muestra una sola vez al admin. */
  app.post('/api/admin/users/:id/reset-password', async (req) => {
    await requireAdmin(req);
    const { id } = req.params as { id: string };
    const password = temporaryPassword();
    const { count } = await prisma.user.updateMany({
      where: { id },
      data: { passwordHash: await hashPassword(password), mustChangePassword: true },
    });
    if (!count) throw new HttpError(404, 'Esa persona no existe.');
    loginFailures.clear();
    return { password };
  });

  app.post('/api/admin/users', async (req) => {
    await requireAdmin(req);
    const body = parse(
      UserPatch.extend({
        email: z.string().trim().toLowerCase().email().max(200),
        name: z.string().trim().min(1).max(80),
        password: z.string().min(8).max(200),
      }),
      req.body,
    );
    if (await prisma.user.findUnique({ where: { email: body.email } }))
      throw new HttpError(409, 'Ya hay alguien con ese email.');
    if (body.cellId && !(await prisma.cell.findUnique({ where: { id: body.cellId } })))
      throw new HttpError(400, 'Esa célula no existe.');
    const u = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        title: body.title ?? null,
        role: body.role ?? 'MEMBER',
        cellId: body.cellId ?? null,
        passwordHash: await hashPassword(body.password),
        avatarConfig: parseAvatar({}),
      },
    });
    const moved = await placeOffice(u.id, u.cellId);
    await reloadFloors(moved.to);
    return loadMe(u.id);
  });
}
