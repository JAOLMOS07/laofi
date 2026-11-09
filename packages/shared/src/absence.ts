import { z } from 'zod';

/** Ausencia larga (vacaciones, incapacidad, permiso): deja un mensaje en la puerta de la oficina. */
export interface Absence {
  /** Primer día, "AAAA-MM-DD". */
  from: string;
  /** Último día, "AAAA-MM-DD" (incluido). */
  until: string;
  /** Motivo o mensaje que se ve en la oficina, por ejemplo "Vacaciones, vuelvo el lunes". */
  reason: string;
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha válida.');

export const AbsenceSchema = z
  .object({ from: day, until: day, reason: z.string().trim().min(1).max(120) })
  .refine((a) => a.from <= a.until, { message: 'La fecha de regreso debe ser después del inicio.' });

export function parseAbsence(raw: unknown): Absence | null {
  const r = AbsenceSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Fecha local "AAAA-MM-DD" en una zona horaria. */
export function localDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

export type AbsencePhase = 'upcoming' | 'active' | 'over';
export function absencePhase(a: Absence, today: string): AbsencePhase {
  if (today < a.from) return 'upcoming';
  return today <= a.until ? 'active' : 'over';
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "20 nov" a partir de "2026-11-20". */
export function shortDay(d: string): string {
  return `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1] ?? ''}`;
}
