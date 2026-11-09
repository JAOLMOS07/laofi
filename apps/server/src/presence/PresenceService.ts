import type { CurrentWork, ServerEventType, ServerEvents, Status, VoiceMode } from '@laofi/shared';

/**
 * PresenceService global y ligero: el mapa userId → {pisoId, salaId?, estado, modoVoz}.
 * Alimenta el directorio y el mapa del edificio sin que el cliente esté en todas las rooms,
 * y permite enviar eventos (toc toc, post-its) a alguien que está en otro piso.
 * Vive en memoria: con varias instancias del servidor pasará a Redis.
 */
export interface PresenceEntry {
  userId: string;
  sessionId: string;
  name: string;
  cellId: string | null;
  floorId: string;
  roomId: string | null;
  status: Status;
  voiceMode: VoiceMode;
}

type Sender = <T extends ServerEventType>(type: T, payload: ServerEvents[T]) => void;

/** Lo que el servicio necesita de cada room de piso abierta. */
export interface FloorHandle {
  floorId: string;
  /** Saca a los visitantes cuando el piso se cierra. */
  enforceLock(): void;
  /** Recarga salas (por ejemplo, cambió un link de Teams). */
  reloadStatic(): Promise<void>;
  /** Cambió el estado de alguien desde otro lugar (por ejemplo, la API). */
  setUserStatus(userId: string, status: Status): void;
  /** Cambió el avatar de alguien (se ve al instante sin volver a entrar). */
  setUserAvatar(userId: string, avatarJson: string): void;
  /** Cambió lo que alguien publica en su oficina. */
  setUserWork(userId: string, work: CurrentWork | null): void;
  /** Vuelve a contar los post-its sin leer de alguien (se ven sobre su escritorio). */
  refreshNotes(userId: string): Promise<void>;
  /** Vuelve a calcular quién se ve sin conexión en su puesto (alguien entró, salió o cambió de estado). */
  refreshResidents(): void;
  /** Abre o cierra la puerta de la oficina de alguien si queda en este piso. */
  setUserDoor(userId: string, closed: boolean): void;
}

class PresenceService {
  private entries = new Map<string, PresenceEntry>();
  private senders = new Map<string, { sessionId: string; send: Sender; kick: () => void }>();
  private floors = new Map<string, FloorHandle>();

  /** Registra a alguien en un piso. Si ya estaba conectado en otra pestaña, esa sesión se cierra. */
  join(entry: PresenceEntry, send: Sender, kick: () => void): void {
    const prev = this.senders.get(entry.userId);
    if (prev && prev.sessionId !== entry.sessionId) prev.kick();
    this.entries.set(entry.userId, entry);
    this.senders.set(entry.userId, { sessionId: entry.sessionId, send, kick });
  }

  update(
    userId: string,
    sessionId: string,
    patch: Partial<Omit<PresenceEntry, 'userId' | 'sessionId'>>,
  ): void {
    const e = this.entries.get(userId);
    if (e && e.sessionId === sessionId) Object.assign(e, patch);
  }

  leave(userId: string, sessionId: string): void {
    if (this.entries.get(userId)?.sessionId === sessionId) this.entries.delete(userId);
    if (this.senders.get(userId)?.sessionId === sessionId) this.senders.delete(userId);
  }

  get(userId: string): PresenceEntry | undefined {
    return this.entries.get(userId);
  }

  all(): PresenceEntry[] {
    return [...this.entries.values()];
  }

  /** Envía un evento a una persona esté en el piso que esté. Devuelve false si no está conectada. */
  send<T extends ServerEventType>(userId: string, type: T, payload: ServerEvents[T]): boolean {
    const s = this.senders.get(userId);
    if (!s) return false;
    s.send(type, payload);
    return true;
  }

  /** Envía un evento a todas las personas conectadas, en cualquier piso. */
  broadcast<T extends ServerEventType>(type: T, payload: ServerEvents[T]): void {
    for (const s of this.senders.values()) s.send(type, payload);
  }

  registerFloor(h: FloorHandle): void {
    this.floors.set(h.floorId, h);
  }
  unregisterFloor(h: FloorHandle): void {
    if (this.floors.get(h.floorId) === h) this.floors.delete(h.floorId);
  }
  floorHandles(): FloorHandle[] {
    return [...this.floors.values()];
  }
  floor(floorId: string): FloorHandle | undefined {
    return this.floors.get(floorId);
  }

  /** Solo para pruebas. */
  reset(): void {
    this.entries.clear();
    this.senders.clear();
    this.floors.clear();
  }
}

export const presence = new PresenceService();
