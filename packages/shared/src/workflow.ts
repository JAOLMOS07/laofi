/**
 * Fase 2: entregas a QA y agenda. Las reglas viven aquí para que el cliente muestre solo
 * los botones válidos y el servidor las haga cumplir con el mismo código.
 */
import { z } from 'zod';
import type { Rect } from './building.js';

export const DELIVERY_STATUSES = ['SENT', 'TESTING', 'APPROVED', 'RETURNED', 'DEPLOYED'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** De dónde salió: a mano, simulada para la demo, o del webhook de Azure DevOps (pendiente). */
export const DELIVERY_SOURCES = ['MANUAL', 'DEMO', 'DEVOPS'] as const;
export type DeliverySource = (typeof DELIVERY_SOURCES)[number];

export const MEETING_SOURCES = ['MANUAL', 'DEMO', 'GRAPH'] as const;
export type MeetingSource = (typeof MEETING_SOURCES)[number];

export const DELIVERY_FLOW: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  SENT: ['TESTING', 'RETURNED'],
  TESTING: ['APPROVED', 'RETURNED'],
  APPROVED: ['DEPLOYED'],
  RETURNED: ['SENT'],
  DEPLOYED: [],
};

export interface DeliveryActor {
  role: 'ADMIN' | 'MEMBER';
  cellId: string | null;
  cellType: 'DEV' | 'QA' | 'INFRA' | null;
}

export function canCreateDelivery(actor: DeliveryActor): boolean {
  return actor.role === 'ADMIN' || actor.cellType === 'DEV';
}

/** QA prueba y decide; la célula de origen reenvía lo devuelto y despliega lo aprobado. Los admins pueden todo. */
export function canAdvanceDelivery(
  actor: DeliveryActor,
  delivery: { fromCellId: string; status: DeliveryStatus },
  to: DeliveryStatus,
): boolean {
  if (!DELIVERY_FLOW[delivery.status].includes(to)) return false;
  if (actor.role === 'ADMIN') return true;
  if (to === 'SENT' || to === 'DEPLOYED') return actor.cellId === delivery.fromCellId;
  return actor.cellType === 'QA';
}

export const CreateDeliverySchema = z.object({
  externalId: z.string().trim().min(1).max(40),
  title: z.string().trim().min(3).max(160),
  /** Solo los admins eligen la célula; los demás entregan desde la suya. */
  fromCellId: z.string().min(1).max(40).optional(),
  /** Link del work item en Azure DevOps. */
  url: z.string().trim().max(2000).nullish(),
});

export const AdvanceDeliverySchema = z.object({
  status: z.enum(DELIVERY_STATUSES),
  /** Motivo de la devolución: se muestra como etiqueta de bug. */
  note: z.string().trim().max(200).optional(),
});

export const CreateMeetingSchema = z.object({
  title: z.string().trim().min(2).max(120),
  startsAt: z.iso.datetime(),
  durationMin: z.number().int().min(5).max(480),
  roomId: z.string().min(1).max(64),
  teamsLink: z.string().trim().max(2000).nullish(),
});

/** En qué está cada persona. Lo publica ella misma: nada se detecta solo. */
export const WORK_ACTIVITIES = ['DEVELOPING', 'REVIEWING', 'TESTING', 'DEPLOYING', 'SUPPORT'] as const;
export type WorkActivity = (typeof WORK_ACTIVITIES)[number];

export const WORK_ACTIVITY_LABEL: Record<WorkActivity, string> = {
  DEVELOPING: 'Desarrollando',
  REVIEWING: 'Revisando',
  TESTING: 'Probando',
  DEPLOYING: 'Desplegando',
  SUPPORT: 'Apoyando',
};

export const CurrentWorkInputSchema = z.object({
  activity: z.enum(WORK_ACTIVITIES),
  itemId: z.string().trim().min(1).max(40),
  title: z.string().trim().max(120).nullish(),
  url: z.string().trim().max(2000).nullish(),
});

export interface CurrentWork {
  activity: WorkActivity;
  itemId: string;
  title: string | null;
  url: string | null;
}

/** Lee lo guardado en la base o en la room; lo que no tenga la forma esperada se ignora. */
export function parseCurrentWork(raw: unknown): CurrentWork | null {
  const r = CurrentWorkInputSchema.safeParse(raw);
  if (!r.success) return null;
  return {
    activity: r.data.activity,
    itemId: r.data.itemId,
    title: r.data.title || null,
    url: r.data.url || null,
  };
}

export const ChangePasswordSchema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(10, 'La contraseña nueva debe tener al menos 10 caracteres.').max(200),
});

/** Con cuánta anticipación llega "Tu reunión empieza: ¿vamos?". */
export const MEETING_NOTICE_MS = 60_000;

export interface FloorFeatures {
  /** Muelle de entregas del piso de QA. */
  dock?: Rect;
  /** Tablero de entregas del Lobby. */
  board?: Rect;
}

const FEATURES: Record<string, FloorFeatures> = {
  qa: { dock: { x: 17, y: 11, w: 6, d: 4 } },
  lobby: { board: { x: 17, y: 12, w: 3, d: 1 } },
};

export const floorFeatures = (floorId: string): FloorFeatures => FEATURES[floorId] ?? {};

/** Baldosas que no se pueden caminar por las instalaciones del piso. */
export function featureBlocks(floorId: string): Rect[] {
  const f = floorFeatures(floorId);
  return [f.dock, f.board].filter((r): r is Rect => !!r);
}
