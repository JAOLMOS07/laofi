import {
  type AvatarConfig,
  CATALOG,
  type Door,
  type FloorLayout,
  type FurnitureKey,
  type Rotation,
} from '@laofi/shared';

/**
 * Datos de ejemplo del MVP: un lobby con dos salas comunes y dos pisos de células.
 * Todas las personas son ficticias. La contraseña de desarrollo es la misma para todos.
 */
export const DEV_PASSWORD = 'laofi123';

export interface SeedFurniture {
  key: FurnitureKey;
  x: number;
  y: number;
  rot?: Rotation;
  color?: string;
}
export interface SeedUser {
  email: string;
  name: string;
  cell: string | null;
  title?: string;
  admin?: boolean;
  avatar: AvatarConfig;
}

export const LAYOUT: FloorLayout = {
  width: 30,
  depth: 22,
  spawn: { x: 15, y: 18 },
  elevator: { x: 14, y: 19 },
};

export const CELLS = [
  { id: 'axis', name: 'Axis', type: 'DEV' as const, color: '#e0703f', floorId: 'axis' },
  { id: 'hextech', name: 'Hextech', type: 'DEV' as const, color: '#577590', floorId: 'hextech' },
  { id: 'atlas', name: 'Atlas', type: 'DEV' as const, color: '#2a9d8f', floorId: 'atlas' },
  { id: 'qa', name: 'QA', type: 'QA' as const, color: '#c9962a', floorId: 'qa' },
];

export const FLOORS = [
  { id: 'lobby', name: 'Lobby', level: 1, isCommon: true },
  { id: 'axis', name: 'Piso Axis', level: 2, isCommon: false },
  { id: 'hextech', name: 'Piso Hextech', level: 3, isCommon: false },
  { id: 'atlas', name: 'Piso Atlas', level: 4, isCommon: false },
  { id: 'qa', name: 'Piso QA', level: 5, isCommon: false },
];

const av = (
  skin: string,
  hair: AvatarConfig['hair'],
  hairColor: string,
  shirt: string,
  pants: string,
  accessory: AvatarConfig['accessory'] = 'none',
): AvatarConfig => ({
  skin,
  hair,
  hairColor,
  shirt,
  pants,
  accessory,
});

/**
 * Jhoger, John y Donovan son reales. El resto son nombres de ejemplo para la demo:
 * el admin los cambia o carga a las personas reales desde el panel.
 */
export const USERS: SeedUser[] = [
  {
    email: 'jhoger@laofi.local',
    name: 'Jhoger',
    cell: 'axis',
    admin: true,
    avatar: av('#c68a5e', 'short', '#24170f', '#2f6f62', '#3a3f55'),
  },
  {
    email: 'john@laofi.local',
    name: 'John',
    cell: null,
    title: 'Jefe de desarrollo',
    avatar: av('#eab995', 'short', '#6b4a2b', '#3d405b', '#2b2d42', 'glasses'),
  },
  {
    email: 'donovan@laofi.local',
    name: 'Donovan',
    cell: null,
    title: 'Gerente de tecnologías',
    avatar: av('#a56b43', 'none', '#1b1b1b', '#264653', '#1f2430'),
  },
  {
    email: 'laura@laofi.local',
    name: 'Laura Méndez',
    cell: 'axis',
    avatar: av('#eab995', 'long', '#6b3a1f', '#e07a5f', '#3d405b'),
  },
  {
    email: 'andres@laofi.local',
    name: 'Andrés Rojas',
    cell: 'axis',
    avatar: av('#a56b43', 'cap', '#1b1b1b', '#81b29a', '#2d3142'),
  },
  {
    email: 'camila@laofi.local',
    name: 'Camila Torres',
    cell: 'axis',
    avatar: av('#f1c7a5', 'bun', '#3b2418', '#f2cc8f', '#4a4e69', 'glasses'),
  },
  {
    email: 'santiago@laofi.local',
    name: 'Santiago Pérez',
    cell: 'hextech',
    avatar: av('#d9a47c', 'short', '#4a2c17', '#577590', '#2b2d42', 'headphones'),
  },
  {
    email: 'valentina@laofi.local',
    name: 'Valentina Gómez',
    cell: 'hextech',
    avatar: av('#f1c7a5', 'long', '#c38e4f', '#f28482', '#355070'),
  },
  {
    email: 'mateo@laofi.local',
    name: 'Mateo Díaz',
    cell: 'hextech',
    avatar: av('#8d5a3b', 'short', '#121212', '#e9c46a', '#264653'),
  },
  {
    email: 'isabella@laofi.local',
    name: 'Isabella Castro',
    cell: 'atlas',
    avatar: av('#eab995', 'bun', '#2a1a12', '#9c89b8', '#3d3d3d'),
  },
  {
    email: 'sebastian@laofi.local',
    name: 'Sebastián Ortiz',
    cell: 'atlas',
    avatar: av('#d9a47c', 'cap', '#2b2b2b', '#2a9d8f', '#22223b'),
  },
  {
    email: 'mariana@laofi.local',
    name: 'Mariana López',
    cell: 'atlas',
    avatar: av('#c68a5e', 'long', '#3a2216', '#b56576', '#2d3142'),
  },
  {
    email: 'tomas@laofi.local',
    name: 'Tomás Herrera',
    cell: 'atlas',
    avatar: av('#f1c7a5', 'short', '#8a5a2b', '#6d9dc5', '#3b3b58'),
  },
  {
    email: 'lucia@laofi.local',
    name: 'Lucía Romero',
    cell: 'atlas',
    avatar: av('#8d5a3b', 'bun', '#121212', '#90be6d', '#43485c', 'headphones'),
  },
  {
    email: 'daniela@laofi.local',
    name: 'Daniela Ruiz',
    cell: 'qa',
    avatar: av('#c68a5e', 'long', '#1f140e', '#f4a261', '#2a324b', 'glasses'),
  },
  {
    email: 'felipe@laofi.local',
    name: 'Felipe Navarro',
    cell: 'qa',
    avatar: av('#f1c7a5', 'short', '#8a5a2b', '#6d9dc5', '#3b3b58'),
  },
  {
    email: 'sara@laofi.local',
    name: 'Sara Morales',
    cell: 'qa',
    avatar: av('#b97a52', 'bun', '#3a2216', '#90be6d', '#43485c'),
  },
  {
    email: 'juanpablo@laofi.local',
    name: 'Juan Pablo Vargas',
    cell: 'qa',
    avatar: av('#e2ad85', 'cap', '#2b2b2b', '#b56576', '#22223b'),
  },
];

/** Las oficinas de John y Donovan van en el Lobby. */
export const LOBBY_OFFICE_EMAILS = ['john@laofi.local', 'donovan@laofi.local'];

export interface SeedRoom {
  id: string;
  floorId: string;
  name: string;
  description: string;
  kind: 'CELL' | 'SHARED' | 'AUDITORIUM' | 'CAFETERIA';
  linkEditableByAll?: boolean;
  x: number;
  y: number;
  w: number;
  d: number;
  door: Door;
}

export const ROOMS: SeedRoom[] = [
  {
    id: 'auditorio',
    floorId: 'lobby',
    name: 'Auditorio',
    description: 'Daily general de todos',
    kind: 'AUDITORIUM',
    x: 0,
    y: 0,
    w: 10,
    d: 7,
    door: { side: 's', at: 5 },
  },
  {
    id: 'lideres',
    floorId: 'lobby',
    name: 'Sala de líderes',
    description: 'Líderes de célula con John y Donovan',
    kind: 'SHARED',
    x: 20,
    y: 0,
    w: 10,
    d: 7,
    door: { side: 's', at: 24 },
  },
  {
    id: 'libre',
    floorId: 'lobby',
    name: 'Sala libre',
    description: 'Para reuniones planeadas: pega aquí el link nuevo',
    kind: 'SHARED',
    linkEditableByAll: true,
    x: 24,
    y: 15,
    w: 6,
    d: 7,
    door: { side: 'w', at: 18 },
  },
  ...CELLS.map((c) => ({
    id: `sala-${c.id}`,
    floorId: c.floorId,
    name: `Sala ${c.name}`,
    description: `Daily de ${c.name}`,
    kind: 'CELL' as const,
    x: 24,
    y: 0,
    w: 6,
    d: 8,
    door: { side: 'w' as const, at: 6 },
  })),
];

/** Muebles iniciales de cada oficina (relativos a su esquina). */
export function officeFurniture(x0: number, y0: number, i: number, accent: string): SeedFurniture[] {
  return [
    { key: 'desk', x: x0 + 1, y: y0 + 1, color: ['#b98a5e', '#c9a27a', '#a77b55', '#d4b48c'][i % 4] },
    { key: 'chair', x: x0 + 1, y: y0 + 2, color: accent },
    { key: 'plant', x: x0, y: y0 },
    { key: 'shelf', x: x0 + 3, y: y0 },
    { key: 'lamp', x: x0 + 5, y: y0 },
    { key: 'rug', x: x0 + 3, y: y0 + 2, color: ['#d98f6c', '#8cb8a8', '#c7a6d9', '#e6c27a'][i % 4] },
    { key: 'sofa', x: x0 + 4, y: y0 + 4, color: ['#7a8fb3', '#e07a5f', '#81b29a', '#9c89b8'][(i + 1) % 4] },
    { key: 'frame', x: x0, y: y0 + 3, rot: 90, color: ['#e07a5f', '#2a9d8f', '#f2cc8f', '#577590'][i % 4] },
  ];
}

function meetingFurniture(x0: number, y0: number, accent: string): SeedFurniture[] {
  return [
    { key: 'tv', x: x0 + 2, y: y0 },
    { key: 'table', x: x0 + 2, y: y0 + 3 },
    { key: 'chair', x: x0 + 1, y: y0 + 3, rot: 270, color: accent },
    { key: 'chair', x: x0 + 1, y: y0 + 4, rot: 270, color: accent },
    { key: 'chair', x: x0 + 4, y: y0 + 3, rot: 90, color: accent },
    { key: 'chair', x: x0 + 4, y: y0 + 4, rot: 90, color: accent },
    { key: 'chair', x: x0 + 2, y: y0 + 5, color: accent },
    { key: 'chair', x: x0 + 3, y: y0 + 5, color: accent },
    { key: 'chair', x: x0 + 2, y: y0 + 2, rot: 180, color: accent },
    { key: 'chair', x: x0 + 3, y: y0 + 2, rot: 180, color: accent },
    { key: 'plant', x: x0 + 5, y: y0 },
    { key: 'plant', x: x0, y: y0 },
  ];
}

/** Mobiliario común (fuera de oficinas) de cada piso. */
export function commonFurniture(floorId: string): SeedFurniture[] {
  if (floorId === 'lobby') {
    return [
      { key: 'tv', x: 4, y: 0 },
      { key: 'bench', x: 1, y: 3 },
      { key: 'bench', x: 6, y: 3 },
      { key: 'bench', x: 1, y: 5 },
      { key: 'bench', x: 6, y: 5 },
      { key: 'plant', x: 0, y: 0 },
      { key: 'plant', x: 9, y: 0 },
      { key: 'tv', x: 24, y: 0 },
      { key: 'table', x: 24, y: 3 },
      { key: 'chair', x: 23, y: 3, rot: 270, color: '#6b7f99' },
      { key: 'chair', x: 23, y: 4, rot: 270, color: '#6b7f99' },
      { key: 'chair', x: 26, y: 3, rot: 90, color: '#6b7f99' },
      { key: 'chair', x: 26, y: 4, rot: 90, color: '#6b7f99' },
      { key: 'chair', x: 24, y: 5, color: '#6b7f99' },
      { key: 'chair', x: 25, y: 5, color: '#6b7f99' },
      { key: 'whiteboard', x: 28, y: 1, rot: 270 },
      { key: 'plant', x: 29, y: 6 },
      { key: 'directory', x: 14, y: 0 },
      { key: 'reception', x: 13, y: 9 },
      { key: 'plant', x: 11, y: 9 },
      { key: 'plant', x: 17, y: 9 },
      { key: 'coffee', x: 1, y: 9 },
      { key: 'coffee', x: 2, y: 9 },
      { key: 'table', x: 2, y: 12, color: '#e9e1d3' },
      { key: 'chair', x: 1, y: 12, rot: 270 },
      { key: 'chair', x: 4, y: 12, rot: 90 },
      { key: 'table', x: 7, y: 12, color: '#e9e1d3' },
      { key: 'chair', x: 6, y: 12, rot: 270 },
      { key: 'chair', x: 9, y: 12, rot: 90 },
      { key: 'sofa', x: 21, y: 10, rot: 180, color: '#6b7f99' },
      { key: 'table', x: 21, y: 11, color: '#e9e1d3' },
      { key: 'sofa', x: 21, y: 13, color: '#6b7f99' },
      { key: 'plant', x: 24, y: 10 },
      ...meetingFurniture(24, 15, '#6b7f99').filter((f) => f.y < 21),
    ];
  }
  const accent = CELLS.find((c) => c.floorId === floorId)?.color ?? '#6b7f99';
  return [
    ...meetingFurniture(24, 0, accent),
    { key: 'whiteboard', x: 29, y: 5, rot: 270 },
    { key: 'desk', x: 8, y: 9 },
    { key: 'chair', x: 8, y: 10, color: accent },
    { key: 'chair', x: 9, y: 10, color: accent },
    { key: 'desk', x: 11, y: 9 },
    { key: 'chair', x: 11, y: 10, color: accent },
    { key: 'chair', x: 12, y: 10, color: accent },
    { key: 'whiteboard', x: 15, y: 7 },
    { key: 'coffee', x: 27, y: 10 },
    { key: 'coffee', x: 28, y: 10 },
    { key: 'table', x: 26, y: 13, color: '#e9e1d3' },
    { key: 'chair', x: 25, y: 13, rot: 270 },
    { key: 'chair', x: 28, y: 13, rot: 90 },
    { key: 'sofa', x: 1, y: 8, rot: 180 },
    { key: 'table', x: 1, y: 9, color: '#e9e1d3' },
    { key: 'sofa', x: 1, y: 11 },
    { key: 'plant', x: 0, y: 8 },
    { key: 'plant', x: 4, y: 8 },
    { key: 'plant', x: 22, y: 8 },
  ];
}

export const catalogRows = Object.entries(CATALOG).map(([key, c]) => ({
  key,
  name: c.name,
  footprintW: c.w,
  footprintD: c.d,
  colorable: c.colorable,
}));
