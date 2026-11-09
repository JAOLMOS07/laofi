import { z } from 'zod';

/** Horario de oficina: dentro de él, quien no está conectado se ve igual en su puesto. */
export interface OfficeHours {
  /** Hora de entrada, "HH:MM" (24 h). */
  start: string;
  /** Hora de salida, "HH:MM" (24 h). */
  end: string;
  /** Días laborales: 0 = domingo … 6 = sábado. */
  days: number[];
  /** Zona horaria IANA, por ejemplo "America/Bogota". */
  timeZone: string;
}

export const DEFAULT_OFFICE_HOURS: OfficeHours = {
  start: '08:00',
  end: '18:00',
  days: [1, 2, 3, 4, 5],
  timeZone: 'America/Bogota',
};

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:MM.');

export const OfficeHoursSchema = z
  .object({
    start: hhmm,
    end: hhmm,
    days: z.array(z.number().int().min(0).max(6)).max(7),
    timeZone: z
      .string()
      .min(1)
      .max(60)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, 'Zona horaria desconocida.'),
  })
  .refine((h) => h.start < h.end, { message: 'La salida debe ser después de la entrada.' });

export function parseOfficeHours(raw: unknown): OfficeHours {
  const r = OfficeHoursSchema.safeParse(raw);
  return r.success ? { ...r.data, days: [...new Set(r.data.days)].sort() } : DEFAULT_OFFICE_HOURS;
}

/** Día de la semana (0-6) y minutos desde medianoche en la zona horaria del horario. */
function localTime(at: Date, timeZone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const toMinutes = (s: string): number => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

export function isWithinOfficeHours(h: OfficeHours, at: Date = new Date()): boolean {
  const { day, minutes } = localTime(at, h.timeZone);
  return h.days.includes(day) && minutes >= toMinutes(h.start) && minutes < toMinutes(h.end);
}
