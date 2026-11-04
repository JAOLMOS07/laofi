import type {
  BuildingFloor,
  CellInfo,
  DeliveryActor,
  DeliveryInfo,
  FloorInfo,
  FurnitureKey,
  Me,
  MeetingInfo,
  PttTarget,
  Rotation,
} from '@laofi/shared';
import { create } from 'zustand';

export type PanelKind =
  | 'person'
  | 'directory'
  | 'building'
  | 'elevator'
  | 'notes'
  | 'edit'
  | 'avatar'
  | 'admin'
  | 'deliveries'
  | 'agenda'
  | 'integrations';

export interface ToastAction {
  label: string;
  primary?: boolean;
  run: () => void;
}
export interface Toast {
  id: number;
  title: string;
  text?: string;
  icon?: 'knock' | 'note' | 'teams' | 'mic' | 'hi' | 'x' | 'moon' | 'lock' | 'box' | 'calendar';
  actions?: ToastAction[];
  timeout?: number;
}

export interface EditState {
  /** Mueble del catálogo que se está por colocar. */
  key: FurnitureKey | null;
  rot: Rotation;
  color: string;
  /** Mueble propio seleccionado. */
  selId: string | null;
  /** Mueble que se está moviendo (se oculta mientras tanto). */
  movingId: string | null;
}

interface UiStore {
  me: Me | null;
  booted: boolean;
  building: { floors: BuildingFloor[]; cells: CellInfo[] } | null;
  floor: FloorInfo | null;
  conn: 'idle' | 'connecting' | 'connected' | 'error';
  connError: string | null;
  mySid: string | null;
  /** Sube cuando cambia algo de la gente que la UI muestre (no la posición). */
  peopleVersion: number;
  /** Sube cuando cambian muebles u oficinas. */
  staticVersion: number;
  roomId: string | null;
  panel: { kind: PanelKind; personId?: string } | null;
  toasts: Toast[];
  transition: { title: string; sub: string } | null;
  edit: EditState;
  ptt: { live: boolean; target: PttTarget; id?: string; label: string };
  voice: { available: boolean | null; roomJoined: string | null; muted: boolean };
  unreadNotes: number;
  queuedKnocks: number;
  deliveries: DeliveryInfo[];
  meetings: MeetingInfo[];
  /** Reunión a la que aceptaste ir: su link manda sobre el fijo de la sala. */
  activeMeeting: MeetingInfo | null;
  set: (p: Partial<UiStore>) => void;
  openPanel: (kind: PanelKind, personId?: string) => void;
  togglePanel: (kind: PanelKind) => void;
  closePanel: () => void;
  toast: (t: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
  setEdit: (p: Partial<EditState>) => void;
}

let toastId = 1;

export const useUi = create<UiStore>((set, get) => ({
  me: null,
  booted: false,
  building: null,
  floor: null,
  conn: 'idle',
  connError: null,
  mySid: null,
  peopleVersion: 0,
  staticVersion: 0,
  roomId: null,
  panel: null,
  toasts: [],
  transition: null,
  edit: { key: null, rot: 0, color: '#5c9a5a', selId: null, movingId: null },
  ptt: { live: false, target: 'FLOOR', label: 'todo el piso' },
  voice: { available: null, roomJoined: null, muted: false },
  unreadNotes: 0,
  queuedKnocks: 0,
  deliveries: [],
  meetings: [],
  activeMeeting: null,
  set: (p) => set(p),
  openPanel: (kind, personId) => set({ panel: { kind, personId } }),
  togglePanel: (kind) => set({ panel: get().panel?.kind === kind ? null : { kind } }),
  closePanel: () => set({ panel: null }),
  toast: (t) => {
    const id = toastId++;
    set({ toasts: [...get().toasts, { ...t, id }].slice(-4) });
    const ms = t.timeout ?? 5200;
    if (ms > 0) setTimeout(() => get().dismiss(id), ms);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
  setEdit: (p) => set({ edit: { ...get().edit, ...p } }),
}));

export const STATUS_INFO = {
  AVAILABLE: { label: 'Disponible', color: '#3faa6b' },
  BUSY: { label: 'Ocupado', color: '#e0a325' },
  FOCUS: { label: 'En foco', color: '#d9534f' },
  MEETING: { label: 'En reunión', color: '#4a7fd4' },
  AWAY: { label: 'Ausente', color: '#9aa0a6' },
} as const;

export const firstName = (n: string): string => n.split(' ')[0] ?? n;

export const actorFrom = (me: Me): DeliveryActor => ({
  role: me.role,
  cellId: me.cell?.id ?? null,
  cellType: me.cellType,
});
