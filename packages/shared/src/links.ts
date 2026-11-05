/** Hosts aceptados para links de reuniones de Teams. */
const TEAMS_HOSTS = ['teams.microsoft.com', 'teams.live.com'];

/**
 * Valida un link de reunión de Teams: https y en un host de Teams (o un subdominio).
 * Devuelve el link normalizado o null si no sirve. Así nadie pega un enlace a otro sitio en una sala.
 */
export function normalizeTeamsLink(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (!TEAMS_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  return url.toString();
}

const WORK_ITEM_HOSTS = ['dev.azure.com', 'visualstudio.com'];

/**
 * Valida el link de un work item: https y en Azure DevOps (o un host que el equipo configure).
 * Se abre con un clic desde la oficina de alguien, así que no se acepta cualquier sitio.
 */
export function normalizeWorkItemUrl(raw: string, extraHosts: string[] = []): string | null {
  const text = raw.trim();
  if (!text || text.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const allowed = [...WORK_ITEM_HOSTS, ...extraHosts.map((h) => h.toLowerCase())];
  if (!allowed.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  return url.toString();
}

/** Saca el número del work item de un link como .../_workitems/edit/1302. */
export function workItemIdFromUrl(raw: string): string | null {
  return /_workitems\/edit\/(\d+)/i.exec(raw)?.[1] ?? null;
}
