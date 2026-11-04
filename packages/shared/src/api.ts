/** Formas que intercambian el cliente y la API REST. Viven aquí para que ambos lados no se desalineen. */
import type { AvatarConfig } from './avatar.js';
import type { FloorLayout, OfficeSpec, PlacedItem, RoomSpec } from './building.js';
import type { Status } from './messages.js';
import type { DeliverySource, DeliveryStatus, MeetingSource } from './workflow.js';

export type Role = 'ADMIN' | 'MEMBER';

export interface CellInfo {
  id: string;
  name: string;
  color: string;
  floorId: string | null;
}

export interface Me {
  id: string;
  email: string;
  name: string;
  title: string | null;
  role: Role;
  status: Status;
  avatar: AvatarConfig;
  cell: CellInfo | null;
  cellType: 'DEV' | 'QA' | 'INFRA' | null;
  /** Piso donde está su oficina (el de su célula, o el Lobby para los jefes). */
  homeFloorId: string | null;
}

export interface OfficeInfo extends OfficeSpec {
  ownerName: string | null;
  wallColor: string | null;
  floorColor: string | null;
}
export interface RoomInfo extends RoomSpec {
  teamsLink: string | null;
  description: string | null;
  linkEditableByAll: boolean;
}
export interface FloorInfo {
  id: string;
  name: string;
  level: number;
  isCommon: boolean;
  isLocked: boolean;
  cell: { id: string; name: string; color: string } | null;
  layout: FloorLayout;
  offices: OfficeInfo[];
  rooms: RoomInfo[];
  furniture: PlacedItem[];
}

export interface BuildingFloor {
  id: string;
  name: string;
  level: number;
  isCommon: boolean;
  isLocked: boolean;
  cell: { id: string; name: string; color: string } | null;
  online: number;
  /** Salas con gente dentro: id → cantidad. */
  busyRooms: Record<string, number>;
  canEnter: boolean;
}

export interface DirectoryEntry {
  id: string;
  name: string;
  title: string | null;
  cell: { id: string; name: string; color: string } | null;
  status: Status;
  online: boolean;
  /** Dónde está ahora (si está conectada). */
  floorId: string | null;
  roomId: string | null;
  /** Dónde queda su oficina. */
  homeFloorId: string | null;
}

export interface NoteInfo {
  id: string;
  fromName: string;
  fromUserId: string;
  text: string;
  createdAt: string;
  readAt: string | null;
}

export interface QueuedKnock {
  id: string;
  fromName: string;
  createdAt: string;
}

export interface VoiceToken {
  url: string;
  token: string;
  room: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  title: string | null;
  role: Role;
  cellId: string | null;
  homeFloorId: string | null;
}
export interface AdminOverview {
  cells: CellInfo[];
  floors: Array<{ id: string; name: string; level: number; isCommon: boolean; isLocked: boolean }>;
  rooms: Array<{
    id: string;
    floorId: string;
    name: string;
    teamsLink: string | null;
    linkEditableByAll: boolean;
  }>;
  users: AdminUser[];
}

export interface DeliveryInfo {
  id: string;
  /** Id del work item, por ejemplo "HU-1302". */
  externalId: string;
  title: string;
  fromCell: { id: string; name: string; color: string };
  status: DeliveryStatus;
  source: DeliverySource;
  /** Motivo de la devolución (etiqueta de bug). */
  note: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingInfo {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  roomId: string;
  roomName: string;
  floorId: string;
  /** Link de la reunión o, si no tiene, el fijo de la sala. */
  teamsLink: string | null;
  source: MeetingSource;
}

export interface RoomRef {
  id: string;
  name: string;
  floorId: string;
  floorName: string;
}
