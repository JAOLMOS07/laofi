import type { MeetingInfo, RoomRef } from '@laofi/shared';
import { useEffect, useState } from 'react';
import { acceptMeeting } from '../../actions';
import { ApiError, api } from '../../net/api';
import { refreshMeetings } from '../../net/floor';
import { useUi } from '../../state/store';
import { PanelHeader, timeStr } from '../common';

/** Valor inicial del selector: la próxima media hora, en hora local. */
function nextSlot(): string {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function NewMeeting({ rooms }: { rooms: RoomRef[] }) {
  const cellRoom = useUi((s) => (s.me?.cell ? `sala-${s.me.cell.id}` : ''));
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(nextSlot);
  const [durationMin, setDuration] = useState(30);
  const [roomId, setRoomId] = useState('');
  const [teamsLink, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const room = roomId || (rooms.some((r) => r.id === cellRoom) ? cellRoom : (rooms[0]?.id ?? ''));

  const submit = async () => {
    setError(null);
    try {
      await api('POST', '/meetings', {
        title,
        startsAt: new Date(startsAt).toISOString(),
        durationMin,
        roomId: room,
        teamsLink: teamsLink.trim() || null,
      });
      setTitle('');
      setLink('');
      await refreshMeetings();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  return (
    <form
      className="stack dlv-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nombre de la reunión"
        aria-label="Nombre de la reunión"
        minLength={2}
        maxLength={120}
        required
      />
      <div className="row nowrap">
        <input
          className="input"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          aria-label="Hora de inicio"
          required
        />
        <select
          className="input auto"
          value={durationMin}
          onChange={(e) => setDuration(Number(e.target.value))}
          aria-label="Duración"
        >
          {[15, 30, 45, 60, 90].map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
      </div>
      <select className="input" value={room} onChange={(e) => setRoomId(e.target.value)} aria-label="Sala">
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} · {r.floorName}
          </option>
        ))}
      </select>
      <input
        className="input"
        value={teamsLink}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Link de Teams (opcional)"
        aria-label="Link de Teams de la reunión"
      />
      <button className="btn primary sm" data-testid="meeting-save">
        Agregar a mi agenda
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function MeetingRow({ m }: { m: MeetingInfo }) {
  const cancel = async () => {
    await api('POST', `/meetings/${m.id}/cancel`);
    await refreshMeetings();
  };
  return (
    <div className="dlv" data-testid="meeting">
      <div className="dlv-top">
        <b>{m.title}</b>
        {m.source === 'DEMO' && <span className="pill demo">Demo</span>}
      </div>
      <small>
        {timeStr(m.startsAt)} · {m.roomName}
      </small>
      <div className="row">
        <button className="btn sm primary" onClick={() => void acceptMeeting(m)}>
          Ir a la sala
        </button>
        <button className="btn sm" onClick={() => void cancel()}>
          Quitar
        </button>
      </div>
    </div>
  );
}

export function AgendaPanel() {
  const meetings = useUi((s) => s.meetings);
  const toast = useUi((s) => s.toast);
  const [rooms, setRooms] = useState<RoomRef[]>([]);

  useEffect(() => {
    void refreshMeetings();
    void api<RoomRef[]>('GET', '/rooms').then(setRooms);
  }, []);

  const tryNotice = async () => {
    try {
      await api('POST', '/demo/meeting');
      await refreshMeetings();
    } catch (e) {
      toast({ title: 'No se pudo', text: e instanceof ApiError ? e.message : String(e), icon: 'x' });
    }
  };

  return (
    <>
      <PanelHeader title="Mi agenda" sub="Un minuto antes te aviso y te llevo a la sala." />
      <div className="sena">
        <span className="pill ti">Pendiente de TI</span>
        <p>
          Hoy la llenas a mano. Con permiso para leer el calendario, tus reuniones de Outlook y su link de
          Teams aparecerían aquí solas.
        </p>
        <button className="btn sm" disabled title="Necesita registrar la app en Microsoft Entra ID">
          Conectar mi calendario
        </button>
      </div>
      <button className="btn" onClick={() => void tryNotice()} data-testid="meeting-demo">
        Probar el aviso ahora
      </button>
      <div className="stack dlv-list">
        {meetings.length ? (
          meetings.map((m) => <MeetingRow key={m.id} m={m} />)
        ) : (
          <p className="hint">No tienes reuniones próximas.</p>
        )}
      </div>
      <h3 className="sub">Agregar reunión</h3>
      <NewMeeting rooms={rooms} />
    </>
  );
}
