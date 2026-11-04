import { useState } from 'react';
import { ApiError, api } from '../net/api';
import { live, send } from '../net/floor';
import { joinRoomVoice, leaveRoomVoice, toggleMute } from '../net/voice';
import { useUi } from '../state/store';
import { Icon } from './icons';

/** Tarjeta que aparece al entrar a una sala: hablar en la app o abrir la reunión fija de Teams. */
export function RoomCard() {
  const roomId = useUi((s) => s.roomId);
  const floor = useUi((s) => s.floor);
  const voice = useUi((s) => s.voice);
  const activeMeeting = useUi((s) => s.activeMeeting);
  useUi((s) => s.peopleVersion);
  const [editing, setEditing] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const room = floor?.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const meeting = activeMeeting?.roomId === room.id ? activeMeeting : null;
  const teamsLink = meeting?.teamsLink ?? room.teamsLink;
  const inside = [...live.players.values()].filter((p) => p.roomId === room.id).length;
  const inApp = voice.roomJoined === room.id;
  const toast = useUi.getState().toast;

  const talkHere = async () => {
    if (inApp) {
      await leaveRoomVoice();
      send('voice_mode', { mode: 'NONE' });
      return;
    }
    if (voice.available === false) {
      toast({
        title: 'La voz no está configurada',
        text: teamsLink
          ? 'Este servidor no tiene LiveKit. Usa “Abrir en Teams”.'
          : 'Este servidor no tiene LiveKit todavía.',
        icon: 'mic',
      });
      return;
    }
    if (await joinRoomVoice(room.id)) send('voice_mode', { mode: 'APP' });
    else
      toast({
        title: 'No pude conectar la voz',
        text: 'Revisa que LiveKit esté corriendo, o usa Teams.',
        icon: 'x',
      });
  };

  const openTeams = () => {
    if (!teamsLink) return;
    window.open(teamsLink, '_blank', 'noopener,noreferrer');
    void leaveRoomVoice();
    send('voice_mode', { mode: 'TEAMS' });
  };

  const saveLink = async (value: string | null) => {
    setError(null);
    try {
      await api('PATCH', `/rooms/${room.id}/link`, { teamsLink: value });
      setEditing(false);
      setLink('');
      toast({
        title: value ? 'Link guardado' : 'Link borrado',
        text: value ? 'Quien entre a la sala verá “Abrir en Teams”.' : 'La sala quedó libre.',
        icon: 'teams',
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  return (
    <div id="room" className="glass" data-testid="room-card">
      <div>
        <h3>{meeting ? meeting.title : room.name}</h3>
        <p>
          {meeting ? `${room.name} · ` : room.description ? `${room.description} · ` : ''}
          {inside} {inside === 1 ? 'persona' : 'personas'} aquí
        </p>
      </div>
      <div className="row">
        <button className={`btn${inApp ? ' primary' : ''}`} onClick={() => void talkHere()}>
          <Icon name="mic" />
          {inApp ? 'Salir del audio' : 'Hablar aquí'}
        </button>
        {inApp && (
          <button className="btn" onClick={() => void toggleMute()}>
            {voice.muted ? 'Activar micrófono' : 'Silenciarme'}
          </button>
        )}
        {teamsLink ? (
          <button className="btn" onClick={openTeams} data-testid="open-teams">
            <Icon name="teams" />
            Abrir en Teams
          </button>
        ) : (
          !room.linkEditableByAll && (
            <span className="hint">Sin link de Teams todavía (lo pone el admin).</span>
          )
        )}
        {room.linkEditableByAll && !editing && (
          <button className="btn" onClick={() => setEditing(true)} data-testid="paste-link">
            {room.teamsLink ? 'Cambiar link' : 'Pegar link de la reunión'}
          </button>
        )}
      </div>
      {editing && (
        <form
          className="row link-form"
          onSubmit={(e) => {
            e.preventDefault();
            void saveLink(link.trim() || null);
          }}
        >
          <input
            className="input"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://teams.microsoft.com/l/meetup-join/…"
            autoFocus
            aria-label="Link de Teams"
          />
          <button className="btn primary sm">Guardar</button>
          {room.teamsLink && (
            <button type="button" className="btn sm" onClick={() => void saveLink(null)}>
              Borrar link
            </button>
          )}
          <button type="button" className="btn sm" onClick={() => setEditing(false)}>
            Cancelar
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </div>
  );
}
