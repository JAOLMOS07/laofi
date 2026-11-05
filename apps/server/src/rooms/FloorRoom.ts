import { type Client, Room } from '@colyseus/core';
import {
  CATALOG,
  ClientMessages,
  type ClientMessage,
  type ClientMessageType,
  type CurrentWork,
  type FloorGeometry,
  type FurnitureKey,
  JoinOptionsSchema,
  MAX_PLAYERS_PER_FLOOR,
  type PlacedItem,
  type PttTarget,
  type Rotation,
  type ServerEventType,
  type ServerEvents,
  type Status,
  TICK_RATE,
  type Tile,
  WALK_SPEED,
  buildFloorGeometry,
  canEditOffice,
  doorEdge,
  doorOutside,
  featureBlocks,
  findPath,
  footprint,
  isWalkable,
  parseAvatar,
  parseCurrentWork,
  rectContains,
  stepAlongPath,
  tileAt,
  validatePlacement,
} from '@laofi/shared';
import { verifyToken } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { type FloorView, loadFloor } from '../floors.js';
import { type FloorHandle, presence } from '../presence/PresenceService.js';
import { FloorState, FurnitureState, OfficeState, PlayerState } from './schema.js';

interface Mover {
  x: number;
  y: number;
  path: Tile[];
}
interface AuthUser {
  id: string;
  name: string;
  cellId: string | null;
  role: 'ADMIN' | 'MEMBER';
  status: Status;
  avatar: string;
}

const silentStatuses: Status[] = ['FOCUS', 'AWAY'];
const workJson = (w: CurrentWork | null): string => (w ? JSON.stringify(w) : '');

/**
 * Una instancia por piso o zona. El servidor es la autoridad de la posición y de todo cambio:
 * el cliente pide (moverse, colocar un mueble, tocar una puerta) y el servidor valida y difunde.
 */
export class FloorRoom extends Room<{ state: FloorState }> implements FloorHandle {
  override maxClients = MAX_PLAYERS_PER_FLOOR;
  override state = new FloorState();
  floorId = '';
  private view!: FloorView;
  private geo!: FloorGeometry;
  private movers = new Map<string, Mover>();
  private users = new Map<string, AuthUser>();
  private lastPtt = new Map<string, { target: PttTarget; id?: string }>();

  override async onCreate(options: { floorId?: string }): Promise<void> {
    const view = await loadFloor(options.floorId ?? '');
    if (!view) throw new Error(`Piso desconocido: ${options.floorId}`);
    this.view = view;
    this.floorId = view.id;
    this.state.floorId = view.id;
    this.state.locked = view.isLocked;
    this.state.layoutVersion = 0;
    this.rebuildGeometry();
    for (const f of view.furniture) this.state.furniture.set(f.id, this.toFurnitureState(f));

    const owners = view.offices.map((o) => o.ownerId).filter((id): id is string => !!id);
    const [statuses, unread] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: owners } },
        select: { id: true, status: true, currentWork: true },
      }),
      prisma.note.groupBy({
        by: ['toUserId'],
        where: { toUserId: { in: owners }, readAt: null },
        _count: true,
      }),
    ]);
    for (const o of view.offices) {
      const s = new OfficeState();
      s.ownerId = o.ownerId ?? '';
      s.wallColor = o.wallColor ?? '';
      s.floorColor = o.floorColor ?? '';
      s.unreadNotes = unread.find((u) => u.toUserId === o.ownerId)?._count ?? 0;
      s.work = workJson(parseCurrentWork(statuses.find((u) => u.id === o.ownerId)?.currentWork));
      this.state.offices.set(o.id, s);
      this.setDoor(
        o.id,
        silentStatuses.includes(statuses.find((u) => u.id === o.ownerId)?.status ?? 'AVAILABLE'),
      );
    }

    this.patchRate = 1000 / TICK_RATE;
    this.registerHandlers();
    this.setSimulationInterval((dtMs) => this.tick(dtMs / 1000), 1000 / TICK_RATE);
    presence.registerFloor(this);
  }

  override onDispose(): void {
    presence.unregisterFloor(this);
  }

  override async onAuth(_client: Client, options: unknown): Promise<AuthUser> {
    const opts = JoinOptionsSchema.parse(options);
    const userId = await verifyToken(opts.token, 'room');
    if (!userId) throw new Error('Sesión inválida o vencida. Vuelve a entrar.');
    const u = await prisma.user.findUnique({ where: { id: userId }, include: { cell: true } });
    if (!u) throw new Error('Usuario desconocido.');
    const isMember = !!u.cell && u.cell.floorId === this.floorId;
    if (this.state.locked && !isMember && u.role !== 'ADMIN')
      throw new Error('Este piso está cerrado por ahora.');
    return {
      id: u.id,
      name: u.name,
      cellId: u.cellId,
      role: u.role,
      status: u.status,
      avatar: JSON.stringify(parseAvatar(u.avatarConfig)),
    };
  }

  override onJoin(client: Client, options: unknown, auth: AuthUser): void {
    const opts = JoinOptionsSchema.parse(options);
    let spawn = this.freeTileNear(this.view.layout.spawn);
    const sp = opts.spawn;
    if (sp?.kind === 'door') {
      const office = this.view.offices.find((o) => o.ownerId === sp.userId);
      if (office) spawn = this.freeTileNear(doorOutside(office));
    }
    const p = new PlayerState();
    p.userId = auth.id;
    p.name = auth.name;
    p.cellId = auth.cellId ?? '';
    p.avatar = auth.avatar;
    p.x = spawn.x + 0.5;
    p.y = spawn.y + 0.5;
    p.moving = false;
    p.status = auth.status;
    p.voiceMode = 'NONE';
    p.isVisitor = !!this.view.cell && this.view.cell.id !== auth.cellId;
    p.roomId = this.roomAt(spawn) ?? '';
    p.talking = false;
    this.state.players.set(client.sessionId, p);
    this.movers.set(client.sessionId, { x: p.x, y: p.y, path: [] });
    this.users.set(client.sessionId, auth);
    presence.join(
      {
        userId: auth.id,
        sessionId: client.sessionId,
        name: auth.name,
        cellId: auth.cellId,
        floorId: this.floorId,
        roomId: p.roomId || null,
        status: auth.status,
        voiceMode: 'NONE',
      },
      (type, payload) => client.send(type, payload),
      () => client.leave(4001),
    );
  }

  override onLeave(client: Client): void {
    const u = this.users.get(client.sessionId);
    if (u && this.lastPtt.has(client.sessionId)) this.stopPtt(client);
    this.state.players.delete(client.sessionId);
    this.movers.delete(client.sessionId);
    this.users.delete(client.sessionId);
    if (u) presence.leave(u.id, client.sessionId);
  }

  // ---------------------------------------------------------------- FloorHandle
  enforceLock(): void {
    void prisma.floor.findUnique({ where: { id: this.floorId } }).then((f) => {
      if (!f) return;
      this.state.locked = f.isLocked;
      if (!f.isLocked) return;
      for (const c of this.clients) {
        const u = this.users.get(c.sessionId);
        const p = this.state.players.get(c.sessionId);
        if (u && p?.isVisitor && u.role !== 'ADMIN') {
          c.send('floor_locked', { floorId: this.floorId } satisfies ServerEvents['floor_locked']);
          c.leave(4002);
        }
      }
    });
  }

  /** Recarga oficinas, salas y muebles desde la base (cambios del panel de admin). */
  async reloadStatic(): Promise<void> {
    const v = await loadFloor(this.floorId);
    if (!v) return;
    this.view = v;
    this.state.locked = v.isLocked;
    const ids = new Set(v.furniture.map((f) => f.id));
    for (const id of [...this.state.furniture.keys()]) if (!ids.has(id)) this.state.furniture.delete(id);
    for (const f of v.furniture) this.state.furniture.set(f.id, this.toFurnitureState(f));
    const officeIds = new Set(v.offices.map((o) => o.id));
    for (const id of [...this.state.offices.keys()]) if (!officeIds.has(id)) this.state.offices.delete(id);
    this.geo = undefined as unknown as FloorGeometry;
    this.rebuildGeometry();
    for (const o of v.offices) {
      let s = this.state.offices.get(o.id);
      if (!s) {
        s = new OfficeState();
        this.state.offices.set(o.id, s);
      }
      s.ownerId = o.ownerId ?? '';
      s.wallColor = o.wallColor ?? '';
      s.floorColor = o.floorColor ?? '';
      const owner = o.ownerId
        ? await prisma.user.findUnique({
            where: { id: o.ownerId },
            select: { status: true, currentWork: true },
          })
        : null;
      s.unreadNotes = o.ownerId
        ? await prisma.note.count({ where: { toUserId: o.ownerId, readAt: null } })
        : 0;
      s.work = workJson(parseCurrentWork(owner?.currentWork));
      this.setDoor(o.id, silentStatuses.includes(owner?.status ?? 'AVAILABLE'));
    }
    for (const [sid, p] of this.state.players) {
      const u = this.users.get(sid);
      if (u) p.isVisitor = !!v.cell && v.cell.id !== u.cellId;
    }
    this.state.layoutVersion = (this.state.layoutVersion || 0) + 1;
  }

  setUserStatus(userId: string, status: Status): void {
    for (const [sid, p] of this.state.players)
      if (p.userId === userId) {
        p.status = status;
        const u = this.users.get(sid);
        if (u) u.status = status;
      }
    const office = this.view.offices.find((o) => o.ownerId === userId);
    if (office) this.setDoor(office.id, silentStatuses.includes(status));
  }

  setUserAvatar(userId: string, avatarJson: string): void {
    for (const [sid, p] of this.state.players)
      if (p.userId === userId) {
        p.avatar = avatarJson;
        const u = this.users.get(sid);
        if (u) u.avatar = avatarJson;
      }
  }

  setUserWork(userId: string, work: CurrentWork | null): void {
    const office = this.view.offices.find((o) => o.ownerId === userId);
    const s = office && this.state.offices.get(office.id);
    if (s) s.work = workJson(work);
  }

  async refreshNotes(userId: string): Promise<void> {
    const office = this.view.offices.find((o) => o.ownerId === userId);
    const s = office && this.state.offices.get(office.id);
    if (!s) return;
    s.unreadNotes = await prisma.note.count({ where: { toUserId: userId, readAt: null } });
  }

  // ---------------------------------------------------------------- mensajes
  private registerHandlers(): void {
    const on = <T extends ClientMessageType>(
      type: T,
      fn: (client: Client, msg: ClientMessage<T>, user: AuthUser) => unknown,
    ) => {
      this.onMessage(type, (client: Client, raw: unknown) => {
        const user = this.users.get(client.sessionId);
        const parsed = ClientMessages[type].safeParse(raw);
        if (!user || !parsed.success) {
          if (type === 'move') this.emit(client, 'move_rejected', { reason: 'invalid' });
          else this.emit(client, 'action_rejected', { action: type, reason: 'invalid' });
          return;
        }
        Promise.resolve(fn(client, parsed.data as ClientMessage<T>, user)).catch((err: unknown) => {
          console.error(`[la-ofi] error en ${type}:`, err);
          this.emit(client, 'action_rejected', { action: type, reason: 'server_error' });
        });
      });
    };

    on('move', (client, { x, y }) => this.handleMove(client, x, y));

    on('set_status', async (_client, { status }, user) => {
      await prisma.user.update({ where: { id: user.id }, data: { status } });
      // El estado se refleja en todos los pisos abiertos (puerta de su oficina, etiqueta sobre su avatar).
      for (const h of presence.floorHandles()) h.setUserStatus(user.id, status);
      const entry = presence.get(user.id);
      if (entry) presence.update(user.id, entry.sessionId, { status });
    });

    on('knock', (client, { toUserId }, user) => this.handleKnock(client, user, toUserId));

    on('knock_response', async (client, { knockId, response }, user) => {
      const k = await prisma.knock.findUnique({ where: { id: knockId } });
      if (!k || k.toUserId !== user.id)
        return this.emit(client, 'action_rejected', { action: 'knock_response', reason: 'not_found' });
      await prisma.knock.update({ where: { id: knockId }, data: { response } });
      presence.send(k.fromUserId, 'knock_answered', {
        knockId,
        byUserId: user.id,
        byName: user.name,
        response,
      });
    });

    on('note_create', async (client, { toUserId, text }, user) => {
      const to = await prisma.user.findUnique({ where: { id: toUserId } });
      if (!to) return this.emit(client, 'action_rejected', { action: 'note_create', reason: 'not_found' });
      const note = await prisma.note.create({ data: { fromUserId: user.id, toUserId, text } });
      presence.send(toUserId, 'note_received', {
        noteId: note.id,
        fromUserId: user.id,
        fromName: user.name,
        text,
        at: note.createdAt.toISOString(),
      });
      this.emit(client, 'note_sent', { toName: to.name });
      await presence.floor(await this.homeFloorOf(toUserId))?.refreshNotes(toUserId);
    });

    on('furniture_place', async (client, m, user) => {
      const office = this.myOffice(user.id);
      const item = { key: m.key as FurnitureKey, x: m.x, y: m.y, rot: m.rot as Rotation };
      const err = this.checkEdit(office, user.id, item);
      if (err || !office)
        return this.emit(client, 'action_rejected', {
          action: 'furniture_place',
          reason: err ?? 'no_office',
        });
      const catalog = await prisma.furnitureCatalog.findUniqueOrThrow({ where: { key: m.key } });
      const row = await prisma.placedFurniture.create({
        data: {
          officeId: office.id,
          catalogId: catalog.id,
          gridX: m.x,
          gridY: m.y,
          rotation: m.rot,
          color: CATALOG[item.key].colorable ? m.color : CATALOG[item.key].color,
        },
      });
      const placed: PlacedItem = { id: row.id, ...item, color: row.color ?? m.color, officeId: office.id };
      this.view.furniture.push(placed);
      this.state.furniture.set(row.id, this.toFurnitureState(placed));
      this.rebuildGeometry();
    });

    on('furniture_move', async (client, m, user) => {
      const f = this.view.furniture.find((x) => x.id === m.id);
      const office = this.myOffice(user.id);
      const err =
        !f || !office || f.officeId !== office.id
          ? 'forbidden'
          : this.checkEdit(office, user.id, { key: f.key, x: m.x, y: m.y, rot: m.rot as Rotation }, f.id);
      if (err || !f)
        return this.emit(client, 'action_rejected', { action: 'furniture_move', reason: err ?? 'forbidden' });
      await prisma.placedFurniture.update({
        where: { id: f.id },
        data: { gridX: m.x, gridY: m.y, rotation: m.rot },
      });
      Object.assign(f, { x: m.x, y: m.y, rot: m.rot });
      const s = this.state.furniture.get(f.id)!;
      s.x = m.x;
      s.y = m.y;
      s.rot = m.rot;
      this.rebuildGeometry();
    });

    on('furniture_remove', async (client, { id }, user) => {
      const f = this.view.furniture.find((x) => x.id === id);
      const office = this.myOffice(user.id);
      if (!f || !office || f.officeId !== office.id)
        return this.emit(client, 'action_rejected', { action: 'furniture_remove', reason: 'forbidden' });
      await prisma.placedFurniture.delete({ where: { id } });
      this.view.furniture = this.view.furniture.filter((x) => x.id !== id);
      this.state.furniture.delete(id);
      this.rebuildGeometry();
    });

    on('furniture_recolor', async (client, { id, color }, user) => {
      const f = this.view.furniture.find((x) => x.id === id);
      const office = this.myOffice(user.id);
      if (!f || !office || f.officeId !== office.id || !CATALOG[f.key].colorable)
        return this.emit(client, 'action_rejected', { action: 'furniture_recolor', reason: 'forbidden' });
      await prisma.placedFurniture.update({ where: { id }, data: { color } });
      f.color = color;
      this.state.furniture.get(id)!.color = color;
    });

    on('office_style', async (client, { wallColor, floorColor }, user) => {
      const office = this.myOffice(user.id);
      if (!office)
        return this.emit(client, 'action_rejected', { action: 'office_style', reason: 'no_office' });
      await prisma.office.update({ where: { id: office.id }, data: { wallColor, floorColor } });
      const s = this.state.offices.get(office.id)!;
      if (wallColor) s.wallColor = office.wallColor = wallColor;
      if (floorColor) s.floorColor = office.floorColor = floorColor;
    });

    on('voice_mode', (client, { mode }, user) => {
      const p = this.state.players.get(client.sessionId)!;
      p.voiceMode = p.roomId ? mode : 'NONE';
      presence.update(user.id, client.sessionId, { voiceMode: p.voiceMode as 'APP' | 'TEAMS' | 'NONE' });
    });

    on('ptt_start', (client, { target, id }, user) => {
      const p = this.state.players.get(client.sessionId)!;
      if (target === 'USER' && !id)
        return this.emit(client, 'action_rejected', { action: 'ptt_start', reason: 'invalid' });
      if (target === 'ROOM' && !p.roomId)
        return this.emit(client, 'action_rejected', { action: 'ptt_start', reason: 'not_in_room' });
      p.talking = true;
      this.lastPtt.set(client.sessionId, { target, id });
      for (const c of this.pttRecipients(client, target, id))
        c.send('ptt', {
          fromUserId: user.id,
          fromName: user.name,
          target,
          id,
          active: true,
        } satisfies ServerEvents['ptt']);
    });

    on('ptt_stop', (client) => this.stopPtt(client));
  }

  // ---------------------------------------------------------------- movimiento
  private handleMove(client: Client, x: number, y: number): void {
    const m = this.movers.get(client.sessionId);
    const u = this.users.get(client.sessionId);
    if (!m || !u) return;
    const from = m.path[0] ?? tileAt(m.x, m.y);
    const path = this.pathFor(u.id, from, { x, y });
    if (!path) return this.emit(client, 'move_rejected', { reason: 'no_path' });
    m.path = m.path.length > 0 ? [from, ...path] : path;
  }

  /** Camino para una persona: puede cruzar la puerta cerrada de su propia oficina o salir de una en la que ya está. */
  private pathFor(userId: string, from: Tile, to: Tile): Tile[] | null {
    const opened: string[] = [];
    for (const o of this.view.offices) {
      const k = doorEdge(o);
      if (this.geo.grid.closedDoors.has(k) && (o.ownerId === userId || rectContains(o, from.x, from.y))) {
        this.geo.grid.closedDoors.delete(k);
        opened.push(k);
      }
    }
    try {
      return findPath(this.geo.grid, from, to);
    } finally {
      for (const k of opened) this.geo.grid.closedDoors.add(k);
    }
  }

  private tick(dt: number): void {
    this.movers.forEach((m, sid) => {
      const p = this.state.players.get(sid);
      if (!p) return;
      const before = tileAt(m.x, m.y);
      if (stepAlongPath(m, dt, WALK_SPEED)) {
        p.x = Math.round(m.x * 1000) / 1000;
        p.y = Math.round(m.y * 1000) / 1000;
      }
      const moving = m.path.length > 0;
      if (p.moving !== moving) p.moving = moving;
      const now = tileAt(m.x, m.y);
      if (now.x !== before.x || now.y !== before.y) {
        const roomId = this.roomAt(now) ?? '';
        if (roomId !== p.roomId) {
          p.roomId = roomId;
          if (!roomId) p.voiceMode = 'NONE';
          presence.update(p.userId, sid, {
            roomId: roomId || null,
            voiceMode: p.voiceMode as 'APP' | 'TEAMS' | 'NONE',
          });
        }
      }
    });
  }

  // ---------------------------------------------------------------- toc toc
  private async handleKnock(client: Client, user: AuthUser, toUserId: string): Promise<void> {
    const office = this.view.offices.find((o) => o.ownerId === toUserId);
    const m = this.movers.get(client.sessionId)!;
    if (!office) return this.emit(client, 'action_rejected', { action: 'knock', reason: 'office_not_here' });
    const door = doorOutside(office);
    if (Math.hypot(m.x - (door.x + 0.5), m.y - (door.y + 0.5)) > 1.6)
      return this.emit(client, 'action_rejected', { action: 'knock', reason: 'too_far' });
    const target = await prisma.user.findUniqueOrThrow({ where: { id: toUserId } });
    const online = presence.get(toUserId);
    const status = (online?.status ?? target.status) as Status;
    const queued = !online || silentStatuses.includes(status);
    const knock = await prisma.knock.create({ data: { fromUserId: user.id, toUserId, queued } });
    presence.send(toUserId, 'knock_received', {
      knockId: knock.id,
      fromUserId: user.id,
      fromName: user.name,
      silent: queued,
      at: knock.createdAt.toISOString(),
    });
    this.emit(client, 'knock_sent', { knockId: knock.id, toName: target.name, queued, status });
  }

  // ---------------------------------------------------------------- walkie-talkie
  private pttRecipients(from: Client, target: PttTarget, id?: string): Client[] {
    const me = this.state.players.get(from.sessionId);
    return this.clients.filter((c) => {
      if (c.sessionId === from.sessionId) return false;
      const p = this.state.players.get(c.sessionId);
      if (!p) return false;
      if (target === 'USER') return p.userId === id;
      if (target === 'ROOM') return !!me?.roomId && p.roomId === me.roomId;
      return true;
    });
  }

  private stopPtt(client: Client): void {
    const last = this.lastPtt.get(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    const u = this.users.get(client.sessionId);
    if (p) p.talking = false;
    this.lastPtt.delete(client.sessionId);
    if (!last || !u) return;
    for (const c of this.pttRecipients(client, last.target, last.id))
      c.send('ptt', {
        fromUserId: u.id,
        fromName: u.name,
        target: last.target,
        id: last.id,
        active: false,
      } satisfies ServerEvents['ptt']);
  }

  // ---------------------------------------------------------------- utilidades
  private emit<T extends ServerEventType>(client: Client, type: T, payload: ServerEvents[T]): void {
    client.send(type, payload);
  }

  private myOffice(userId: string) {
    return this.view.offices.find((o) => o.ownerId === userId);
  }

  private checkEdit(
    office: FloorView['offices'][number] | undefined,
    userId: string,
    item: { key: FurnitureKey; x: number; y: number; rot: Rotation },
    ignoreId?: string,
  ): string | null {
    if (!office) return 'no_office';
    if (!canEditOffice(userId, office)) return 'forbidden';
    const err = validatePlacement(office, item, this.view.furniture, ignoreId);
    if (err) return err;
    if (CATALOG[item.key].block) {
      const fp = footprint(item.key, item.rot);
      for (const m of this.movers.values()) {
        const t = tileAt(m.x, m.y);
        if (t.x >= item.x && t.x < item.x + fp.w && t.y >= item.y && t.y < item.y + fp.d) return 'occupied';
      }
    }
    return null;
  }

  private rebuildGeometry(): void {
    const closed = this.geo?.grid.closedDoors ?? new Set<string>();
    this.geo = buildFloorGeometry(
      this.view.layout,
      this.view.offices,
      this.view.rooms,
      this.view.furniture,
      featureBlocks(this.floorId),
    );
    for (const k of closed) this.geo.grid.closedDoors.add(k);
  }

  private setDoor(officeId: string, closed: boolean): void {
    const o = this.view.offices.find((x) => x.id === officeId);
    const s = this.state.offices.get(officeId);
    if (!o || !s) return;
    s.doorClosed = closed;
    const k = doorEdge(o);
    if (closed) this.geo.grid.closedDoors.add(k);
    else this.geo.grid.closedDoors.delete(k);
  }

  private roomAt(t: Tile): string | null {
    return this.view.rooms.find((r) => rectContains(r, t.x, t.y))?.id ?? null;
  }

  private async homeFloorOf(userId: string): Promise<string> {
    const u = await prisma.user.findUnique({ where: { id: userId }, include: { office: true } });
    return u?.office?.floorId ?? '';
  }

  private freeTileNear(s: Tile): Tile {
    const taken = new Set([...this.movers.values()].map((m) => `${Math.floor(m.x)},${Math.floor(m.y)}`));
    for (let r = 0; r < 5; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++) {
          const t = { x: s.x + dx, y: s.y + dy };
          if (isWalkable(this.geo.grid, t.x, t.y) && !taken.has(`${t.x},${t.y}`) && !this.inAnyOffice(t))
            return t;
        }
    return s;
  }

  private inAnyOffice(t: Tile): boolean {
    return this.view.offices.some((o) => rectContains(o, t.x, t.y));
  }

  private toFurnitureState(f: PlacedItem): FurnitureState {
    const s = new FurnitureState();
    s.key = f.key;
    s.x = f.x;
    s.y = f.y;
    s.rot = f.rot;
    s.color = f.color;
    s.officeId = f.officeId ?? '';
    return s;
  }
}
