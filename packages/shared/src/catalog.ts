/** Catálogo de muebles. La huella es en baldosas con rotación 0. */
export interface CatalogItem {
  name: string;
  w: number;
  d: number;
  /** Si bloquea el paso. Sillas y alfombras no bloquean. */
  block: boolean;
  colorable: boolean;
  /** Si aparece en el catálogo del modo edición de oficinas. */
  editable: boolean;
  color: string;
}

export const CATALOG = {
  desk: { name: 'Escritorio', w: 2, d: 1, block: true, colorable: true, editable: true, color: '#b98a5e' },
  chair: { name: 'Silla', w: 1, d: 1, block: false, colorable: true, editable: true, color: '#3f5a73' },
  plant: { name: 'Planta', w: 1, d: 1, block: true, colorable: true, editable: true, color: '#5c9a5a' },
  shelf: { name: 'Estante', w: 2, d: 1, block: true, colorable: true, editable: true, color: '#a77b55' },
  sofa: { name: 'Sofá', w: 2, d: 1, block: true, colorable: true, editable: true, color: '#7a8fb3' },
  rug: { name: 'Alfombra', w: 2, d: 2, block: false, colorable: true, editable: true, color: '#d98f6c' },
  lamp: { name: 'Lámpara', w: 1, d: 1, block: true, colorable: true, editable: true, color: '#f2c14e' },
  frame: { name: 'Cuadro', w: 1, d: 1, block: true, colorable: true, editable: true, color: '#e07a5f' },
  table: { name: 'Mesa', w: 2, d: 2, block: true, colorable: true, editable: true, color: '#c9a27a' },
  whiteboard: {
    name: 'Tablero',
    w: 2,
    d: 1,
    block: true,
    colorable: false,
    editable: true,
    color: '#fbfbf8',
  },
  coffee: { name: 'Cafetera', w: 1, d: 1, block: true, colorable: false, editable: false, color: '#d7cbb8' },
  tv: { name: 'Pantalla', w: 2, d: 1, block: true, colorable: false, editable: false, color: '#5a5f6b' },
  bench: { name: 'Banca', w: 3, d: 1, block: true, colorable: true, editable: false, color: '#a0785a' },
  reception: {
    name: 'Recepción',
    w: 3,
    d: 1,
    block: true,
    colorable: true,
    editable: false,
    color: '#6b7f99',
  },
  directory: {
    name: 'Directorio',
    w: 2,
    d: 1,
    block: true,
    colorable: false,
    editable: false,
    color: '#2b2f38',
  },
} as const satisfies Record<string, CatalogItem>;

export type FurnitureKey = keyof typeof CATALOG;
export const FURNITURE_KEYS = Object.keys(CATALOG) as FurnitureKey[];
export type Rotation = 0 | 90 | 180 | 270;

export function isFurnitureKey(k: string): k is FurnitureKey {
  return k in CATALOG;
}

export function footprint(key: FurnitureKey, rot: Rotation): { w: number; d: number } {
  const c = CATALOG[key];
  return rot % 180 === 0 ? { w: c.w, d: c.d } : { w: c.d, d: c.w };
}
