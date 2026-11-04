export interface Tile {
  x: number;
  y: number;
}

/**
 * Grilla de un piso. `x` va de izquierda a derecha y `y` de fondo a frente
 * (en la escena 3D, `y` de la grilla corresponde al eje Z).
 *
 * Hay dos tipos de obstáculo:
 * - baldosas bloqueadas (muebles), en `blocked`;
 * - paredes entre baldosas, en `walls`, con claves de borde (ver `edgeKey`).
 *   Las puertas cerradas se tratan como paredes mientras estén en `closedDoors`.
 */
export interface Grid {
  readonly width: number;
  readonly depth: number;
  /** 1 = bloqueado (mueble), 0 = caminable. Índice: y * width + x. */
  readonly blocked: Uint8Array;
  readonly walls: Set<string>;
  readonly closedDoors: Set<string>;
}

export function createGrid(width: number, depth: number): Grid {
  if (!Number.isInteger(width) || !Number.isInteger(depth) || width <= 0 || depth <= 0) {
    throw new Error(`Tamaño de grilla inválido: ${width}x${depth}`);
  }
  return { width, depth, blocked: new Uint8Array(width * depth), walls: new Set(), closedDoors: new Set() };
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < grid.width && y < grid.depth;
}

export function isWalkable(grid: Grid, x: number, y: number): boolean {
  return inBounds(grid, x, y) && grid.blocked[y * grid.width + x] === 0;
}

export function setBlocked(grid: Grid, x: number, y: number, blocked = true): void {
  if (!inBounds(grid, x, y)) throw new Error(`Baldosa fuera de la grilla: ${x},${y}`);
  grid.blocked[y * grid.width + x] = blocked ? 1 : 0;
}

/** Bloquea un rectángulo de baldosas (por ejemplo, la huella de un mueble). */
export function blockRect(grid: Grid, x: number, y: number, w: number, d: number): void {
  for (let i = x; i < x + w; i++) for (let j = y; j < y + d; j++) setBlocked(grid, i, j, true);
}

/**
 * Clave del borde que se cruza al pasar de (x, y) a (x + dx, y + dy) en línea recta.
 * `h:x:y` es el borde horizontal sobre la fila y (entre y-1 e y).
 * `v:x:y` es el borde vertical a la izquierda de la columna x (entre x-1 y x).
 */
export function edgeKey(x: number, y: number, dx: number, dy: number): string {
  if (dx === 1) return `v:${x + 1}:${y}`;
  if (dx === -1) return `v:${x}:${y}`;
  if (dy === 1) return `h:${x}:${y + 1}`;
  return `h:${x}:${y}`;
}

export function edgeBlocked(grid: Grid, key: string): boolean {
  return grid.walls.has(key) || grid.closedDoors.has(key);
}

/** Convierte una posición continua (centro de baldosa = n + 0.5) en la baldosa que la contiene. */
export function tileAt(px: number, py: number): Tile {
  return { x: Math.floor(px), y: Math.floor(py) };
}
