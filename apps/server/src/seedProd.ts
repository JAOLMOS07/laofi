import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { hashPassword, temporaryPassword } from './auth/passwords.js';
import { prisma } from './db.js';
import { populate } from './seed.js';
import { CELLS, USERS, type SeedUser } from './seedData.js';

/**
 * Siembra de producción, para una base vacía: nunca borra. Las cuentas salen de un archivo local
 * ignorado por git, para que los correos del equipo no queden en el repositorio. Cada persona
 * recibe una contraseña temporal aleatoria que debe cambiar al entrar; esas contraseñas solo
 * quedan en otro archivo local, para repartirlas. En la base solo está su hash.
 */
const teamFile = resolve(process.env.SEED_TEAM_FILE ?? '../../equipo.local.json');
const out = resolve(process.env.SEED_CREDENTIALS_FILE ?? '../../credenciales-temporales.local.txt');

const TeamSchema = z
  .array(
    z.object({
      email: z.string().trim().toLowerCase().email(),
      name: z.string().trim().min(1).max(80),
      cell: z.enum(CELLS.map((c) => c.id) as [string, ...string[]]),
      title: z.string().trim().max(80).optional(),
      admin: z.boolean().optional(),
    }),
  )
  .min(1);

function loadTeam(): SeedUser[] {
  if (!existsSync(teamFile)) throw new Error(`Falta ${teamFile} con las cuentas del equipo.`);
  const team = TeamSchema.parse(JSON.parse(readFileSync(teamFile, 'utf8')));
  if (!team.some((u) => u.admin)) throw new Error('Marca al menos una cuenta con "admin": true.');
  // Avatares de arranque variados; cada quien cambia el suyo en la app.
  return team.map((u, i) => ({
    email: u.email,
    name: u.name,
    cell: u.cell,
    avatar: USERS[i % USERS.length]!.avatar,
    ...(u.title ? { title: u.title } : {}),
    ...(u.admin ? { admin: true } : {}),
  }));
}

async function main(): Promise<void> {
  if (await prisma.user.count())
    throw new Error(
      'Esta base ya tiene usuarios: no se siembra. Usa el panel Admin para resetear contraseñas.',
    );
  if (existsSync(out)) throw new Error(`Ya existe ${out}: muévelo antes de volver a sembrar.`);
  const team = loadTeam();
  const lines: string[] = [];
  await populate(async (email) => {
    const password = temporaryPassword();
    lines.push(`${email}\t${password}`);
    return { passwordHash: await hashPassword(password), mustChangePassword: true };
  }, team);
  writeFileSync(out, `${lines.join('\n')}\n`, { mode: 0o600, flag: 'wx' });
  console.log(`[la-ofi] ${lines.length} cuentas creadas. Contraseñas temporales en ${out}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
