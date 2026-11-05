/** Configuración leída del entorno. Los secretos vienen de `.env`, nunca del repo. */
function num(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? Number(v) : fallback;
}

export const env = {
  wsPort: num('SERVER_PORT', 2567),
  apiPort: num('API_PORT', 2568),
  /** Producción: un solo puerto para todo (lo asigna el hosting). */
  port: num('PORT', 3000),
  /** Clave para firmar sesiones. En desarrollo hay una por defecto; en producción es obligatoria. */
  sessionSecret: process.env.SESSION_SECRET ?? 'solo-para-desarrollo-cambiame-por-favor-32',
  production: process.env.NODE_ENV === 'production',
  /** Hosts extra para links de work items (servidor propio de Azure DevOps). */
  workItemHosts: (process.env.WORK_ITEM_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean),
  livekit: {
    /** URL que usa el navegador para conectarse a LiveKit. */
    url: process.env.LIVEKIT_URL ?? '',
    apiKey: process.env.LIVEKIT_API_KEY ?? '',
    apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
  },
};

if (env.production && !process.env.SESSION_SECRET) {
  throw new Error('Falta SESSION_SECRET en producción.');
}

export const voiceEnabled = (): boolean =>
  Boolean(env.livekit.url && env.livekit.apiKey && env.livekit.apiSecret);
