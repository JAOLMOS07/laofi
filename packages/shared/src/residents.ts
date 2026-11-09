import type { OfficeSpec, PlacedItem, Rect, RoomSpec } from './building.js';
import { rectContains } from './building.js';
import { type Rotation, footprint } from './catalog.js';
import type { Status } from './messages.js';

/**
 * "Residentes": las personas que no están conectadas pero sí en horario de oficina.
 * Se dibujan quietas en su puesto haciendo algo según su estado: escribiendo en su escritorio,
 * almorzando en el comedor del piso, en la sala de reuniones o descansando en su sofá.
 */
export const RESIDENT_ACTIVITIES = ['typing', 'lunch', 'meeting', 'resting'] as const;
export type ResidentActivity = (typeof RESIDENT_ACTIVITIES)[number];

export const ACTIVITY_LABEL: Record<ResidentActivity, string> = {
  typing: 'Escribiendo…',
  lunch: 'Almorzando',
  meeting: 'En reunión',
  resting: 'Descansando',
};

export interface ResidentPlan {
  userId: string;
  /** Centro de la baldosa (n + 0.5). */
  x: number;
  y: number;
  /** Hacia dónde mira, con la misma convención que las sillas. */
  rot: Rotation;
  seated: boolean;
  activity: ResidentActivity;
}

interface Seat {
  x: number;
  y: number;
  rot: Rotation;
}

const SEAT_KEYS = new Set(['chair', 'sofa', 'bench']);
const key = (x: number, y: number) => `${x},${y}`;

function seatsOf(f: PlacedItem): Seat[] {
  if (!SEAT_KEYS.has(f.key)) return [];
  const fp = footprint(f.key, f.rot);
  const out: Seat[] = [];
  for (let dx = 0; dx < fp.w; dx++)
    for (let dy = 0; dy < fp.d; dy++) out.push({ x: f.x + dx, y: f.y + dy, rot: f.rot });
  return out;
}

const itemRect = (f: PlacedItem): Rect => {
  const fp = footprint(f.key, f.rot);
  return { x: f.x, y: f.y, w: fp.w, d: fp.d };
};

/** Distancia de una baldosa al rectángulo (0 si está dentro). */
function distToRect(x: number, y: number, r: Rect): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w - 1));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.d - 1));
  return Math.hypot(dx, dy);
}

const statusActivity = (s: Status): ResidentActivity =>
  s === 'LUNCH' ? 'lunch' : s === 'MEETING' ? 'meeting' : s === 'AWAY' ? 'resting' : 'typing';

/** Decide dónde y haciendo qué se ve cada persona desconectada de este piso. */
export function planResidents(input: {
  offices: OfficeSpec[];
  rooms: RoomSpec[];
  furniture: PlacedItem[];
  people: Array<{ userId: string; status: Status }>;
  /** Baldosas ocupadas por gente conectada. */
  taken?: Set<string>;
}): ResidentPlan[] {
  const { offices, rooms, furniture } = input;
  const used = new Set(input.taken ?? []);
  const desks = furniture.filter((f) => f.key === 'desk');
  const nearDesk = (s: Seat, officeId: string | null) =>
    desks.some((d) => d.officeId === officeId && distToRect(s.x, s.y, itemRect(d)) <= 1);
  const inside = (s: Seat, list: Rect[]) => list.some((r) => rectContains(r, s.x, s.y));

  // Comedor: asientos comunes fuera de oficinas y salas, que no sean de un escritorio, cerca de la cafetera.
  const coffees = furniture.filter((f) => f.key === 'coffee' && f.officeId === null);
  const coffeeDist = (s: Seat) =>
    coffees.length ? Math.min(...coffees.map((c) => distToRect(s.x, s.y, itemRect(c)))) : 0;
  const lunchSeats = furniture
    .filter((f) => f.officeId === null)
    .flatMap(seatsOf)
    .filter((s) => !inside(s, offices) && !inside(s, rooms) && !nearDesk(s, null))
    .sort((a, b) => coffeeDist(a) - coffeeDist(b));

  // Reuniones: sillas dentro de las salas, primero la de la célula.
  const roomOrder = (s: Seat) => {
    const r = rooms.find((x) => rectContains(x, s.x, s.y));
    return r?.kind === 'CELL' ? 0 : r ? 1 : 9;
  };
  const meetingSeats = furniture
    .filter((f) => f.officeId === null && f.key !== 'sofa')
    .flatMap(seatsOf)
    .filter((s) => inside(s, rooms))
    .sort((a, b) => roomOrder(a) - roomOrder(b));

  const take = (list: Seat[]): Seat | undefined => {
    const s = list.find((x) => !used.has(key(x.x, x.y)));
    if (s) used.add(key(s.x, s.y));
    return s;
  };

  const out: ResidentPlan[] = [];
  const people = [...input.people].sort((a, b) => a.userId.localeCompare(b.userId));
  for (const p of people) {
    const office = offices.find((o) => o.ownerId === p.userId);
    if (!office) continue;
    const mine = furniture.filter((f) => f.officeId === office.id);
    const deskChairs = mine
      .filter((f) => f.key === 'chair')
      .flatMap(seatsOf)
      .sort((a, b) => Number(nearDesk(b, office.id)) - Number(nearDesk(a, office.id)));
    const sofas = mine.filter((f) => f.key === 'sofa').flatMap(seatsOf);
    const activity = statusActivity(p.status);
    const seat =
      (activity === 'lunch' && take(lunchSeats)) ||
      (activity === 'meeting' && take(meetingSeats)) ||
      (activity === 'resting' && take(sofas)) ||
      take(deskChairs) ||
      take(sofas);
    if (seat) {
      out.push({ userId: p.userId, x: seat.x + 0.5, y: seat.y + 0.5, rot: seat.rot, seated: true, activity });
      continue;
    }
    // Oficina sin silla: de pie en el centro.
    out.push({
      userId: p.userId,
      x: office.x + Math.floor(office.w / 2) + 0.5,
      y: office.y + Math.floor(office.d / 2) + 0.5,
      rot: 0,
      seated: false,
      activity,
    });
  }
  return out;
}
