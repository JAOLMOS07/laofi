import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { FLOOR_ROOM } from '@laofi/shared';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import { createHttp } from './api/http.js';
import { registerRoutes } from './api/routes.js';
import { registerWorkflowRoutes } from './api/workflow.js';
import { FloorRoom } from './rooms/FloorRoom.js';

const CLIENT_DIST = resolve(fileURLToPath(import.meta.url), '../../../client/dist');

/** En producción Fastify también sirve el cliente; cualquier ruta que no sea de la API es la app. */
function serveClient(http: ReturnType<typeof createHttp>): void {
  void http.register(fastifyStatic, { root: CLIENT_DIST });
  http.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
    return reply.status(404).send({ error: 'No encontrado.' });
  });
}

/**
 * Arma la API REST y el servidor multijugador sin escuchar todavía (las pruebas los usan así).
 * Con `singlePort`, Colyseus es dueño del servidor HTTP: atiende /matchmake y los WebSockets,
 * y lo demás pasa a Fastify por su app de Express, que es el mecanismo soportado para rutas propias.
 */
export function createApp({ singlePort = false } = {}) {
  const http = createHttp();
  registerRoutes(http);
  registerWorkflowRoutes(http);
  http.get('/api/health', async () => ({ ok: true }));
  if (singlePort) serveClient(http);
  const game = new Server({
    transport: new WebSocketTransport(),
    ...(singlePort
      ? {
          express: async (app) => {
            await http.ready();
            app.use((req: IncomingMessage, res: ServerResponse) => http.routing(req, res));
          },
        }
      : {}),
  });
  // Una room por piso: los clientes que piden el mismo floorId comparten instancia.
  game.define(FLOOR_ROOM, FloorRoom).filterBy(['floorId']);
  return { http, game };
}
