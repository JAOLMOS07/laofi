import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { FLOOR_ROOM } from '@laofi/shared';
import { createHttp } from './api/http.js';
import { registerRoutes } from './api/routes.js';
import { registerWorkflowRoutes } from './api/workflow.js';
import { FloorRoom } from './rooms/FloorRoom.js';

/** Arma la API REST y el servidor multijugador sin escuchar todavía (las pruebas los usan así). */
export function createApp() {
  const http = createHttp();
  registerRoutes(http);
  registerWorkflowRoutes(http);
  http.get('/api/health', async () => ({ ok: true }));
  const game = new Server({ transport: new WebSocketTransport() });
  // Una room por piso: los clientes que piden el mismo floorId comparten instancia.
  game.define(FLOOR_ROOM, FloorRoom).filterBy(['floorId']);
  return { http, game };
}
