/** Acciones de alto nivel que combinan red, escena e interfaz (ir a una puerta, tocar, cambiar de piso). */
import { type DirectoryEntry, type Me, type MeetingInfo, doorInside, doorOutside } from '@laofi/shared';
import { api } from './net/api';
import {
  enterFloor,
  meetingActions,
  myPlayer,
  refreshBuilding,
  refreshDeliveries,
  refreshInbox,
  refreshMeetings,
  send,
} from './net/floor';
import { getEngine } from './scene/engine';
import { firstName, useUi } from './state/store';

let directoryCache: { at: number; list: DirectoryEntry[] } | null = null;

export async function directory(force = false): Promise<DirectoryEntry[]> {
  if (!force && directoryCache && Date.now() - directoryCache.at < 5000) return directoryCache.list;
  const list = await api<DirectoryEntry[]>('GET', '/directory');
  directoryCache = { at: Date.now(), list };
  return list;
}

/** Espera a que tu avatar llegue cerca de una baldosa (o se rinde a los 20 s). */
function whenArrived(x: number, y: number, ms = 20000): Promise<boolean> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const p = myPlayer();
      if (p && !p.moving && Math.hypot(p.x - (x + 0.5), p.y - (y + 0.5)) < 1.2) return resolve(true);
      if (Date.now() - t0 > ms) return resolve(false);
      setTimeout(tick, 120);
    };
    setTimeout(tick, 200);
  });
}

/** Camina hasta la puerta de alguien, cambiando de piso si hace falta. */
export async function goToDoor(userId: string): Promise<boolean> {
  const ui = useUi.getState();
  const person = (await directory()).find((d) => d.id === userId);
  if (!person?.homeFloorId) {
    ui.toast({ title: 'Sin oficina', text: 'Esta persona todavía no tiene oficina asignada.', icon: 'x' });
    return false;
  }
  if (ui.floor?.id !== person.homeFloorId) {
    const ok = await enterFloor(person.homeFloorId, { kind: 'door', userId });
    if (!ok) return false;
  }
  const office = useUi.getState().floor?.offices.find((o) => o.ownerId === userId);
  if (!office) return false;
  const out = doorOutside(office);
  const p = myPlayer();
  if (p && Math.hypot(p.x - (out.x + 0.5), p.y - (out.y + 0.5)) < 1.2) return true;
  getEngine()?.walkTo(out.x, out.y);
  return whenArrived(out.x, out.y);
}

export async function knockOn(userId: string): Promise<void> {
  useUi.getState().closePanel();
  if (await goToDoor(userId)) send('knock', { toUserId: userId });
}

export async function goToFloor(floorId: string): Promise<void> {
  useUi.getState().closePanel();
  await enterFloor(floorId);
}

export async function goHome(): Promise<void> {
  const me = useUi.getState().me;
  if (!me) return;
  const home = me.homeFloorId ?? 'lobby';
  if (useUi.getState().floor?.id !== home) await enterFloor(home, { kind: 'door', userId: me.id });
}

/** Camina hasta adentro de una sala, cambiando de piso si hace falta. */
export async function goToRoom(roomId: string, floorId: string): Promise<boolean> {
  const ui = useUi.getState();
  ui.closePanel();
  if (ui.floor?.id !== floorId && !(await enterFloor(floorId))) return false;
  const room = useUi.getState().floor?.rooms.find((r) => r.id === roomId);
  if (!room) return false;
  const t = doorInside(room);
  getEngine()?.walkTo(t.x, t.y);
  return whenArrived(t.x, t.y, 30000);
}

export async function acceptMeeting(m: MeetingInfo): Promise<void> {
  useUi.getState().set({ activeMeeting: m });
  await goToRoom(m.roomId, m.floorId);
}

async function backToOffice(): Promise<void> {
  const me = useUi.getState().me;
  if (!me) return;
  await goHome();
  const office = useUi.getState().floor?.offices.find((o) => o.ownerId === me.id);
  if (!office) return;
  const t = doorInside(office);
  getEngine()?.walkTo(t.x, t.y);
}

meetingActions.accept = (m) => void acceptMeeting(m);
meetingActions.back = () => void backToOffice();

/** Arranque después del login. */
export async function startSession(me: Me): Promise<void> {
  const ui = useUi.getState();
  ui.set({ me });
  if (me.mustChangePassword) return;
  await refreshBuilding();
  void refreshDeliveries();
  void refreshMeetings();
  void refreshInbox().then(() => {
    const { unreadNotes, queuedKnocks } = useUi.getState();
    if (unreadNotes || queuedKnocks)
      useUi.getState().toast({
        title: unreadNotes
          ? `Tienes ${unreadNotes} post-it${unreadNotes > 1 ? 's' : ''}`
          : 'Tocaron tu puerta',
        text: queuedKnocks
          ? `${queuedKnocks} toque${queuedKnocks > 1 ? 's' : ''} en cola mientras no estabas.`
          : 'Te dejaron notas en el escritorio.',
        icon: 'note',
        actions: [{ label: 'Ver', run: () => useUi.getState().openPanel('notes') }],
        timeout: 7000,
      });
  });
  const home = me.homeFloorId ?? 'lobby';
  const ok = await enterFloor(home, me.homeFloorId ? { kind: 'door', userId: me.id } : undefined);
  if (ok) {
    const where = useUi.getState().floor;
    useUi.getState().toast({
      title: `Hola, ${firstName(me.name)}`,
      text: `Estás en ${where?.name ?? 'La Ofi'}. Haz clic en el piso para caminar o en alguien para tocarle la puerta.`,
      icon: 'hi',
      timeout: 6000,
    });
    // Tu puerta: entra a tu oficina.
    const office = where?.offices.find((o) => o.ownerId === me.id);
    if (office) {
      const t = doorInside(office);
      getEngine()?.walkTo(t.x, t.y);
    }
  }
}
