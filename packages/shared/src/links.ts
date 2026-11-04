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
