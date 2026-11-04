import { basename } from 'node:path';
import { CATALOG } from '@laofi/shared';
import type { Prisma } from '@prisma/client';
import { hashPassword } from './auth/passwords.js';
import { prisma } from './db.js';
import { assignOffice } from './offices.js';
import {
  CELLS,
  DEV_PASSWORD,
  FLOORS,
  LAYOUT,
  LOBBY_OFFICE_EMAILS,
  ROOMS,
  USERS,
  catalogRows,
  commonFurniture,
} from './seedData.js';

/** Borra todo y carga los datos de ejemplo. Solo para desarrollo y pruebas. */
export async function seed(): Promise<void> {
  await prisma.$transaction([
    prisma.delivery.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.knock.deleteMany(),
    prisma.note.deleteMany(),
    prisma.placedFurniture.deleteMany(),
    prisma.office.deleteMany(),
    prisma.room.deleteMany(),
    prisma.user.deleteMany(),
    prisma.cell.deleteMany(),
    prisma.floor.deleteMany(),
    prisma.furnitureCatalog.deleteMany(),
  ]);

  await prisma.furnitureCatalog.createMany({ data: catalogRows });
  const catalog = new Map((await prisma.furnitureCatalog.findMany()).map((c) => [c.key, c.id]));

  for (const f of FLOORS)
    await prisma.floor.create({ data: { ...f, layout: LAYOUT as unknown as Prisma.InputJsonValue } });
  for (const c of CELLS) await prisma.cell.create({ data: c });
  for (const r of ROOMS) {
    await prisma.room.create({
      data: {
        id: r.id,
        floorId: r.floorId,
        name: r.name,
        description: r.description,
        kind: r.kind,
        linkEditableByAll: r.linkEditableByAll ?? false,
        gridX: r.x,
        gridY: r.y,
        width: r.w,
        depth: r.d,
        doorSide: r.door.side,
        doorAt: r.door.at,
      },
    });
  }

  // Mobiliario común primero: al asignar oficinas se retira lo que quede dentro de ellas.
  for (const f of FLOORS) {
    await prisma.placedFurniture.createMany({
      data: commonFurniture(f.id).map((it) => ({
        floorId: f.id,
        catalogId: catalog.get(it.key)!,
        gridX: it.x,
        gridY: it.y,
        rotation: it.rot ?? 0,
        color: it.color ?? CATALOG[it.key].color,
      })),
    });
  }

  const passwordHash = await hashPassword(DEV_PASSWORD);
  for (const u of USERS) {
    const cell = CELLS.find((c) => c.id === u.cell);
    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        title: u.title,
        role: u.admin ? 'ADMIN' : 'MEMBER',
        cellId: u.cell,
        avatarConfig: u.avatar,
        passwordHash,
      },
    });
    const floorId = cell?.floorId ?? (LOBBY_OFFICE_EMAILS.includes(u.email) ? 'lobby' : null);
    if (floorId) await assignOffice(user.id, floorId, cell?.color ?? '#6b7f99');
  }

  // Un par de post-its de ejemplo para que el escritorio de Jhoger no arranque vacío.
  const byEmail = (n: string) => prisma.user.findUniqueOrThrow({ where: { email: `${n}@laofi.local` } });
  const jhoger = await byEmail('jhoger');
  const andres = await byEmail('andres');
  const daniela = await byEmail('daniela');
  await prisma.note.createMany({
    data: [
      { fromUserId: andres.id, toUserId: jhoger.id, text: 'Te dejé el PR #482 para revisión cuando puedas.' },
      {
        fromUserId: daniela.id,
        toUserId: jhoger.id,
        text: 'La HU-1290 volvió con un bug en el registro. La evidencia está en el work item.',
      },
    ],
  });
}

// basename entiende / y \\, así funciona igual en Windows.
const isMain = !!process.argv[1] && /^seed\.(ts|js)$/.test(basename(process.argv[1]));
if (isMain) {
  seed()
    .then(() =>
      console.log(
        `[la-ofi] seed listo. Usuarios: ${USERS.map((u) => u.email).join(', ')} · contraseña: ${DEV_PASSWORD}`,
      ),
    )
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
