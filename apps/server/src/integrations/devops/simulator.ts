import type { DeliveryInfo, DeliveryStatus } from '@laofi/shared';
import { prisma } from '../../db.js';
import { recordDelivery } from '../../deliveries.js';
import { presence } from '../../presence/PresenceService.js';

/**
 * Simulador para la demo: hace lo que hará el service hook de Azure DevOps cuando sepamos
 * cómo marcan una entrega. Todo lo que crea queda con source DEMO y se puede quitar.
 * Los work items son inventados.
 */
const SAMPLES: Array<{ title: string; status: DeliveryStatus; note?: string }> = [
  { title: 'Validación de formulario de registro', status: 'SENT' },
  { title: 'Filtro por fecha en reportes', status: 'TESTING' },
  { title: 'Reintentos al subir archivos', status: 'TESTING' },
  { title: 'Exportar consulta a Excel', status: 'APPROVED' },
  { title: 'Paginación del historial', status: 'RETURNED', note: 'Bug: la página 2 repite resultados' },
];

const devCells = () => prisma.cell.findMany({ where: { type: 'DEV' }, orderBy: { name: 'asc' } });
const fakeId = () => `DEMO-${1000 + Math.floor(Math.random() * 9000)}`;

export async function simulateDelivery(): Promise<DeliveryInfo> {
  const cells = await devCells();
  const cell = cells[Math.floor(Math.random() * cells.length)];
  if (!cell) throw new Error('No hay células de desarrollo.');
  const sample = SAMPLES[Math.floor(Math.random() * SAMPLES.length)]!;
  return recordDelivery({
    externalId: fakeId(),
    title: sample.title,
    fromCellId: cell.id,
    source: 'DEMO',
  });
}

/** Llena el tablero con un ejemplo de cada estado. */
export async function loadDemoDeliveries(): Promise<number> {
  const cells = await devCells();
  if (!cells.length) return 0;
  await Promise.all(
    SAMPLES.map((s, i) =>
      recordDelivery({
        externalId: fakeId(),
        title: s.title,
        fromCellId: cells[i % cells.length]!.id,
        source: 'DEMO',
        status: s.status,
        note: s.note ?? null,
      }),
    ),
  );
  return SAMPLES.length;
}

export async function clearDemoDeliveries(): Promise<number> {
  const { count } = await prisma.delivery.deleteMany({ where: { source: 'DEMO' } });
  presence.broadcast('deliveries_reset', {});
  return count;
}
