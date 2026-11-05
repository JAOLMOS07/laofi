import type { DirectoryEntry } from '@laofi/shared';
import { useEffect, useState } from 'react';
import { directory, goToDoor, knockOn } from '../../actions';
import { playerByUser, send } from '../../net/floor';
import { firstName, useUi } from '../../state/store';
import { Face, PanelHeader, StatusChip, WorkLink } from '../common';
import { Icon } from '../icons';

export function PersonPanel({ userId }: { userId: string }) {
  const [person, setPerson] = useState<DirectoryEntry | null>(null);
  const [text, setText] = useState('');
  const building = useUi((s) => s.building);
  const floor = useUi((s) => s.floor);
  useUi((s) => s.peopleVersion);

  useEffect(() => {
    void directory(true).then((list) => setPerson(list.find((p) => p.id === userId) ?? null));
  }, [userId]);

  if (!person) return <PanelHeader title="Cargando…" />;
  const here = playerByUser(userId);
  const floorName = (id: string | null) => building?.floors.find((f) => f.id === id)?.name ?? '—';
  const roomName = person.roomId ? floor?.rooms.find((r) => r.id === person.roomId)?.name : null;
  const where = !person.online
    ? 'Desconectada'
    : roomName
      ? `En ${roomName}`
      : person.floorId === person.homeFloorId
        ? 'En su piso'
        : `De visita en ${floorName(person.floorId)}`;
  const status = here?.status ?? person.status;
  const silent = status === 'FOCUS' || status === 'AWAY' || !person.online;

  const note = () => {
    const t = text.trim();
    if (!t) return;
    send('note_create', { toUserId: userId, text: t });
    setText('');
  };

  return (
    <>
      <PanelHeader title={person.name}>
        <div className="card-hero">
          <Face avatar={here?.avatar} big />
          <div>
            <h2>{person.name}</h2>
            <p>
              {[person.title, person.cell ? `Célula ${person.cell.name}` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </PanelHeader>
      <dl className="kv">
        <dt>Estado</dt>
        <dd>
          <StatusChip status={status} />
        </dd>
        {person.currentWork && (
          <>
            <dt>En qué está</dt>
            <dd>
              <WorkLink work={person.currentWork} />
            </dd>
          </>
        )}
        <dt>Dónde está</dt>
        <dd>{where}</dd>
        <dt>Su oficina</dt>
        <dd>{floorName(person.homeFloorId)}</dd>
        {here && here.voiceMode !== 'NONE' && (
          <>
            <dt>Voz</dt>
            <dd>{here.voiceMode === 'TEAMS' ? 'Conectada en Teams' : 'Hablando en la app'}</dd>
          </>
        )}
      </dl>
      <div className="stack">
        <div className="row">
          <button className="btn primary" onClick={() => void knockOn(userId)} data-testid="knock">
            <Icon name="knock" />
            Toc toc
          </button>
          <button
            className="btn"
            onClick={() => void goToDoor(userId).then(() => useUi.getState().closePanel())}
          >
            <Icon name="door" />
            Ir a su puerta
          </button>
          {here && (
            <button
              className="btn"
              onClick={() => {
                useUi
                  .getState()
                  .set({ ptt: { live: false, target: 'USER', id: userId, label: firstName(person.name) } });
                useUi.getState().toast({
                  title: 'Walkie listo',
                  text: `Mantén Espacio o el botón Walkie para hablarle a ${firstName(person.name)}.`,
                  icon: 'mic',
                });
              }}
            >
              <Icon name="mic" />
              Walkie
            </button>
          )}
        </div>
        <div className="lbl" style={{ marginTop: 4 }}>
          Dejar un post-it en su escritorio
        </div>
        <textarea
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej.: Te pasé la HU-1302 a QA, avísame si falta algo."
          data-testid="note-text"
        />
        <div className="row">
          <button className="btn" onClick={note} disabled={!text.trim()} data-testid="note-send">
            <Icon name="note" />
            Pegar post-it
          </button>
        </div>
        {silent && (
          <p className="hint">
            {person.online
              ? 'Está en foco o ausente: su puerta está cerrada y tu toque le llegará como aviso silencioso.'
              : 'No está conectada: tu toque y tus post-its la esperan en su bandeja.'}
          </p>
        )}
      </div>
    </>
  );
}
