import type { Tile } from './grid.js';

export interface MoverState {
  /** Posición continua; el centro de la baldosa (x, y) es (x + 0.5, y + 0.5). */
  x: number;
  y: number;
  /** Baldosas pendientes por recorrer. Se consume desde el inicio. */
  path: Tile[];
}

/**
 * Avanza un avatar a lo largo de su camino. Muta `m` y devuelve `true` si se movió.
 * Es la misma función en servidor (autoridad) y en pruebas.
 */
export function stepAlongPath(m: MoverState, dt: number, speed: number): boolean {
  let budget = speed * dt;
  let moved = false;
  while (budget > 0 && m.path.length > 0) {
    const next = m.path[0]!;
    const tx = next.x + 0.5;
    const ty = next.y + 0.5;
    const dx = tx - m.x;
    const dy = ty - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= budget) {
      m.x = tx;
      m.y = ty;
      m.path.shift();
      budget -= dist;
    } else {
      m.x += (dx / dist) * budget;
      m.y += (dy / dist) * budget;
      budget = 0;
    }
    moved = true;
  }
  return moved;
}
