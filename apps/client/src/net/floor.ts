/**
 * Conexión con la room del piso actual. El estado de la room se copia a mapas mutables (`live`)
 * que la escena lee en cada cuadro; la UI de React solo se entera cuando cambia algo que muestra.
 */
import { Client, type Room } from '@colyseus/sdk';
import {
  type AvatarConfig,
  type BuildingFloor,
  type CellInfo,
  type ClientMessage,
  type ClientMessageType,
  type CurrentWork,
  type DeliveryInfo,
  type DeliveryStatus,
  FLOOR_ROOM,
  type FloorInfo,
  type FurnitureKey,
  type MeetingInfo,
  type Rotation,
  type ServerEventType,
  type ServerEvents,
  type Status,
  type VoiceMode,
  parseAvatar,
  parseCurrentWork,
} from '@laofi/shared';
import { firstName, useUi } from '../state/store';
import { api } from './api';
import { onFloorJoined, onPtt, onRoomChanged } from './voice';

export interface PlayerSnap {
  sid: string;
  userId: string;
  name: string;
  cellId: string;
  avatar: AvatarConfig;
  avatarRaw: string;
  x: number;
  y: number;
  moving: boolean;
  status: Status;
  voiceMode: VoiceMode;
  isVisitor: boolean;
  roomId: string;
  talking: boolean;
}
export interface FurnSnap {
  id: string;
  key: FurnitureKey;
  x: number;
  y: number;
  rot: Rotation;
  color: string;
  officeId: string;
}
export interface OfficeSnap {
  id: string;
  ownerId: string;
  wallColor: string;
  floorColor: string;
  doorClosed: boolean;
  unreadNotes: number;
  work: CurrentWork | null;
  workRaw: string;
}

export const live = {
  players: new Map<string, PlayerSnap>(),
  furniture: new Map<string, FurnSnap>(),
  offices: new Map<string, OfficeSnap>(),
};

const WS_PROTOCOL = location.protocol === 'https:' ? 'wss' : 'ws';
/** En producción todo va por el mismo origen; en desarrollo el multijugador tiene su puerto. */
const SERVER_URL: string = import.meta.env.PROD
  ? `${WS_PROTOCOL}://${location.host}`
  : import.meta.env.VITE_SERVER_URL || `${WS_PROTOCOL}://${location.hostname}:2567`;

/** Las acciones viven en actions.ts, que importa este módulo: se conectan al arrancar. */
export const meetingActions: { accept?: (m: MeetingInfo) => void; back?: () => void } = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let room: Room<any> | null = null;
let layoutVersion = -1;
let staticSig = '';
let leavingOnPurpose = false;

export function send<T extends ClientMessageType>(type: T, payload: ClientMessage<T>): void {
  room?.send(type, payload);
}

export function myPlayer(): PlayerSnap | undefined {
  const sid = useUi.getState().mySid;
  return sid ? live.players.get(sid) : undefined;
}

export function playerByUser(userId: string): PlayerSnap | undefined {
  for (const p of live.players.values()) if (p.userId === userId) return p;
  return undefined;
}

export async function refreshBuilding(): Promise<void> {
  const b = await api<{ floors: BuildingFloor[]; cells: CellInfo[] }>('GET', '/building');
  useUi.getState().set({ building: b });
}

export async function refreshInbox(): Promise<void> {
  const [notes, knocks] = await Promise.all([
    api<Array<{ readAt: string | null }>>('GET', '/notes'),
    api<unknown[]>('GET', '/knocks/queued'),
  ]);
  useUi.getState().set({ unreadNotes: notes.filter((n) => !n.readAt).length, queuedKnocks: knocks.length });
}

export async function refreshDeliveries(): Promise<void> {
  useUi.getState().set({ deliveries: await api<DeliveryInfo[]>('GET', '/deliveries') });
}

export async function refreshMeetings(): Promise<void> {
  useUi.getState().set({ meetings: await api<MeetingInfo[]>('GET', '/meetings') });
}

/** La escena se suscribe aquí para animar la caja antes de que cambie la lista. */
let onDeliveryMoved: ((d: DeliveryInfo, previous: DeliveryStatus | null) => void) | null = null;
export function setDeliveryListener(fn: typeof onDeliveryMoved): void {
  onDeliveryMoved = fn;
}

/** Aviso solo para quien le importa: QA cuando llega una caja, la célula cuando se resuelve la suya. */
function deliveryToast(d: DeliveryInfo, previous: DeliveryStatus | null): void {
  const ui = useUi.getState();
  const me = ui.me;
  if (!me) return;
  const open = { label: 'Ver', run: () => useUi.getState().openPanel('deliveries') };
  const arrives = d.status === 'SENT' && (previous === null || previous === 'RETURNED');
  if (arrives && me.cellType === 'QA') {
    chime();
    ui.toast({
      title: `Llegó una caja de ${d.fromCell.name}`,
      text: `${d.externalId}: ${d.title}`,
      icon: 'box',
      actions: [open],
    });
  } else if (previous && me.cell?.id === d.fromCell.id && d.status === 'APPROVED') {
    chime();
    ui.toast({
      title: `QA aprobó ${d.externalId}`,
      text: `${d.title}. Lista para desplegar.`,
      icon: 'box',
      actions: [open],
    });
  } else if (previous && me.cell?.id === d.fromCell.id && d.status === 'RETURNED') {
    chime();
    ui.toast({
      title: `QA devolvió ${d.externalId}`,
      text: d.note ?? d.title,
      icon: 'box',
      actions: [open],
    });
  } else if (previous && d.status === 'DEPLOYED' && (me.cell?.id === d.fromCell.id || me.cellType === 'QA')) {
    chime();
    ui.toast({ title: `${d.externalId} desplegada`, text: d.title, icon: 'box', actions: [open] });
  }
}

async function reloadFloorInfo(floorId: string): Promise<void> {
  const info = await api<FloorInfo>('GET', `/floors/${floorId}`);
  const s = useUi.getState();
  s.set({ floor: info, staticVersion: s.staticVersion + 1 });
}

/** Entra a un piso. Si ya estaba en otro, sale primero. `spawn` lo deja en la puerta de alguien. */
export async function enterFloor(
  floorId: string,
  spawn?: { kind: 'door'; userId: string },
): Promise<boolean> {
  const ui = useUi.getState();
  const prev = ui.floor;
  const target = ui.building?.floors.find((f) => f.id === floorId);
  const up = (target?.level ?? 0) >= (prev?.level ?? 0);
  ui.set({
    transition: {
      title: prev
        ? prev.id === floorId
          ? 'Caminando…'
          : `${up ? 'Subiendo' : 'Bajando'} a ${target?.name ?? floorId}`
        : 'Entrando a La Ofi…',
      sub: target
        ? `Piso ${target.level}${target.cell ? ` · Célula ${target.cell.name}` : ' · Zonas comunes'}`
        : '',
    },
    conn: 'connecting',
    connError: null,
  });
  if (ui.panel?.kind === 'edit') ui.closePanel();
  try {
    const [info, { token }] = await Promise.all([
      api<FloorInfo>('GET', `/floors/${floorId}`),
      api<{ token: string }>('POST', '/auth/room-token'),
    ]);
    if (room) {
      leavingOnPurpose = true;
      await room.leave().catch(() => undefined);
      leavingOnPurpose = false;
    }
    live.players.clear();
    live.furniture.clear();
    live.offices.clear();
    staticSig = '';
    layoutVersion = -1;
    const r = await new Client(SERVER_URL).joinOrCreate(FLOOR_ROOM, { floorId, token, spawn });
    room = r;
    useUi.getState().set({
      floor: info,
      mySid: r.sessionId,
      conn: 'connected',
      roomId: null,
      staticVersion: useUi.getState().staticVersion + 1,
    });
    wire(r, floorId);
    void onFloorJoined(floorId);
    await new Promise((res) => setTimeout(res, 250));
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    useUi.getState().set({ conn: room ? 'connected' : 'error', connError: room ? null : msg });
    useUi.getState().toast({ title: 'No pude entrar a ese piso', text: msg, icon: 'lock' });
    return false;
  } finally {
    useUi.getState().set({ transition: null });
    void refreshBuilding().catch(() => undefined);
  }
}

export async function leaveFloor(): Promise<void> {
  if (!room) return;
  leavingOnPurpose = true;
  await room.leave().catch(() => undefined);
  leavingOnPurpose = false;
  room = null;
  live.players.clear();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wire(r: Room<any>, floorId: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  r.onStateChange((state: any) => sync(state, floorId));
  r.onLeave((code: number) => {
    if (room !== r) return;
    room = null;
    if (leavingOnPurpose) return;
    live.players.clear();
    const ui = useUi.getState();
    ui.set({
      conn: 'error',
      connError: code === 4001 ? 'Abriste La Ofi en otra pestaña.' : 'Se perdió la conexión con el servidor.',
      peopleVersion: ui.peopleVersion + 1,
    });
  });
  const on = <T extends ServerEventType>(type: T, fn: (p: ServerEvents[T]) => void) => r.onMessage(type, fn);
  const ui = () => useUi.getState();

  on('move_rejected', () =>
    ui().toast({
      title: 'No hay camino',
      text: 'Ese lugar está cerrado o bloqueado por muebles.',
      icon: 'x',
      timeout: 2600,
    }),
  );
  on('action_rejected', ({ action, reason }) =>
    ui().toast({ title: 'No se pudo', text: rejectText(action, reason), icon: 'x', timeout: 3200 }),
  );
  on('knock_received', (k) => {
    if (k.silent) {
      ui().set({ queuedKnocks: ui().queuedKnocks + 1 });
      return;
    }
    knockSound();
    const answer = (response: 'ENTER' | 'WAIT_10' | 'NOT_NOW') => () => {
      send('knock_response', { knockId: k.knockId, response });
      ui().dismiss(id);
    };
    const id = ui().toast({
      title: `${firstName(k.fromName)} toca tu puerta`,
      text: '¿Qué le respondes?',
      icon: 'knock',
      timeout: 30000,
      actions: [
        { label: 'Pasa', primary: true, run: answer('ENTER') },
        { label: 'Dame 10 min', run: answer('WAIT_10') },
        { label: 'Ahora no', run: answer('NOT_NOW') },
      ],
    });
  });
  on('knock_sent', (k) => {
    knockSound();
    if (k.queued)
      ui().toast({
        title: `${firstName(k.toName)} ${k.status === 'FOCUS' ? 'está en foco' : 'no está'}`,
        text: 'Tu toque quedó en su bandeja como aviso silencioso.',
        icon: 'moon',
      });
    else
      ui().toast({
        title: 'Toc toc',
        text: `Esperando a que ${firstName(k.toName)} responda…`,
        icon: 'knock',
        timeout: 4000,
      });
  });
  on('knock_answered', (k) => {
    const n = firstName(k.byName);
    if (k.response === 'ENTER')
      ui().toast({ title: `${n}: “Pasa”`, text: 'La puerta está abierta. Puedes entrar.', icon: 'knock' });
    else if (k.response === 'WAIT_10')
      ui().toast({
        title: `${n}: “Dame 10 min”`,
        text: 'Te avisará cuando esté libre. Mientras, puedes dejarle un post-it.',
        icon: 'knock',
      });
    else ui().toast({ title: `${n}: “Ahora no”`, text: 'Tu toque quedó registrado.', icon: 'knock' });
  });
  on('note_received', (n) => {
    chime();
    ui().set({ unreadNotes: ui().unreadNotes + 1 });
    ui().toast({
      title: `Post-it de ${firstName(n.fromName)}`,
      text: n.text.length > 90 ? `${n.text.slice(0, 90)}…` : n.text,
      icon: 'note',
      actions: [{ label: 'Leer', run: () => ui().openPanel('notes') }],
    });
  });
  on('note_sent', ({ toName }) =>
    ui().toast({
      title: 'Post-it pegado',
      text: `Quedó en el escritorio de ${firstName(toName)}.`,
      icon: 'note',
    }),
  );
  on('delivery_update', ({ delivery, previous }) => {
    onDeliveryMoved?.(delivery, previous);
    const rest = ui().deliveries.filter((d) => d.id !== delivery.id);
    ui().set({ deliveries: [delivery, ...rest] });
    deliveryToast(delivery, previous);
  });
  on('deliveries_reset', () => void refreshDeliveries());
  on('meeting_starting', ({ meeting }) => {
    chime();
    void refreshMeetings();
    const start = new Date(meeting.startsAt).toLocaleTimeString('es-CO', {
      hour: 'numeric',
      minute: '2-digit',
    });
    ui().toast({
      title: `Tu reunión ${meeting.title} empieza: ¿vamos?`,
      text: `${start} · ${meeting.roomName}`,
      icon: 'calendar',
      timeout: 60_000,
      actions: [
        { label: 'Vamos', primary: true, run: () => meetingActions.accept?.(meeting) },
        { label: 'Ahora no', run: () => undefined },
      ],
    });
  });
  on('meeting_ended', ({ meeting }) => {
    void refreshMeetings();
    if (ui().activeMeeting?.id !== meeting.id) return;
    ui().set({ activeMeeting: null });
    ui().toast({
      title: `Terminó ${meeting.title}`,
      text: '¿Volvemos a tu oficina?',
      icon: 'calendar',
      timeout: 30_000,
      actions: [
        { label: 'Volver', primary: true, run: () => meetingActions.back?.() },
        { label: 'Me quedo', run: () => undefined },
      ],
    });
  });
  on('ptt', (p) => onPtt(p));
  on('floor_locked', () => {
    ui().toast({
      title: 'Este piso se cerró',
      text: 'El admin cerró el piso a visitas. Te llevo al Lobby.',
      icon: 'lock',
    });
    setTimeout(() => void enterFloor('lobby'), 600);
  });
}

function rejectText(action: string, reason: string): string {
  const m: Record<string, string> = {
    too_far: 'Acércate a su puerta para tocar.',
    office_not_here: 'Su oficina no queda en este piso.',
    outside_office: 'Coloca el mueble dentro de tu oficina.',
    blocks_door: 'Ese mueble taparía la entrada.',
    overlaps: 'Ahí ya hay otro mueble.',
    occupied: 'Hay alguien parado ahí.',
    forbidden: 'Solo el dueño puede editar esta oficina.',
    no_office: 'No tienes oficina en este piso.',
    not_in_room: 'Tienes que estar dentro de una sala.',
  };
  return m[reason] ?? `No se pudo (${action}: ${reason}).`;
}

function parseWork(raw: string): CurrentWork | null {
  if (!raw) return null;
  try {
    return parseCurrentWork(JSON.parse(raw));
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sync(state: any, floorId: string): void {
  const ui = useUi.getState();
  let peopleChanged = false;
  const seen = new Set<string>();
  state.players?.forEach((p: Record<string, unknown>, sid: string) => {
    seen.add(sid);
    const prev = live.players.get(sid);
    const avatarRaw = String(p.avatar ?? '');
    let avatar = prev?.avatar;
    if (!prev || prev.avatarRaw !== avatarRaw) {
      try {
        avatar = parseAvatar(JSON.parse(avatarRaw));
      } catch {
        avatar = parseAvatar(null);
      }
    }
    const next: PlayerSnap = {
      sid,
      userId: String(p.userId),
      name: String(p.name),
      cellId: String(p.cellId ?? ''),
      avatar: avatar!,
      avatarRaw,
      x: Number(p.x),
      y: Number(p.y),
      moving: Boolean(p.moving),
      status: p.status as Status,
      voiceMode: p.voiceMode as VoiceMode,
      isVisitor: Boolean(p.isVisitor),
      roomId: String(p.roomId ?? ''),
      talking: Boolean(p.talking),
    };
    if (
      !prev ||
      prev.status !== next.status ||
      prev.voiceMode !== next.voiceMode ||
      prev.isVisitor !== next.isVisitor ||
      prev.roomId !== next.roomId ||
      prev.talking !== next.talking ||
      prev.name !== next.name ||
      prev.avatarRaw !== avatarRaw
    )
      peopleChanged = true;
    live.players.set(sid, next);
  });
  for (const sid of [...live.players.keys()])
    if (!seen.has(sid)) {
      live.players.delete(sid);
      peopleChanged = true;
    }

  live.furniture.clear();
  state.furniture?.forEach((f: Record<string, unknown>, id: string) =>
    live.furniture.set(id, {
      id,
      key: f.key as FurnitureKey,
      x: Number(f.x),
      y: Number(f.y),
      rot: Number(f.rot) as Rotation,
      color: String(f.color),
      officeId: String(f.officeId ?? ''),
    }),
  );
  live.offices.clear();
  state.offices?.forEach((o: Record<string, unknown>, id: string) =>
    live.offices.set(id, {
      id,
      ownerId: String(o.ownerId),
      wallColor: String(o.wallColor ?? ''),
      floorColor: String(o.floorColor ?? ''),
      doorClosed: Boolean(o.doorClosed),
      unreadNotes: Number(o.unreadNotes),
      work: parseWork(String(o.work ?? '')),
      workRaw: String(o.work ?? ''),
    }),
  );
  const sig = JSON.stringify([...live.furniture.values()]) + JSON.stringify([...live.offices.values()]);
  const patch: Partial<ReturnType<typeof useUi.getState>> = {};
  if (sig !== staticSig) {
    staticSig = sig;
    patch.staticVersion = ui.staticVersion + 1;
  }
  if (peopleChanged) patch.peopleVersion = ui.peopleVersion + 1;
  const me = ui.mySid ? live.players.get(ui.mySid) : undefined;
  const roomId = me?.roomId || null;
  if (roomId !== ui.roomId) {
    patch.roomId = roomId;
    onRoomChanged(roomId);
  }
  if (Object.keys(patch).length) ui.set(patch);
  const lv = Number(state.layoutVersion ?? 0);
  if (layoutVersion !== -1 && lv !== layoutVersion) void reloadFloorInfo(floorId);
  layoutVersion = lv;
}

// ---------------------------------------------------------------- sonidos cortos
let actx: AudioContext | null = null;
export function initAudio(): void {
  if (!actx) {
    try {
      actx = new AudioContext();
    } catch {
      actx = null;
    }
  }
}
export function knockSound(): void {
  if (!actx) return;
  const t0 = actx.currentTime;
  for (const i of [0, 1]) {
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'triangle';
    o.frequency.value = 180;
    g.gain.setValueAtTime(0.0001, t0 + i * 0.16);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.16 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.12);
    o.connect(g).connect(actx.destination);
    o.start(t0 + i * 0.16);
    o.stop(t0 + i * 0.16 + 0.14);
  }
}
export function chime(): void {
  if (!actx) return;
  const t0 = actx.currentTime;
  [660, 880].forEach((f, i) => {
    const o = actx!.createOscillator();
    const g = actx!.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + i * 0.12 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.12 + 0.35);
    o.connect(g).connect(actx!.destination);
    o.start(t0 + i * 0.12);
    o.stop(t0 + i * 0.12 + 0.4);
  });
}

// Gancho para pruebas e2e: permite caminar sin depender de coordenadas de pantalla.
if (import.meta.env.DEV || import.meta.env.VITE_E2E) {
  (window as unknown as { __laofi: unknown }).__laofi = {
    move: (x: number, y: number) => send('move', { x, y }),
    me: () => myPlayer(),
    players: () => [...live.players.values()],
    offices: () => [...live.offices.values()],
    floor: () => useUi.getState().floor,
  };
}
