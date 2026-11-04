import type { MeetingInfo, MeetingSource, RoomRef } from '@laofi/shared';
import { normalizeTeamsLink } from '@laofi/shared';
import type { Prisma } from '@prisma/client';
import { HttpError } from './api/http.js';
import { prisma } from './db.js';

const include = { room: true } as const;
type MeetingRow = Prisma.MeetingGetPayload<{ include: typeof include }>;
export const meetingInclude = include;

export const toMeetingInfo = (m: MeetingRow): MeetingInfo => ({
  id: m.id,
  title: m.title,
  startsAt: m.startsAt.toISOString(),
  endsAt: m.endsAt.toISOString(),
  roomId: m.roomId,
  roomName: m.room.name,
  floorId: m.room.floorId,
  teamsLink: m.teamsLink ?? m.room.teamsLink,
  source: m.source,
});

export async function listMeetings(userId: string, now = new Date()): Promise<MeetingInfo[]> {
  const rows = await prisma.meeting.findMany({
    where: { userId, endsAt: { gte: now } },
    orderBy: { startsAt: 'asc' },
    include,
    take: 50,
  });
  return rows.map(toMeetingInfo);
}

export async function createMeeting(
  userId: string,
  input: {
    title: string;
    startsAt: Date;
    durationMin: number;
    roomId: string;
    teamsLink?: string | null | undefined;
    source?: MeetingSource;
  },
): Promise<MeetingInfo> {
  const raw = input.teamsLink?.trim();
  const teamsLink = raw ? normalizeTeamsLink(raw) : null;
  if (raw && !teamsLink) throw new HttpError(400, 'Pega un link de Teams (https://teams.microsoft.com/…).');
  const room = await prisma.room.findUnique({ where: { id: input.roomId } });
  if (!room) throw new HttpError(404, 'Esa sala no existe.');
  const row = await prisma.meeting.create({
    data: {
      userId,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: new Date(input.startsAt.getTime() + input.durationMin * 60_000),
      roomId: room.id,
      teamsLink,
      source: input.source ?? 'MANUAL',
    },
    include,
  });
  return toMeetingInfo(row);
}

export async function listRooms(): Promise<RoomRef[]> {
  const rows = await prisma.room.findMany({
    include: { floor: true },
    orderBy: [{ floor: { level: 'asc' } }, { name: 'asc' }],
  });
  return rows.map((r) => ({ id: r.id, name: r.name, floorId: r.floorId, floorName: r.floor.name }));
}
