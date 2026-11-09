import { type SchemaType, schema, t } from '@colyseus/schema';

/** Una persona en el piso. Posición continua en baldosas (centro = n + 0.5). */
export const PlayerState = schema(
  {
    userId: t.string(),
    name: t.string(),
    cellId: t.string(),
    /** AvatarConfig serializado en JSON. */
    avatar: t.string(),
    x: t.number(),
    y: t.number(),
    moving: t.boolean(),
    status: t.string(),
    voiceMode: t.string(),
    isVisitor: t.boolean(),
    /** Sala en la que está parada, o "" si no está en ninguna. */
    roomId: t.string(),
    talking: t.boolean(),
  },
  'PlayerState',
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const FurnitureState = schema(
  { key: t.string(), x: t.number(), y: t.number(), rot: t.number(), color: t.string(), officeId: t.string() },
  'FurnitureState',
);
export type FurnitureState = SchemaType<typeof FurnitureState>;

export const OfficeState = schema(
  {
    ownerId: t.string(),
    wallColor: t.string(),
    floorColor: t.string(),
    doorClosed: t.boolean(),
    /** Post-its sin leer sobre el escritorio. */
    unreadNotes: t.number(),
    /** CurrentWork en JSON, o "" si no publicó nada. */
    work: t.string(),
    /** Absence en JSON si el dueño está ausente hoy, o "". */
    absence: t.string(),
  },
  'OfficeState',
);
export type OfficeState = SchemaType<typeof OfficeState>;

/** Alguien sin conexión, en horario de oficina, que se ve en su puesto (ver planResidents). */
export const ResidentState = schema(
  {
    userId: t.string(),
    name: t.string(),
    cellId: t.string(),
    avatar: t.string(),
    status: t.string(),
    x: t.number(),
    y: t.number(),
    rot: t.number(),
    seated: t.boolean(),
    activity: t.string(),
  },
  'ResidentState',
);
export type ResidentState = SchemaType<typeof ResidentState>;

export const FloorState = schema(
  {
    floorId: t.string(),
    locked: t.boolean(),
    /** Sube cuando cambian oficinas o salas: el cliente vuelve a pedir la geometría por la API. */
    layoutVersion: t.number(),
    players: t.map(PlayerState),
    furniture: t.map(FurnitureState),
    offices: t.map(OfficeState),
    residents: t.map(ResidentState),
  },
  'FloorState',
);
export type FloorState = SchemaType<typeof FloorState>;
