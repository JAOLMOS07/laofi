import {
  AdvanceDeliverySchema,
  CreateDeliverySchema,
  CreateMeetingSchema,
  type CurrentWork,
  CurrentWorkInputSchema,
  type DeliveryInfo,
  type MeetingInfo,
  type RoomRef,
} from '@laofi/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { advanceDelivery, createDeliveryAs, listDeliveries } from '../deliveries.js';
import {
  clearDemoDeliveries,
  loadDemoDeliveries,
  simulateDelivery,
} from '../integrations/devops/simulator.js';
import { tickMeetings } from '../jobs/meetings.js';
import { createMeeting, listMeetings, listRooms } from '../meetings.js';
import { setCurrentWork } from '../work.js';
import { HttpError, parse, requireAdmin, requireUser } from './http.js';

/** Rutas de la Fase 2: entregas a QA, agenda y los botones de simulación para la demo. */
export function registerWorkflowRoutes(app: FastifyInstance): void {
  /** Publica en qué estás (se ve en tu oficina) o lo quita con null. */
  app.put('/api/me/work', async (req): Promise<{ work: CurrentWork | null }> => {
    const u = await requireUser(req);
    const { work } = parse(z.object({ work: CurrentWorkInputSchema.nullable() }), req.body);
    return { work: await setCurrentWork(u.id, work) };
  });

  app.get('/api/deliveries', async (req): Promise<DeliveryInfo[]> => {
    await requireUser(req);
    return listDeliveries();
  });

  app.post('/api/deliveries', async (req): Promise<DeliveryInfo> => {
    const u = await requireUser(req);
    return createDeliveryAs(u, parse(CreateDeliverySchema, req.body));
  });

  app.patch('/api/deliveries/:id/status', async (req): Promise<DeliveryInfo> => {
    const u = await requireUser(req);
    const { id } = req.params as { id: string };
    const { status, note } = parse(AdvanceDeliverySchema, req.body);
    return advanceDelivery(u, id, status, note);
  });

  app.get('/api/rooms', async (req): Promise<RoomRef[]> => {
    await requireUser(req);
    return listRooms();
  });

  app.get('/api/meetings', async (req): Promise<MeetingInfo[]> => {
    const u = await requireUser(req);
    return listMeetings(u.id);
  });

  app.post('/api/meetings', async (req): Promise<MeetingInfo> => {
    const u = await requireUser(req);
    const body = parse(CreateMeetingSchema, req.body);
    return createMeeting(u.id, { ...body, startsAt: new Date(body.startsAt) });
  });

  app.post('/api/meetings/:id/cancel', async (req) => {
    const u = await requireUser(req);
    const { id } = req.params as { id: string };
    const { count } = await prisma.meeting.deleteMany({ where: { id, userId: u.id } });
    if (!count) throw new HttpError(404, 'Esa reunión no existe.');
    return { ok: true };
  });

  // ---------------------------------------------------------------- simulación para la demo
  /** Reunión de prueba en un minuto, en la sala de la célula: muestra el aviso sin calendario. */
  app.post('/api/demo/meeting', async (req): Promise<MeetingInfo> => {
    const u = await requireUser(req);
    const own = u.cellId ? await prisma.room.findUnique({ where: { id: `sala-${u.cellId}` } }) : null;
    const room = own ?? (await prisma.room.findFirst({ where: { linkEditableByAll: true } }));
    if (!room) throw new HttpError(404, 'No hay salas configuradas.');
    const meeting = await createMeeting(u.id, {
      title: 'Reunión de prueba',
      startsAt: new Date(Date.now() + 60_000),
      durationMin: 5,
      roomId: room.id,
      source: 'DEMO',
    });
    await tickMeetings();
    return meeting;
  });

  app.post('/api/demo/deliveries/simulate', async (req): Promise<DeliveryInfo> => {
    await requireAdmin(req);
    return simulateDelivery();
  });

  app.post('/api/demo/deliveries/load', async (req) => {
    await requireAdmin(req);
    return { created: await loadDemoDeliveries() };
  });

  app.post('/api/demo/deliveries/clear', async (req) => {
    await requireAdmin(req);
    return { removed: await clearDemoDeliveries() };
  });
}
