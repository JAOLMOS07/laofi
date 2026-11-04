import { describe, expect, it } from 'vitest';
import { blockRect, createGrid, findPath, isWalkable, setBlocked } from '../src/index.js';

describe('findPath', () => {
  it('va en línea recta en una grilla vacía', () => {
    const g = createGrid(5, 5);
    expect(findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 })).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  it('usa diagonales cuando acortan el camino', () => {
    const g = createGrid(5, 5);
    const p = findPath(g, { x: 0, y: 0 }, { x: 3, y: 3 });
    expect(p).toHaveLength(3);
    expect(p?.at(-1)).toEqual({ x: 3, y: 3 });
  });

  it('devuelve [] si inicio y destino son la misma baldosa', () => {
    expect(findPath(createGrid(3, 3), { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });

  it('rodea una pared', () => {
    const g = createGrid(5, 5);
    for (let y = 0; y < 4; y++) setBlocked(g, 2, y);
    const p = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 })!;
    expect(p).not.toBeNull();
    expect(p.every((t) => isWalkable(g, t.x, t.y))).toBe(true);
    expect(p.some((t) => t.y === 4)).toBe(true);
  });

  it('no corta esquinas entre dos bloques en diagonal', () => {
    const g = createGrid(3, 3);
    setBlocked(g, 1, 0);
    setBlocked(g, 0, 1);
    expect(findPath(g, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });

  it('devuelve null si el destino está bloqueado o fuera de la grilla', () => {
    const g = createGrid(4, 4);
    blockRect(g, 2, 2, 2, 2);
    expect(findPath(g, { x: 0, y: 0 }, { x: 3, y: 3 })).toBeNull();
    expect(findPath(g, { x: 0, y: 0 }, { x: 9, y: 9 })).toBeNull();
  });

  it('no atraviesa paredes entre baldosas y sí pasa por la puerta', () => {
    const g = createGrid(3, 3);
    for (let x = 0; x < 3; x++) g.walls.add(`h:${x}:1`);
    expect(findPath(g, { x: 0, y: 0 }, { x: 0, y: 2 })).toBeNull();
    g.walls.delete('h:2:1');
    const p = findPath(g, { x: 0, y: 0 }, { x: 0, y: 2 })!;
    expect(p.some((t) => t.x === 2)).toBe(true);
    g.closedDoors.add('h:2:1');
    expect(findPath(g, { x: 0, y: 0 }, { x: 0, y: 2 })).toBeNull();
  });
});
