import { describe, expect, it } from 'vitest';
import {
  buildFloorGeometry,
  canEditOffice,
  doorEdge,
  doorOutside,
  findPath,
  type OfficeSpec,
  type PlacedItem,
  validatePlacement,
} from '../src/index.js';

const office: OfficeSpec = { id: 'o1', ownerId: 'ana', x: 0, y: 0, w: 6, d: 5, door: { side: 's', at: 2 } };
const layout = { width: 12, depth: 10, spawn: { x: 6, y: 8 }, elevator: { x: 6, y: 8 } };

describe('buildFloorGeometry', () => {
  it('cierra la oficina con paredes salvo en la puerta', () => {
    const g = buildFloorGeometry(layout, [office], [], []);
    expect(g.grid.walls.has('h:1:5')).toBe(true);
    expect(g.grid.walls.has(doorEdge(office))).toBe(false);
    expect(g.doors.get('h:2:5')).toBe('o1');
    const path = findPath(g.grid, { x: 8, y: 8 }, { x: 3, y: 2 })!;
    expect(path).not.toBeNull();
    expect(path).toContainEqual({ x: 2, y: 4 }); // entra por la puerta
  });

  it('una puerta cerrada deja la oficina inaccesible', () => {
    const g = buildFloorGeometry(layout, [office], [], []);
    g.grid.closedDoors.add(doorEdge(office));
    expect(findPath(g.grid, { x: 8, y: 8 }, { x: 3, y: 2 })).toBeNull();
    expect(findPath(g.grid, { x: 8, y: 8 }, doorOutside(office))).not.toBeNull();
  });
});

describe('validatePlacement', () => {
  const existing: PlacedItem[] = [
    { id: 'd1', key: 'desk', x: 1, y: 1, rot: 0, color: '#000000', officeId: 'o1' },
  ];
  it('acepta un mueble libre dentro de la oficina', () => {
    expect(validatePlacement(office, { key: 'plant', x: 5, y: 0, rot: 0 }, existing)).toBeNull();
  });
  it('rechaza fuera de la oficina, sobre la puerta o encima de otro mueble', () => {
    expect(validatePlacement(office, { key: 'sofa', x: 5, y: 0, rot: 0 }, existing)).toBe('outside_office');
    expect(validatePlacement(office, { key: 'plant', x: 2, y: 4, rot: 0 }, existing)).toBe('blocks_door');
    expect(validatePlacement(office, { key: 'plant', x: 2, y: 1, rot: 0 }, existing)).toBe('overlaps');
  });
  it('permite una alfombra debajo de un escritorio y rotar sin chocar consigo mismo', () => {
    expect(validatePlacement(office, { key: 'rug', x: 1, y: 1, rot: 0 }, existing)).toBeNull();
    expect(validatePlacement(office, { key: 'desk', x: 1, y: 1, rot: 90 }, existing, 'd1')).toBeNull();
  });
});

describe('canEditOffice', () => {
  it('solo el dueño puede editar', () => {
    expect(canEditOffice('ana', office)).toBe(true);
    expect(canEditOffice('beto', office)).toBe(false);
    expect(canEditOffice('ana', { ownerId: null })).toBe(false);
  });
});
