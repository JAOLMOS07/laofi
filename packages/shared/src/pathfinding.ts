import { type Grid, type Tile, edgeBlocked, edgeKey, isWalkable } from './grid.js';

const SQRT2 = Math.SQRT2;
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Heurística octile: exacta para movimiento en 8 direcciones con costo diagonal √2. */
function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * Paso permitido: destino caminable, sin cruzar paredes ni puertas cerradas
 * y, si es diagonal, sin cortar esquinas (ambos caminos ortogonales deben estar libres).
 */
export function canStep(grid: Grid, x: number, y: number, dx: number, dy: number): boolean {
  if (!isWalkable(grid, x + dx, y + dy)) return false;
  if (dx !== 0 && dy !== 0) {
    return (
      canStep(grid, x, y, dx, 0) &&
      canStep(grid, x + dx, y, 0, dy) &&
      canStep(grid, x, y, 0, dy) &&
      canStep(grid, x, y + dy, dx, 0)
    );
  }
  return !edgeBlocked(grid, edgeKey(x, y, dx, dy));
}

/** Montículo binario mínimo para la lista abierta. */
class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, p: number): void {
    this.items.push(item);
    this.prio.push(p);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent]! <= this.prio[i]!) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): number {
    const top = this.items[0]!;
    const lastItem = this.items.pop()!;
    const lastPrio = this.prio.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.prio[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.prio[l]! < this.prio[m]!) m = l;
        if (r < this.items.length && this.prio[r]! < this.prio[m]!) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
    [this.prio[a], this.prio[b]] = [this.prio[b]!, this.prio[a]!];
  }
}

/**
 * A* en grilla con 8 direcciones y sin cortar esquinas.
 * Devuelve las baldosas a recorrer SIN incluir la de inicio, o `null` si no hay camino.
 * Si inicio y destino coinciden devuelve `[]`.
 */
export function findPath(grid: Grid, start: Tile, goal: Tile): Tile[] | null {
  if (!isWalkable(grid, goal.x, goal.y)) return null;
  if (start.x === goal.x && start.y === goal.y) return [];
  const w = grid.width;
  const n = w * grid.depth;
  const g = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const startIdx = start.y * w + start.x;
  const goalIdx = goal.y * w + goal.x;
  const open = new MinHeap();
  g[startIdx] = 0;
  open.push(startIdx, octile(start.x, start.y, goal.x, goal.y));

  while (open.size > 0) {
    const cur = open.pop();
    if (cur === goalIdx) {
      const path: Tile[] = [];
      for (let c = cur; c !== startIdx; c = came[c]!) path.push({ x: c % w, y: Math.floor(c / w) });
      return path.reverse();
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    for (const [dx, dy] of DIRS) {
      if (!canStep(grid, cx, cy, dx, dy)) continue;
      const nIdx = (cy + dy) * w + (cx + dx);
      if (closed[nIdx]) continue;
      const ng = g[cur]! + (dx !== 0 && dy !== 0 ? SQRT2 : 1);
      if (ng < g[nIdx]!) {
        g[nIdx] = ng;
        came[nIdx] = cur;
        open.push(nIdx, ng + octile(cx + dx, cy + dy, goal.x, goal.y));
      }
    }
  }
  return null;
}
