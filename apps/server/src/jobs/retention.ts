import { RETENTION_DAYS } from '@laofi/shared';
import { prisma } from '../db.js';

/** Borra post-its, toques de puerta y reuniones pasadas de más de 30 días. Corre al arrancar y cada 6 horas. */
export async function purgeOld(
  now = new Date(),
): Promise<{ notes: number; knocks: number; meetings: number }> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 3600 * 1000);
  const [notes, knocks, meetings] = await prisma.$transaction([
    prisma.note.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.knock.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.meeting.deleteMany({ where: { endsAt: { lt: cutoff } } }),
  ]);
  return { notes: notes.count, knocks: knocks.count, meetings: meetings.count };
}

export function startRetentionJob(): () => void {
  const run = () => void purgeOld().catch((e) => console.error('[la-ofi] limpieza de 30 días falló', e));
  run();
  const t = setInterval(run, 6 * 3600 * 1000);
  t.unref();
  return () => clearInterval(t);
}
