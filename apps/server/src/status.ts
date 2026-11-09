import type { Status } from '@laofi/shared';
import { prisma } from './db.js';
import { presence } from './presence/PresenceService.js';

/** Cambia el estado de alguien y lo refleja en todos los pisos abiertos (puerta, etiqueta, residentes). */
export async function changeStatus(userId: string, status: Status): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { status } });
  // Cambiar de estado vuelve a la puerta de ese estado (se olvida la que puso a mano).
  await prisma.office.updateMany({ where: { ownerId: userId }, data: { doorClosed: null } });
  for (const h of presence.floorHandles()) h.setUserStatus(userId, status);
  const entry = presence.get(userId);
  if (entry) presence.update(userId, entry.sessionId, { status });
}
