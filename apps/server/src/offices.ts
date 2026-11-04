import { CATALOG, type Door, type Rotation, footprint, isFurnitureKey } from '@laofi/shared';
import { prisma } from './db.js';
import { officeFurniture } from './seedData.js';

/**
 * Lugares para oficinas en un piso de célula de 30×22: cuatro arriba (puerta al sur)
 * y cuatro abajo (puerta al norte), dejando libres la sala de la célula y el ascensor.
 */
export const OFFICE_SLOTS: Array<{ x: number; y: number; door: Door }> = [
  { x: 0, y: 0, door: { side: 's', at: 2 } },
  { x: 6, y: 0, door: { side: 's', at: 8 } },
  { x: 12, y: 0, door: { side: 's', at: 14 } },
  { x: 18, y: 0, door: { side: 's', at: 20 } },
  { x: 0, y: 17, door: { side: 'n', at: 3 } },
  { x: 6, y: 17, door: { side: 'n', at: 9 } },
  { x: 18, y: 17, door: { side: 'n', at: 21 } },
  { x: 24, y: 17, door: { side: 'n', at: 27 } },
];

/**
 * Da a una persona una oficina en el piso de su célula, en el primer lugar libre.
 * Si ya tenía oficina en otro piso, la borra (con sus muebles). Devuelve null si el piso está lleno.
 */
export async function assignOffice(userId: string, floorId: string, accent: string): Promise<string | null> {
  const existing = await prisma.office.findUnique({ where: { ownerId: userId } });
  if (existing?.floorId === floorId) return existing.id;
  const floor = await prisma.floor.findUniqueOrThrow({ where: { id: floorId } });
  // En pisos comunes (Lobby) las salas ocupan la fila de arriba: solo quedan los lugares de abajo a la izquierda.
  const slots = floor.isCommon ? OFFICE_SLOTS.slice(4, 6) : OFFICE_SLOTS;
  const taken = await prisma.office.findMany({ where: { floorId } });
  const slot = slots.find((s) => !taken.some((o) => o.gridX === s.x && o.gridY === s.y));
  if (!slot) return null;
  if (existing) await prisma.office.delete({ where: { id: existing.id } });

  // El mobiliario común que quede dentro del nuevo espacio se retira.
  const common = await prisma.placedFurniture.findMany({ where: { floorId }, include: { catalog: true } });
  const inside = common.filter((f) => {
    if (!isFurnitureKey(f.catalog.key)) return false;
    const fp = footprint(f.catalog.key, f.rotation as Rotation);
    return f.gridX < slot.x + 6 && f.gridX + fp.w > slot.x && f.gridY < slot.y + 5 && f.gridY + fp.d > slot.y;
  });
  if (inside.length)
    await prisma.placedFurniture.deleteMany({ where: { id: { in: inside.map((f) => f.id) } } });

  const office = await prisma.office.create({
    data: {
      ownerId: userId,
      floorId,
      gridX: slot.x,
      gridY: slot.y,
      width: 6,
      depth: 5,
      doorSide: slot.door.side,
      doorAt: slot.door.at,
    },
  });
  const catalog = new Map((await prisma.furnitureCatalog.findMany()).map((c) => [c.key, c.id]));
  // Muebles iniciales: en las oficinas de abajo la puerta está al norte, así que se omite el sofá junto a ella.
  const items = officeFurniture(slot.x, slot.y, taken.length, accent).filter(
    (f) => slot.y === 0 || f.key !== 'sofa',
  );
  // Abajo la oficina se refleja: lo que iba contra la pared norte va contra la sur, girado 180°.
  const flipped = items.map((f) =>
    slot.y === 0
      ? f
      : {
          ...f,
          y: slot.y + (4 - (f.y - slot.y)) - (footprint(f.key, f.rot ?? 0).d - 1),
          rot: (((f.rot ?? 0) + 180) % 360) as Rotation,
        },
  );
  await prisma.placedFurniture.createMany({
    data: flipped.map((f) => ({
      officeId: office.id,
      catalogId: catalog.get(f.key)!,
      gridX: f.x,
      gridY: f.y,
      rotation: f.rot ?? 0,
      color: f.color ?? CATALOG[f.key].color,
    })),
  });
  return office.id;
}
