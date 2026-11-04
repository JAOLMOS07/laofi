import {
  type DeliveryActor,
  type DeliveryInfo,
  type DeliverySource,
  type DeliveryStatus,
  canAdvanceDelivery,
  canCreateDelivery,
} from '@laofi/shared';
import type { Prisma } from '@prisma/client';
import { HttpError, type SessionUser } from './api/http.js';
import { prisma } from './db.js';
import { presence } from './presence/PresenceService.js';

const include = { fromCell: true, createdBy: { select: { name: true } } } as const;
type Row = Prisma.DeliveryGetPayload<{ include: typeof include }>;

const FINISHED_WINDOW_MS = 7 * 24 * 3600 * 1000;

const toInfo = (d: Row): DeliveryInfo => ({
  id: d.id,
  externalId: d.externalId,
  title: d.title,
  fromCell: { id: d.fromCell.id, name: d.fromCell.name, color: d.fromCell.color },
  status: d.status,
  source: d.source,
  note: d.note,
  createdByName: d.createdBy?.name ?? null,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
});

async function actorOf(u: SessionUser): Promise<DeliveryActor> {
  const cell = u.cellId ? await prisma.cell.findUnique({ where: { id: u.cellId } }) : null;
  return { role: u.role, cellId: u.cellId, cellType: cell?.type ?? null };
}

/** Lo activo, más lo que terminó en la última semana (alcanza para el tablero). */
export async function listDeliveries(now = new Date()): Promise<DeliveryInfo[]> {
  const rows = await prisma.delivery.findMany({
    where: {
      OR: [
        { status: { in: ['SENT', 'TESTING', 'RETURNED'] } },
        { updatedAt: { gte: new Date(now.getTime() - FINISHED_WINDOW_MS) } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    include,
    take: 300,
  });
  return rows.map(toInfo);
}

/**
 * Punto único de entrada de una entrega nueva. El botón manual, la simulación y el
 * futuro webhook de Azure DevOps pasan por aquí, así que la app no depende de ninguno.
 */
export async function recordDelivery(input: {
  externalId: string;
  title: string;
  fromCellId: string;
  source: DeliverySource;
  createdById?: string | null;
  status?: DeliveryStatus;
  note?: string | null;
}): Promise<DeliveryInfo> {
  const row = await prisma.delivery.create({
    data: {
      externalId: input.externalId,
      title: input.title,
      fromCellId: input.fromCellId,
      source: input.source,
      createdById: input.createdById ?? null,
      status: input.status ?? 'SENT',
      note: input.note ?? null,
    },
    include,
  });
  const delivery = toInfo(row);
  presence.broadcast('delivery_update', { delivery, previous: null });
  return delivery;
}

export async function createDeliveryAs(
  u: SessionUser,
  body: { externalId: string; title: string; fromCellId?: string | undefined },
): Promise<DeliveryInfo> {
  const actor = await actorOf(u);
  if (!canCreateDelivery(actor)) throw new HttpError(403, 'Las entregas salen de las células de desarrollo.');
  const fromCellId = actor.role === 'ADMIN' ? (body.fromCellId ?? u.cellId) : u.cellId;
  const cell = fromCellId ? await prisma.cell.findUnique({ where: { id: fromCellId } }) : null;
  if (!cell) throw new HttpError(400, 'Elige la célula que entrega.');
  if (cell.type !== 'DEV')
    throw new HttpError(400, 'La entrega tiene que salir de una célula de desarrollo.');
  return recordDelivery({
    externalId: body.externalId,
    title: body.title,
    fromCellId: cell.id,
    source: 'MANUAL',
    createdById: u.id,
  });
}

export async function advanceDelivery(
  u: SessionUser,
  id: string,
  to: DeliveryStatus,
  note?: string,
): Promise<DeliveryInfo> {
  const current = await prisma.delivery.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'Esa entrega no existe.');
  if (!canAdvanceDelivery(await actorOf(u), current, to))
    throw new HttpError(403, 'No puedes mover esta entrega a ese estado.');
  // Se condiciona al estado leído: si dos personas la mueven a la vez, gana una sola.
  const { count } = await prisma.delivery.updateMany({
    where: { id, status: current.status },
    data: { status: to, note: to === 'RETURNED' ? note || 'Devuelta por QA' : null },
  });
  if (!count) throw new HttpError(409, 'Alguien más acaba de mover esta entrega.');
  const delivery = toInfo(await prisma.delivery.findUniqueOrThrow({ where: { id }, include }));
  presence.broadcast('delivery_update', { delivery, previous: current.status });
  return delivery;
}
