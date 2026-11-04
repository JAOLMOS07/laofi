import { CATALOG, type FurnitureKey, type Rotation, footprint } from './catalog.js';
import { type Grid, type Tile, blockRect, createGrid, inBounds } from './grid.js';

export type DoorSide = 'n' | 's' | 'e' | 'w';
export interface Door {
  side: DoorSide;
  /** Columna (lados n/s) o fila (lados e/w) donde está el hueco de la puerta. */
  at: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}
export interface OfficeSpec extends Rect {
  id: string;
  ownerId: string | null;
  door: Door;
}
export interface RoomSpec extends Rect {
  id: string;
  name: string;
  kind: 'CELL' | 'SHARED' | 'AUDITORIUM' | 'CAFETERIA';
  door: Door;
}
export interface PlacedItem {
  id: string;
  key: FurnitureKey;
  x: number;
  y: number;
  rot: Rotation;
  color: string;
  /** Oficina a la que pertenece, o null si es mobiliario común del piso. */
  officeId: string | null;
}
/** Forma del piso guardada en `Floor.layout` (JSON). */
export interface FloorLayout {
  width: number;
  depth: number;
  spawn: Tile;
  elevator: Tile;
}

export interface FloorGeometry {
  grid: Grid;
  /** Clave de borde → id de la oficina o sala a la que da la puerta. */
  doors: Map<string, string>;
  /** Clave de borde → normales hacia afuera de cada espacio que la usa (para el corte de paredes). */
  wallNormals: Map<string, Array<[number, number]>>;
}

/** Borde de la puerta de un espacio. */
export function doorEdge(r: Rect & { door: Door }): string {
  const { side, at } = r.door;
  if (side === 'n') return `h:${at}:${r.y}`;
  if (side === 's') return `h:${at}:${r.y + r.d}`;
  if (side === 'w') return `v:${r.x}:${at}`;
  return `v:${r.x + r.w}:${at}`;
}

/** Baldosa justo afuera de la puerta: donde se para quien toca. */
export function doorOutside(r: Rect & { door: Door }): Tile {
  const { side, at } = r.door;
  if (side === 'n') return { x: at, y: r.y - 1 };
  if (side === 's') return { x: at, y: r.y + r.d };
  if (side === 'w') return { x: r.x - 1, y: at };
  return { x: r.x + r.w, y: at };
}

/** Baldosa justo adentro de la puerta: debe quedar libre de muebles. */
export function doorInside(r: Rect & { door: Door }): Tile {
  const { side, at } = r.door;
  if (side === 'n') return { x: at, y: r.y };
  if (side === 's') return { x: at, y: r.y + r.d - 1 };
  if (side === 'w') return { x: r.x, y: at };
  return { x: r.x + r.w - 1, y: at };
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.d;
}

/** Construye la grilla de un piso: paredes perimetrales, paredes de oficinas y salas, y muebles. */
export function buildFloorGeometry(
  layout: FloorLayout,
  offices: OfficeSpec[],
  rooms: RoomSpec[],
  furniture: PlacedItem[],
  /** Instalaciones fijas que bloquean el paso (muelle, tablero). */
  blocks: Rect[] = [],
): FloorGeometry {
  const grid = createGrid(layout.width, layout.depth);
  const doors = new Map<string, string>();
  const wallNormals = new Map<string, Array<[number, number]>>();
  const addWall = (k: string, n: [number, number]) => {
    grid.walls.add(k);
    const list = wallNormals.get(k) ?? [];
    list.push(n);
    wallNormals.set(k, list);
  };
  const W = layout.width;
  const D = layout.depth;
  for (let x = 0; x < W; x++) {
    addWall(`h:${x}:0`, [0, -1]);
    addWall(`h:${x}:${D}`, [0, 1]);
  }
  for (let y = 0; y < D; y++) {
    addWall(`v:0:${y}`, [-1, 0]);
    addWall(`v:${W}:${y}`, [1, 0]);
  }
  for (const s of [...offices, ...rooms]) {
    for (let x = s.x; x < s.x + s.w; x++) {
      addWall(`h:${x}:${s.y}`, [0, -1]);
      addWall(`h:${x}:${s.y + s.d}`, [0, 1]);
    }
    for (let y = s.y; y < s.y + s.d; y++) {
      addWall(`v:${s.x}:${y}`, [-1, 0]);
      addWall(`v:${s.x + s.w}:${y}`, [1, 0]);
    }
  }
  for (const s of [...offices, ...rooms]) {
    const k = doorEdge(s);
    doors.set(k, s.id);
    grid.walls.delete(k);
  }
  for (const f of furniture) {
    if (!CATALOG[f.key].block) continue;
    const fp = footprint(f.key, f.rot);
    for (let x = f.x; x < f.x + fp.w; x++)
      for (let y = f.y; y < f.y + fp.d; y++) if (inBounds(grid, x, y)) blockRect(grid, x, y, 1, 1);
  }
  for (const b of blocks) blockRect(grid, b.x, b.y, b.w, b.d);
  return { grid, doors, wallNormals };
}

export type PlacementError = 'outside_office' | 'blocks_door' | 'overlaps' | 'unknown_item';

/**
 * Valida que un mueble quepa en una oficina. Lo usan el cliente (vista previa)
 * y el servidor (autoridad). `ignoreId` excluye al propio mueble cuando se mueve o rota.
 */
export function validatePlacement(
  office: OfficeSpec,
  item: { key: FurnitureKey; x: number; y: number; rot: Rotation },
  existing: PlacedItem[],
  ignoreId?: string,
): PlacementError | null {
  if (!(item.key in CATALOG)) return 'unknown_item';
  const fp = footprint(item.key, item.rot);
  const inside = doorInside(office);
  const isRug = item.key === 'rug';
  const others = existing.filter((e) => e.officeId === office.id && e.id !== ignoreId);
  for (let x = item.x; x < item.x + fp.w; x++)
    for (let y = item.y; y < item.y + fp.d; y++) {
      if (!rectContains(office, x, y)) return 'outside_office';
      if (x === inside.x && y === inside.y && CATALOG[item.key].block) return 'blocks_door';
      for (const o of others) {
        const ofp = footprint(o.key, o.rot);
        const hit = x >= o.x && x < o.x + ofp.w && y >= o.y && y < o.y + ofp.d;
        // Las alfombras pueden quedar debajo de otros muebles, pero no sobre otra alfombra.
        if (hit && isRug === (o.key === 'rug')) return 'overlaps';
      }
    }
  return null;
}

/** Regla de permisos: solo el dueño edita su oficina. */
export function canEditOffice(userId: string, office: Pick<OfficeSpec, 'ownerId'>): boolean {
  return office.ownerId !== null && office.ownerId === userId;
}
