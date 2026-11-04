import { prisma } from '../db.js';
import { verifyPassword } from './passwords.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Punto de extensión para el login. La Fase 1 usa DevAuthProvider (email y contraseña).
 * En la Fase 3 se agrega EntraAuthProvider (Microsoft Entra ID / SSO) sin tocar el resto:
 * las rutas y las rooms solo ven sesiones firmadas, no cómo se obtuvieron.
 */
export interface AuthProvider {
  readonly id: 'dev' | 'entra';
  login(credentials: { email: string; password: string }): Promise<AuthenticatedUser | null>;
}

export class DevAuthProvider implements AuthProvider {
  readonly id = 'dev' as const;
  async login({ email, password }: { email: string; password: string }): Promise<AuthenticatedUser | null> {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
    return { id: user.id, email: user.email, name: user.name };
  }
}

export const authProvider: AuthProvider = new DevAuthProvider();
