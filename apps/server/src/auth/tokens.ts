import { SignJWT, jwtVerify } from 'jose';
import { env } from '../env.js';

const key = new TextEncoder().encode(env.sessionSecret);

type TokenKind = 'session' | 'room';

const sign = (userId: string, kind: TokenKind, ttl: string): Promise<string> =>
  new SignJWT({ kind })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(key);

/** Sesión del navegador: va en una cookie httpOnly y dura 7 días. */
export const signSession = (userId: string): Promise<string> => sign(userId, 'session', '7d');

/** Token corto para entrar a una room de Colyseus. Vive 2 minutos. */
export const signRoomToken = (userId: string): Promise<string> => sign(userId, 'room', '2m');

export async function verifyToken(token: string, kind: TokenKind): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    if (payload.kind !== kind || typeof payload.sub !== 'string') return null;
    return payload.sub;
  } catch {
    return null;
  }
}
