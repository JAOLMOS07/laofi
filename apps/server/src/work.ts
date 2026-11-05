import { type CurrentWork, normalizeWorkItemUrl } from '@laofi/shared';
import { Prisma } from '@prisma/client';
import { HttpError } from './api/http.js';
import { prisma } from './db.js';
import { env } from './env.js';
import { presence } from './presence/PresenceService.js';

/** Guarda lo que alguien publica en su oficina y lo muestra en vivo en el piso donde esté abierta. */
export async function setCurrentWork(
  userId: string,
  input: {
    activity: CurrentWork['activity'];
    itemId: string;
    title?: string | null | undefined;
    url?: string | null | undefined;
  } | null,
): Promise<CurrentWork | null> {
  let work: CurrentWork | null = null;
  if (input) {
    const raw = input.url?.trim();
    const url = raw ? normalizeWorkItemUrl(raw, env.workItemHosts) : null;
    if (raw && !url) throw new HttpError(400, 'Pega el link del work item de Azure DevOps.');
    work = { activity: input.activity, itemId: input.itemId, title: input.title || null, url };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { currentWork: work ? { ...work } : Prisma.DbNull },
  });
  for (const h of presence.floorHandles()) h.setUserWork(userId, work);
  return work;
}
