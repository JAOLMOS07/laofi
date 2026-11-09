import { DEFAULT_OFFICE_HOURS, type OfficeHours, parseOfficeHours } from '@laofi/shared';
import { prisma } from './db.js';

const KEY = 'officeHours';
let cache: { value: OfficeHours; at: number } | null = null;

/** Horario de oficina guardado por el admin (con caché corta: se consulta cada minuto por piso). */
export async function getOfficeHours(): Promise<OfficeHours> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  const value = row ? parseOfficeHours(row.value) : DEFAULT_OFFICE_HOURS;
  cache = { value, at: Date.now() };
  return value;
}

export async function setOfficeHours(h: OfficeHours): Promise<OfficeHours> {
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: h as object },
    update: { value: h as object },
  });
  cache = { value: h, at: Date.now() };
  return h;
}

/** Solo para pruebas. */
export function clearSettingsCache(): void {
  cache = null;
}
