/* eslint-disable @typescript-eslint/no-explicit-any -- el estado de la room llega sin tipos en el cliente de pruebas */
/**
 * Prueba de integración: API + multijugador contra la base de datos local (se vuelve a sembrar).
 * Requiere DATABASE_URL apuntando a un Postgres de desarrollo: la base se borra y se recarga.
 */
import { Client, type Room } from '@colyseus/sdk';
import {
  type DeliveryInfo,
  FLOOR_ROOM,
  type FloorInfo,
  type Me,
  type MeetingInfo,
  type ServerEvents,
  validatePlacement,
} from '@laofi/shared';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { tickMeetings } from '../src/jobs/meetings.js';
import { purgeOld } from '../src/jobs/retention.js';
import { presence } from '../src/presence/PresenceService.js';
import { seed } from '../src/seed.js';

const WS_PORT = 25700 + Math.floor(Math.random() * 200);
let api = '';
let app: ReturnType<typeof createApp>;
const rooms: Room[] = [];

beforeAll(async () => {
  await seed();
  presence.reset();
  app = createApp();
  await app.game.listen(WS_PORT);
  await app.http.listen({ port: 0, host: '127.0.0.1' });
  api = `http://127.0.0.1:${(app.http.server.address() as AddressInfo).port}`;
}, 60_000);

afterAll(async () => {
  for (const r of rooms) await r.leave().catch(() => undefined);
  await app.game.gracefullyShutdown(false);
  await app.http.close();
  await prisma.$disconnect();
});

interface Session {
  cookie: string;
  me: Me;
  call: <T = unknown>(method: string, path: string, body?: unknown) => Promise<{ status: number; data: T }>;
}

async function login(name: string, password = 'laofi123'): Promise<Session> {
  const res = await fetch(`${api}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${name}@laofi.local`, password }),
  });
  if (res.status !== 200) throw new Error(`login ${res.status}`);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const me = (await res.json()) as Me;
  const call = async <T>(method: string, path: string, body?: unknown) => {
    const r = await fetch(`${api}${path}`, {
      method,
      headers: { cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: (await r.json()) as T };
  };
  return { cookie, me, call };
}

const waitFor = async (fn: () => boolean, ms = 5000): Promise<void> => {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 25));
  }
};
async function enter(s: Session, floorId: string, spawn?: { kind: 'door'; userId: string }): Promise<Room> {
  const { data } = await s.call<{ token: string }>('POST', '/api/auth/room-token');
  const room = await new Client(`ws://127.0.0.1:${WS_PORT}`).joinOrCreate(FLOOR_ROOM, {
    floorId,
    token: data.token,
    spawn,
  });
  rooms.push(room);
  await waitFor(() => !!(room.state as any)?.players?.get(room.sessionId));
  return room;
}

const nextEvent = <T extends keyof ServerEvents>(room: Room, type: T): Promise<ServerEvents[T]> =>
  new Promise((resolve) => {
    const off = room.onMessage(type, (p: ServerEvents[T]) => {
      off();
      resolve(p);
    });
  });
const me = (room: Room): any => (room.state as any).players.get(room.sessionId);

describe('API de sesión', () => {
  it('rechaza una contraseña incorrecta y deja entrar con la buena', async () => {
    const bad = await fetch(`${api}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'jhoger@laofi.local', password: 'nop' }),
    });
    expect(bad.status).toBe(401);
    const s = await login('jhoger');
    expect(s.me).toMatchObject({ name: 'Jhoger', role: 'ADMIN', homeFloorId: 'axis' });
    expect((await fetch(`${api}/api/me`)).status).toBe(401);
  });

  it('sin token válido no se entra a un piso', async () => {
    await expect(
      new Client(`ws://127.0.0.1:${WS_PORT}`).joinOrCreate(FLOOR_ROOM, {
        floorId: 'axis',
        token: 'token-falso-123',
      }),
    ).rejects.toThrow();
  });
});

describe('un día en la oficina', () => {
  let jhoger: Session;
  let laura: Session;
  let isabella: Session;
  let rj: Room;
  let rl: Room;

  beforeAll(async () => {
    [jhoger, laura, isabella] = await Promise.all([login('jhoger'), login('laura'), login('isabella')]);
    rj = await enter(jhoger, 'axis');
    rl = await enter(laura, 'axis');
  });

  it('dos personas del mismo piso se ven y el servidor mueve a cada una', async () => {
    expect(rj.roomId).toBe(rl.roomId);
    await waitFor(() => (rl.state as any).players.size === 2);
    const start = { x: me(rj).x, y: me(rj).y };
    rj.send('move', { x: 15, y: 12 });
    await waitFor(() => {
      const p = (rl.state as any).players.get(rj.sessionId);
      return Math.abs(p.x - 15.5) < 0.01 && Math.abs(p.y - 12.5) < 0.01;
    });
    expect(start).not.toEqual({ x: 15.5, y: 12.5 });
    expect(me(rl).isVisitor).toBe(false);
  });

  it('una visita de otra célula toca la puerta, la respuesta le llega', async () => {
    const ri = await enter(isabella, 'axis', { kind: 'door', userId: jhoger.me.id });
    expect(me(ri).isVisitor).toBe(true);
    const received = nextEvent(rj, 'knock_received');
    const sent = nextEvent(ri, 'knock_sent');
    ri.send('knock', { toUserId: jhoger.me.id });
    const k = await received;
    expect(k).toMatchObject({ fromName: 'Isabella Castro', silent: false });
    expect((await sent).queued).toBe(false);
    const answered = nextEvent(ri, 'knock_answered');
    rj.send('knock_response', { knockId: k.knockId, response: 'ENTER' });
    expect((await answered).response).toBe('ENTER');
  });

  it('un post-it aparece sobre el escritorio y en la bandeja', async () => {
    const office = () =>
      [...(rl.state as any).offices.values()].find((o: { ownerId: string }) => o.ownerId === jhoger.me.id);
    const before = office().unreadNotes;
    rl.send('note_create', { toUserId: jhoger.me.id, text: 'Revisemos la HU-77 después del daily.' });
    await waitFor(() => office().unreadNotes === before + 1);
    const { data } = await jhoger.call<Array<{ id: string; text: string }>>('GET', '/api/notes');
    const note = data.find((n) => n.text.includes('HU-77'))!;
    expect(note).toBeTruthy();
    await jhoger.call('POST', `/api/notes/${note.id}/read`);
    await waitFor(() => office().unreadNotes === before);
  });

  it('solo el dueño edita su oficina', async () => {
    const { data: floor } = await jhoger.call<FloorInfo>('GET', '/api/floors/axis');
    const office = floor.offices.find((o) => o.ownerId === jhoger.me.id)!;
    const rejected = nextEvent(rl, 'action_rejected');
    rl.send('furniture_place', { key: 'plant', x: office.x + 1, y: office.y + 1, rot: 0, color: '#4c8b4a' });
    // Cada quien solo coloca muebles dentro de su propia oficina.
    expect((await rejected).reason).toBe('outside_office');

    let spot: { x: number; y: number } | null = null;
    for (let y = office.y; y < office.y + office.d && !spot; y++)
      for (let x = office.x; x < office.x + office.w && !spot; x++)
        if (
          !validatePlacement(office, { key: 'plant', x, y, rot: 0 }, floor.furniture) &&
          !(Math.floor(me(rj).x) === x && Math.floor(me(rj).y) === y)
        )
          spot = { x, y };
    expect(spot).not.toBeNull();
    const count = (rl.state as any).furniture.size;
    rj.send('furniture_place', { key: 'plant', x: spot!.x, y: spot!.y, rot: 0, color: '#4c8b4a' });
    await waitFor(() => (rl.state as any).furniture.size === count + 1);
  });

  it('modo foco cierra la puerta y los toques quedan en silencio', async () => {
    const office = () =>
      [...(rl.state as any).offices.values()].find((o: { ownerId: string }) => o.ownerId === jhoger.me.id);
    rj.send('set_status', { status: 'FOCUS' });
    await waitFor(() => office().doorClosed === true);
    const { data } = await laura.call<Array<{ id: string; status: string }>>('GET', '/api/directory');
    expect(data.find((d) => d.id === jhoger.me.id)?.status).toBe('FOCUS');
    rj.send('set_status', { status: 'AVAILABLE' });
    await waitFor(() => office().doorClosed === false);
  });

  it('un piso cerrado no deja entrar visitas', async () => {
    const lock = await isabella.call('PATCH', '/api/admin/floors/hextech', { isLocked: true });
    expect(lock.status).toBe(403);
    expect((await jhoger.call('PATCH', '/api/admin/floors/hextech', { isLocked: true })).status).toBe(200);
    await expect(enter(isabella, 'hextech')).rejects.toThrow();
    await jhoger.call('PATCH', '/api/admin/floors/hextech', { isLocked: false });
    const r = await enter(isabella, 'hextech');
    expect(me(r).isVisitor).toBe(true);
  });

  it('la Sala libre acepta solo links de Teams', async () => {
    expect(
      (await laura.call('PATCH', '/api/rooms/libre/link', { teamsLink: 'https://evil.com/x' })).status,
    ).toBe(400);
    const ok = await laura.call<{ teamsLink: string }>('PATCH', '/api/rooms/libre/link', {
      teamsLink: 'https://teams.microsoft.com/l/meetup-join/abc',
    });
    expect(ok.data.teamsLink).toContain('teams.microsoft.com');
    // Cuando el admin cambia el link de una sala, la room abierta del piso avisa para recargar.
    const lv = () => Number((rl.state as any).layoutVersion);
    const before = lv();
    expect(
      (
        await jhoger.call('PATCH', '/api/admin/rooms/sala-axis', {
          teamsLink: 'https://teams.microsoft.com/l/meetup-join/axis',
        })
      ).status,
    ).toBe(200);
    await waitFor(() => lv() === before + 1);
    expect((await laura.call('PATCH', '/api/rooms/sala-axis/link', { teamsLink: null })).status).toBe(403);
  });

  it('el mapa del edificio cuenta a la gente conectada', async () => {
    const { data } = await laura.call<{ floors: Array<{ id: string; online: number }> }>(
      'GET',
      '/api/building',
    );
    expect(data.floors.find((f) => f.id === 'axis')!.online).toBeGreaterThanOrEqual(2);
  });
});

describe('limpieza de 30 días', () => {
  it('borra post-its viejos y deja los recientes', async () => {
    const [a, b] = await prisma.user.findMany({ take: 2 });
    const old = await prisma.note.create({
      data: {
        fromUserId: a!.id,
        toUserId: b!.id,
        text: 'viejo',
        createdAt: new Date(Date.now() - 40 * 86400_000),
      },
    });
    const fresh = await prisma.note.create({ data: { fromUserId: a!.id, toUserId: b!.id, text: 'nuevo' } });
    await purgeOld();
    expect(await prisma.note.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.note.findUnique({ where: { id: fresh.id } })).not.toBeNull();
  });
});

describe('contraseñas', () => {
  it('con contraseña temporal solo se puede cambiarla, y el admin la restablece', async () => {
    const admin = await login('jhoger');
    const camila = await login('camila');
    const { status, data } = await admin.call<{ password: string }>(
      'POST',
      `/api/admin/users/${camila.me.id}/reset-password`,
    );
    expect(status).toBe(200);
    expect((await camila.call('POST', `/api/admin/users/${admin.me.id}/reset-password`)).status).toBe(403);

    expect((await camila.call('POST', '/api/auth/room-token')).status).toBe(403);
    expect((await camila.call('GET', '/api/building')).status).toBe(403);
    expect((await camila.call<Me>('GET', '/api/me')).data.mustChangePassword).toBe(true);

    const change = (current: string, next: string) =>
      camila.call<Me>('POST', '/api/me/password', { current, next });
    expect((await change('mala', 'una-clave-larga')).status).toBe(400);
    expect((await change(data.password, 'corta')).status).toBe(400);
    expect((await change(data.password, 'una-clave-larga')).data.mustChangePassword).toBe(false);
    expect((await camila.call('POST', '/api/auth/room-token')).status).toBe(200);
    await expect(login('camila')).rejects.toThrow('401');
    await expect(login('camila', 'una-clave-larga')).resolves.toBeTruthy();
  });

  it('una persona nueva recibe contraseña temporal y debe cambiarla', async () => {
    const admin = await login('jhoger');
    const body = { name: 'QA Prueba', email: 'qa.prueba@laofi.local', cellId: 'qa' };
    expect((await (await login('laura')).call('POST', '/api/admin/users', body)).status).toBe(403);
    const { status, data } = await admin.call<{ user: Me; password: string }>(
      'POST',
      '/api/admin/users',
      body,
    );
    expect(status).toBe(200);
    expect(data.user.mustChangePassword).toBe(true);
    expect(data.password.length).toBeGreaterThanOrEqual(12);
    await expect(login('qa.prueba', data.password)).resolves.toBeTruthy();
    expect((await admin.call('POST', '/api/admin/users', body)).status).toBe(409);
  });

  it('frena a quien prueba contraseñas', async () => {
    for (let i = 0; i < 8; i++) await expect(login('tomas', 'mala')).rejects.toThrow('401');
    await expect(login('tomas')).rejects.toThrow('429');
  });
});

describe('entregas y agenda', () => {
  let dev: Session;
  let qa: Session;
  let admin: Session;

  beforeAll(async () => {
    dev = await login('laura');
    qa = await login('daniela');
    admin = await login('jhoger');
  });

  const create = (s: Session, externalId = 'HU-1') =>
    s.call<DeliveryInfo>('POST', '/api/deliveries', { externalId, title: 'Login con captcha' });
  const move = (s: Session, id: string, status: string, note?: string) =>
    s.call<DeliveryInfo>('PATCH', `/api/deliveries/${id}/status`, { status, note });

  it('una entrega recorre el flujo y respeta los permisos', async () => {
    expect((await create(qa)).status).toBe(403);
    const { data: d, status } = await create(dev);
    expect(status).toBe(200);
    expect(d.fromCell.id).toBe('axis');
    expect(d.source).toBe('MANUAL');

    expect((await move(dev, d.id, 'TESTING')).status).toBe(403);
    expect((await move(qa, d.id, 'APPROVED')).status).toBe(403);
    expect((await move(qa, d.id, 'TESTING')).data.status).toBe('TESTING');
    const back = await move(qa, d.id, 'RETURNED', 'Falla en Safari');
    expect(back.data.note).toBe('Falla en Safari');
    const again = await move(dev, d.id, 'SENT');
    expect(again.data.status).toBe('SENT');
    expect(again.data.note).toBeNull();
    await move(qa, d.id, 'TESTING');
    expect((await move(qa, d.id, 'APPROVED')).data.status).toBe('APPROVED');

    // Lo aprobado sigue en la lista hasta que la célula lo despliega.
    expect((await move(qa, d.id, 'DEPLOYED')).status).toBe(403);
    expect((await move(dev, d.id, 'DEPLOYED')).data.status).toBe('DEPLOYED');
  });

  it('el link de la entrega tiene que ser de Azure DevOps', async () => {
    const bad = await dev.call('POST', '/api/deliveries', {
      externalId: 'HU-5',
      title: 'Link malo',
      url: 'https://evil.example.com/x',
    });
    expect(bad.status).toBe(400);
    const url = 'https://dev.azure.com/empresa/p/_workitems/edit/5';
    const ok = await dev.call<DeliveryInfo>('POST', '/api/deliveries', {
      externalId: 'HU-5',
      title: 'Link bueno',
      url,
    });
    expect(ok.data.url).toBe(url);
  });

  it('lo que publicas en tu oficina se ve en vivo y en el directorio', async () => {
    const rl = await enter(dev, 'axis');
    const office = () =>
      [...(rl.state as any).offices.values()].find((o: any) => o.ownerId === dev.me.id) as any;
    const url = 'https://dev.azure.com/empresa/p/_workitems/edit/1302';
    const put = (work: unknown) => dev.call('PUT', '/api/me/work', { work });

    expect(
      (await put({ activity: 'DEVELOPING', itemId: '1302', url: 'https://evil.example.com' })).status,
    ).toBe(400);
    expect((await put({ activity: 'DEVELOPING', itemId: '1302', title: 'Login', url })).status).toBe(200);
    await waitFor(() => office().work.includes('1302'));
    const entry = (await admin.call<any[]>('GET', '/api/directory')).data.find((p) => p.id === dev.me.id);
    expect(entry.currentWork.url).toBe(url);

    await put(null);
    await waitFor(() => office().work === '');
    expect((await dev.call<Me>('GET', '/api/me')).data.currentWork).toBeNull();
  });

  it('no se puede entregar desde QA aunque seas admin', async () => {
    const r = await admin.call('POST', '/api/deliveries', {
      externalId: 'HU-2',
      title: 'Algo',
      fromCellId: 'qa',
    });
    expect(r.status).toBe(400);
  });

  it('avisa la entrega a quien esté conectado en otro piso', async () => {
    const room = await enter(qa, 'qa');
    const got = new Promise<ServerEvents['delivery_update']>((res) => room.onMessage('delivery_update', res));
    await create(dev, 'HU-3');
    const e = await got;
    expect(e.delivery.externalId).toBe('HU-3');
    expect(e.previous).toBeNull();
  });

  it('la simulación es solo para admins y se puede quitar', async () => {
    expect((await dev.call('POST', '/api/demo/deliveries/simulate')).status).toBe(403);
    const sim = await admin.call<DeliveryInfo>('POST', '/api/demo/deliveries/simulate');
    expect(sim.data.source).toBe('DEMO');
    expect((await admin.call('POST', '/api/demo/deliveries/load')).status).toBe(200);
    await admin.call('POST', '/api/demo/deliveries/clear');
    const { data } = await admin.call<DeliveryInfo[]>('GET', '/api/deliveries');
    expect(data.some((d) => d.source === 'DEMO')).toBe(false);
    expect(data.some((d) => d.externalId === 'HU-3')).toBe(true);
  });

  it('avisa un minuto antes y al terminar, y cada quien ve solo su agenda', async () => {
    const room = await enter(qa, 'qa');
    const starting = new Promise<ServerEvents['meeting_starting']>((res) =>
      room.onMessage('meeting_starting', res),
    );
    const ended = new Promise<ServerEvents['meeting_ended']>((res) => room.onMessage('meeting_ended', res));
    const startsAt = new Date(Date.now() + 30_000);
    const { data: m } = await qa.call<MeetingInfo>('POST', '/api/meetings', {
      title: 'Planeación',
      startsAt: startsAt.toISOString(),
      durationMin: 30,
      roomId: 'sala-qa',
      teamsLink: 'https://teams.microsoft.com/l/meetup-join/plan',
    });
    expect(m.teamsLink).toContain('teams.microsoft.com');
    expect((await dev.call<MeetingInfo[]>('GET', '/api/meetings')).data).toHaveLength(0);

    await tickMeetings();
    expect((await starting).meeting.id).toBe(m.id);
    expect((await tickMeetings()).started).toBe(0);

    await tickMeetings(new Date(startsAt.getTime() + 31 * 60_000));
    expect((await ended).meeting.id).toBe(m.id);
    expect((await dev.call(`POST`, `/api/meetings/${m.id}/cancel`)).status).toBe(404);
    expect((await qa.call('POST', `/api/meetings/${m.id}/cancel`)).status).toBe(200);
  });

  it('rechaza links que no son de Teams en la agenda', async () => {
    const r = await qa.call('POST', '/api/meetings', {
      title: 'Mala',
      startsAt: new Date().toISOString(),
      durationMin: 30,
      roomId: 'sala-qa',
      teamsLink: 'https://evil.example.com/x',
    });
    expect(r.status).toBe(400);
  });
});
