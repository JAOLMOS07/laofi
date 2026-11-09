import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OFFICE_HOURS,
  type OfficeSpec,
  type PlacedItem,
  type RoomSpec,
  isWithinOfficeHours,
  parseOfficeHours,
  planResidents,
} from '../src/index.js';

const item = (
  id: string,
  key: PlacedItem['key'],
  x: number,
  y: number,
  officeId: string | null,
): PlacedItem => ({
  id,
  key,
  x,
  y,
  rot: 0,
  color: '#999999',
  officeId,
});

const offices: OfficeSpec[] = [
  { id: 'o1', ownerId: 'ana', x: 0, y: 0, w: 6, d: 5, door: { side: 's', at: 2 } },
  { id: 'o2', ownerId: 'beto', x: 7, y: 0, w: 6, d: 5, door: { side: 's', at: 9 } },
];
const rooms: RoomSpec[] = [
  { id: 'sala', name: 'Sala', kind: 'CELL', x: 20, y: 0, w: 6, d: 6, door: { side: 'w', at: 3 } },
];
const furniture: PlacedItem[] = [
  item('d1', 'desk', 1, 1, 'o1'),
  item('c1', 'chair', 1, 2, 'o1'),
  item('s1', 'sofa', 3, 4, 'o1'),
  item('d2', 'desk', 8, 1, 'o2'),
  item('c2', 'chair', 8, 2, 'o2'),
  item('cafe', 'coffee', 15, 10, null),
  item('mesa', 'table', 15, 12, null),
  item('cc1', 'chair', 14, 12, null),
  item('cc2', 'chair', 17, 12, null),
  item('sc1', 'chair', 21, 2, null),
];

describe('planResidents', () => {
  it('quien está desarrollando escribe sentado en la silla de su escritorio', () => {
    const [p] = planResidents({ offices, rooms, furniture, people: [{ userId: 'ana', status: 'BUSY' }] });
    expect(p).toMatchObject({ userId: 'ana', x: 1.5, y: 2.5, seated: true, activity: 'typing' });
  });

  it('a la hora del almuerzo se sientan en el comedor, cada uno en su silla', () => {
    const plan = planResidents({
      offices,
      rooms,
      furniture,
      people: [
        { userId: 'ana', status: 'LUNCH' },
        { userId: 'beto', status: 'LUNCH' },
      ],
    });
    const seats = plan.map((p) => `${p.x},${p.y}`);
    expect(plan.every((p) => p.activity === 'lunch' && p.seated)).toBe(true);
    expect(new Set(seats).size).toBe(2);
    expect(seats.every((s) => ['14.5,12.5', '17.5,12.5'].includes(s))).toBe(true);
  });

  it('sin puesto libre en el comedor almuerza en su escritorio', () => {
    const plan = planResidents({
      offices,
      rooms,
      furniture,
      people: [{ userId: 'ana', status: 'LUNCH' }],
      taken: new Set(['14,12', '17,12']),
    });
    expect(plan[0]).toMatchObject({ x: 1.5, y: 2.5, activity: 'lunch' });
  });

  it('en reunión va a la sala y ausente descansa en su sofá', () => {
    const plan = planResidents({
      offices,
      rooms,
      furniture,
      people: [
        { userId: 'beto', status: 'MEETING' },
        { userId: 'ana', status: 'AWAY' },
      ],
    });
    expect(plan.find((p) => p.userId === 'beto')).toMatchObject({ x: 21.5, y: 2.5, activity: 'meeting' });
    expect(plan.find((p) => p.userId === 'ana')).toMatchObject({ y: 4.5, activity: 'resting' });
  });
});

describe('horario de oficina', () => {
  // 2026-11-09 es lunes. Bogotá es UTC-5.
  it('lunes 10:00 en Bogotá está dentro; 19:00 y domingo no', () => {
    expect(isWithinOfficeHours(DEFAULT_OFFICE_HOURS, new Date('2026-11-09T15:00:00Z'))).toBe(true);
    expect(isWithinOfficeHours(DEFAULT_OFFICE_HOURS, new Date('2026-11-10T00:00:00Z'))).toBe(false);
    expect(isWithinOfficeHours(DEFAULT_OFFICE_HOURS, new Date('2026-11-08T15:00:00Z'))).toBe(false);
  });

  it('un horario inválido vuelve al de por defecto', () => {
    expect(parseOfficeHours({ start: '18:00', end: '08:00', days: [1], timeZone: 'America/Bogota' })).toEqual(
      DEFAULT_OFFICE_HOURS,
    );
    expect(parseOfficeHours(null)).toEqual(DEFAULT_OFFICE_HOURS);
  });
});

describe('ausencias', () => {
  it('sabe si una ausencia viene, está en curso o ya pasó', async () => {
    const { absencePhase, shortDay } = await import('../src/index.js');
    const a = { from: '2026-11-10', until: '2026-11-20', reason: 'Vacaciones' };
    expect(absencePhase(a, '2026-11-09')).toBe('upcoming');
    expect(absencePhase(a, '2026-11-20')).toBe('active');
    expect(absencePhase(a, '2026-11-21')).toBe('over');
    expect(shortDay('2026-11-20')).toBe('20 nov');
  });
});
