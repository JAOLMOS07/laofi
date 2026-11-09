import { z } from 'zod';
import type { DeliveryInfo, MeetingInfo } from './api.js';
import { FURNITURE_KEYS } from './catalog.js';
import type { DeliveryStatus } from './workflow.js';

export const STATUSES = ['AVAILABLE', 'BUSY', 'FOCUS', 'MEETING', 'AWAY', 'LUNCH'] as const;
export type Status = (typeof STATUSES)[number];
export const StatusSchema = z.enum(STATUSES);
/** Estados que cierran la puerta de la oficina y dejan los toques como aviso silencioso. */
export const SILENT_STATUSES: readonly Status[] = ['FOCUS', 'AWAY', 'LUNCH'];

export const VOICE_MODES = ['APP', 'TEAMS', 'NONE'] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

export const KNOCK_RESPONSES = ['ENTER', 'WAIT_10', 'NOT_NOW'] as const;
export type KnockResponse = (typeof KNOCK_RESPONSES)[number];

export const PTT_TARGETS = ['USER', 'ROOM', 'FLOOR'] as const;
export type PttTarget = (typeof PTT_TARGETS)[number];

const id = z.string().min(1).max(64);
const coord = z.number().int().min(0).max(200);
const rot = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Opciones con las que un cliente entra a la room de un piso. */
export const JoinOptionsSchema = z.object({
  floorId: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  /** Token corto firmado por la API (ver /api/auth/room-token). */
  token: z.string().min(10).max(2000),
  /** Dónde aparecer: el ascensor (por defecto) o la puerta de la oficina de alguien. */
  spawn: z
    .union([z.object({ kind: z.literal('elevator') }), z.object({ kind: z.literal('door'), userId: id })])
    .optional(),
});
export type JoinOptions = z.infer<typeof JoinOptionsSchema>;

export const ClientMessages = {
  move: z.object({ x: coord, y: coord }),
  set_status: z.object({ status: StatusSchema }),
  knock: z.object({ toUserId: id }),
  knock_response: z.object({ knockId: id, response: z.enum(KNOCK_RESPONSES) }),
  note_create: z.object({ toUserId: id, text: z.string().trim().min(1).max(500) }),
  furniture_place: z.object({
    key: z.enum(FURNITURE_KEYS as [string, ...string[]]),
    x: coord,
    y: coord,
    rot,
    color,
  }),
  furniture_move: z.object({ id, x: coord, y: coord, rot }),
  furniture_remove: z.object({ id }),
  furniture_recolor: z.object({ id, color }),
  /** El dueño abre o cierra la puerta de su oficina. */
  door_set: z.object({ closed: z.boolean() }),
  office_style: z.object({ wallColor: color.optional(), floorColor: color.optional() }),
  voice_mode: z.object({ mode: z.enum(VOICE_MODES) }),
  ptt_start: z.object({ target: z.enum(PTT_TARGETS), id: id.optional() }),
  ptt_stop: z.object({}),
} as const;
export type ClientMessageType = keyof typeof ClientMessages;
export type ClientMessage<T extends ClientMessageType> = z.infer<(typeof ClientMessages)[T]>;

/** Eventos servidor → cliente (además del estado sincronizado). */
export interface ServerEvents {
  move_rejected: { reason: 'no_path' | 'invalid' };
  action_rejected: { action: string; reason: string };
  knock_received: { knockId: string; fromUserId: string; fromName: string; silent: boolean; at: string };
  knock_answered: { knockId: string; byUserId: string; byName: string; response: KnockResponse };
  knock_sent: { knockId: string; toName: string; queued: boolean; status: Status };
  note_received: { noteId: string; fromUserId: string; fromName: string; text: string; at: string };
  note_sent: { toName: string };
  ptt: { fromUserId: string; fromName: string; target: PttTarget; id?: string; active: boolean };
  floor_locked: { floorId: string };
  delivery_update: { delivery: DeliveryInfo; previous: DeliveryStatus | null };
  deliveries_reset: Record<string, never>;
  meeting_starting: { meeting: MeetingInfo };
  meeting_ended: { meeting: MeetingInfo };
}
export type ServerEventType = keyof ServerEvents;
