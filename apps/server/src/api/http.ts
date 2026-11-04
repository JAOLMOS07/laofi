import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { verifyToken } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { env } from '../env.js';

export const SESSION_COOKIE = 'laofi_session';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface SessionUser {
  id: string;
  role: 'ADMIN' | 'MEMBER';
  name: string;
  cellId: string | null;
}

/** Lee la cookie de sesión y devuelve la persona, o lanza 401. */
export async function requireUser(req: FastifyRequest): Promise<SessionUser> {
  const token = req.cookies[SESSION_COOKIE];
  const id = token ? await verifyToken(token, 'session') : null;
  const u = id
    ? await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, name: true, cellId: true },
      })
    : null;
  if (!u) throw new HttpError(401, 'Tienes que iniciar sesión.');
  return u;
}

export async function requireAdmin(req: FastifyRequest): Promise<SessionUser> {
  const u = await requireUser(req);
  if (u.role !== 'ADMIN') throw new HttpError(403, 'Solo para administradores.');
  return u;
}

/** Valida el cuerpo con zod; un cuerpo inválido es un 400 con el primer problema. */
export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? 'Datos inválidos.');
  return r.data;
}

export function setSession(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: env.production,
    maxAge: 7 * 24 * 3600,
  });
}

export function createHttp(): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });
  void app.register(cookie);
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.status(status).send({ error: (err as Error).message });
    console.error('[la-ofi] error en la API', err);
    return reply.status(500).send({ error: 'Algo falló en el servidor.' });
  });
  return app;
}
