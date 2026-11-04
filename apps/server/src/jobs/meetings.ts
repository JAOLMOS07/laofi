import { MEETING_NOTICE_MS } from '@laofi/shared';
import { prisma } from '../db.js';
import { meetingInclude, toMeetingInfo } from '../meetings.js';
import { presence } from '../presence/PresenceService.js';

/** Un aviso de "empieza" solo sirve poco después de la hora; más tarde ya no se manda. */
const STALE_MS = 5 * 60_000;

/**
 * Avisa un minuto antes de cada reunión y cuando termina. Si la persona no está conectada,
 * el aviso de inicio queda pendiente hasta que entre o hasta que deje de tener sentido.
 */
export async function tickMeetings(now = new Date()): Promise<{ started: number; ended: number }> {
  let started = 0;
  let ended = 0;
  const upcoming = await prisma.meeting.findMany({
    where: {
      notifiedAt: null,
      startsAt: {
        lte: new Date(now.getTime() + MEETING_NOTICE_MS),
        gte: new Date(now.getTime() - STALE_MS),
      },
    },
    include: meetingInclude,
  });
  for (const m of upcoming) {
    if (!presence.send(m.userId, 'meeting_starting', { meeting: toMeetingInfo(m) })) continue;
    await prisma.meeting.update({ where: { id: m.id }, data: { notifiedAt: now } });
    started++;
  }
  const finished = await prisma.meeting.findMany({
    where: { endNotifiedAt: null, notifiedAt: { not: null }, endsAt: { lte: now } },
    include: meetingInclude,
  });
  for (const m of finished) {
    presence.send(m.userId, 'meeting_ended', { meeting: toMeetingInfo(m) });
    await prisma.meeting.update({ where: { id: m.id }, data: { endNotifiedAt: now } });
    ended++;
  }
  return { started, ended };
}

export function startMeetingJob(): () => void {
  const t = setInterval(() => {
    void tickMeetings().catch((e) => console.error('[la-ofi] avisos de reuniones fallaron', e));
  }, 5000);
  t.unref();
  return () => clearInterval(t);
}
