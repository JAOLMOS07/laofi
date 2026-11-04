/**
 * Voz con LiveKit (opcional). Si el servidor no tiene LiveKit configurado, todo sigue funcionando sin audio:
 * el walkie muestra quién habla y las salas ofrecen abrir Teams.
 *
 * - Piso (`floor-<id>`): sirve al walkie-talkie. Nadie se suscribe a nadie por defecto; solo cuando el servidor
 *   avisa que alguien te está hablando (evento `ptt`) te suscribes a su micrófono mientras dure.
 * - Sala (`room-<id>`): "Hablar aquí". Todos los de la sala se escuchan mientras estén dentro.
 */
import type { ServerEvents } from '@laofi/shared';
import { type RemoteParticipant, type RemoteTrack, Room, RoomEvent, Track } from 'livekit-client';
import { firstName, useUi } from '../state/store';
import { ApiError, api } from './api';

let floorRoom: Room | null = null;
let floorName = '';
let talkRoom: Room | null = null;
const listening = new Set<string>();

function setVoice(p: Partial<ReturnType<typeof useUi.getState>['voice']>): void {
  const ui = useUi.getState();
  ui.set({ voice: { ...ui.voice, ...p } });
}

async function connect(name: string, autoSubscribe: boolean): Promise<Room | null> {
  if (useUi.getState().voice.available === false) return null;
  try {
    const t = await api<{ url: string; token: string }>('POST', '/voice/token', { room: name });
    const r = new Room({ adaptiveStream: true, dynacast: true });
    r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio)
        document.body.appendChild(track.attach()).setAttribute('data-voice', name);
    });
    // El micrófono del walkie se publica al apretar el botón: si ya te estaba hablando, te suscribes al publicarse.
    r.on(RoomEvent.TrackPublished, (pub, participant) => {
      if (!autoSubscribe && listening.has(participant.identity) && pub.kind === Track.Kind.Audio)
        pub.setSubscribed(true);
    });
    r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => track.detach().forEach((el) => el.remove()));
    await r.connect(t.url, t.token, { autoSubscribe });
    setVoice({ available: true });
    return r;
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) setVoice({ available: false });
    else if (!(err instanceof ApiError)) setVoice({ available: false });
    return null;
  }
}

export async function onFloorJoined(floorId: string): Promise<void> {
  await floorRoom?.disconnect().catch(() => undefined);
  floorRoom = null;
  listening.clear();
  floorName = `floor-${floorId}`;
  const r = await connect(floorName, false);
  if (r && floorName === `floor-${floorId}`) floorRoom = r;
  else await r?.disconnect();
}

function setListening(userId: string, on: boolean): void {
  if (on) listening.add(userId);
  else listening.delete(userId);
  const p: RemoteParticipant | undefined = floorRoom?.remoteParticipants.get(userId);
  if (!p) return;
  for (const pub of p.trackPublications.values()) if (pub.kind === Track.Kind.Audio) pub.setSubscribed(on);
}

/** Alguien te habla por walkie (el servidor solo te avisa si eres destinatario). */
export function onPtt(e: ServerEvents['ptt']): void {
  setListening(e.fromUserId, e.active);
  if (e.active) {
    const where = e.target === 'USER' ? 'a ti' : e.target === 'ROOM' ? 'a la sala' : 'a todo el piso';
    useUi.getState().toast({
      title: `${firstName(e.fromName)} habla por walkie`,
      text: `Le está hablando ${where}.`,
      icon: 'mic',
      timeout: 2500,
    });
  }
}

/** Abre o cierra tu micrófono del walkie. */
export async function setPttMic(on: boolean): Promise<void> {
  if (!floorRoom) return;
  try {
    await floorRoom.localParticipant.setMicrophoneEnabled(on);
  } catch {
    if (on)
      useUi.getState().toast({
        title: 'Sin micrófono',
        text: 'El navegador no dejó usar el micrófono. Revisa el permiso del sitio.',
        icon: 'x',
      });
  }
}

/** "Hablar aquí": entra al audio de la sala donde estás. */
export async function joinRoomVoice(roomId: string): Promise<boolean> {
  await leaveRoomVoice();
  const r = await connect(`room-${roomId}`, true);
  if (!r) return false;
  talkRoom = r;
  try {
    await r.localParticipant.setMicrophoneEnabled(true);
  } catch {
    useUi.getState().toast({
      title: 'Sin micrófono',
      text: 'Puedes escuchar, pero el navegador no dejó usar tu micrófono.',
      icon: 'x',
    });
  }
  setVoice({ roomJoined: roomId, muted: false });
  return true;
}

export async function leaveRoomVoice(): Promise<void> {
  const r = talkRoom;
  talkRoom = null;
  await r?.disconnect().catch(() => undefined);
  if (useUi.getState().voice.roomJoined) setVoice({ roomJoined: null });
}

export async function toggleMute(): Promise<void> {
  if (!talkRoom) return;
  const muted = !useUi.getState().voice.muted;
  await talkRoom.localParticipant.setMicrophoneEnabled(!muted).catch(() => undefined);
  setVoice({ muted });
}

/** Al salir de una sala se corta su audio. */
export function onRoomChanged(roomId: string | null): void {
  const joined = useUi.getState().voice.roomJoined;
  if (joined && joined !== roomId) void leaveRoomVoice();
}
