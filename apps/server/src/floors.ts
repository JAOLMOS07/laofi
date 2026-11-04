import {
  type DoorSide,
  type FloorLayout,
  type FurnitureKey,
  type OfficeSpec,
  type PlacedItem,
  type RoomSpec,
  type Rotation,
  isFurnitureKey,
} from '@laofi/shared';
import { prisma } from './db.js';

export interface OfficeView extends OfficeSpec {
  ownerName: string | null;
  wallColor: string | null;
  floorColor: string | null;
}
export interface RoomView extends RoomSpec {
  teamsLink: string | null;
  description: string | null;
  /** Sala libre: cualquiera puede pegar el link de la reunión planeada. */
  linkEditableByAll: boolean;
}
export interface FloorView {
  id: string;
  name: string;
  level: number;
  isCommon: boolean;
  isLocked: boolean;
  cell: { id: string; name: string; color: string } | null;
  layout: FloorLayout;
  offices: OfficeView[];
  rooms: RoomView[];
  furniture: PlacedItem[];
}

const rot = (r: number): Rotation => ([0, 90, 180, 270].includes(r) ? (r as Rotation) : 0);

/** Carga todo lo que hace falta para dibujar y simular un piso. */
export async function loadFloor(floorId: string): Promise<FloorView | null> {
  const f = await prisma.floor.findUnique({
    where: { id: floorId },
    include: {
      cell: true,
      offices: { include: { owner: true, furniture: { include: { catalog: true } } } },
      rooms: true,
      furniture: { include: { catalog: true } },
    },
  });
  if (!f) return null;
  const furniture: PlacedItem[] = [];
  const pushItem = (
    p: {
      id: string;
      gridX: number;
      gridY: number;
      rotation: number;
      color: string | null;
      catalog: { key: string };
    },
    officeId: string | null,
  ) => {
    if (!isFurnitureKey(p.catalog.key)) return;
    furniture.push({
      id: p.id,
      key: p.catalog.key as FurnitureKey,
      x: p.gridX,
      y: p.gridY,
      rot: rot(p.rotation),
      color: p.color ?? '#999999',
      officeId,
    });
  };
  f.furniture.forEach((p) => pushItem(p, null));
  f.offices.forEach((o) => o.furniture.forEach((p) => pushItem(p, o.id)));
  return {
    id: f.id,
    name: f.name,
    level: f.level,
    isCommon: f.isCommon,
    isLocked: f.isLocked,
    cell: f.cell ? { id: f.cell.id, name: f.cell.name, color: f.cell.color } : null,
    layout: f.layout as unknown as FloorLayout,
    offices: f.offices.map((o) => ({
      id: o.id,
      ownerId: o.ownerId,
      ownerName: o.owner?.name ?? null,
      x: o.gridX,
      y: o.gridY,
      w: o.width,
      d: o.depth,
      door: { side: o.doorSide as DoorSide, at: o.doorAt },
      wallColor: o.wallColor,
      floorColor: o.floorColor,
    })),
    rooms: f.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      x: r.gridX,
      y: r.gridY,
      w: r.width,
      d: r.depth,
      door: { side: r.doorSide as DoorSide, at: r.doorAt },
      teamsLink: r.teamsLink,
      description: r.description,
      linkEditableByAll: r.linkEditableByAll,
    })),
    furniture,
  };
}
