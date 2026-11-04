import type { NoteInfo, QueuedKnock } from '@laofi/shared';
import { useEffect, useState } from 'react';
import { api } from '../../net/api';
import { refreshInbox } from '../../net/floor';
import { useUi } from '../../state/store';
import { PanelHeader, timeStr } from '../common';

export function NotesPanel() {
  const [tab, setTab] = useState<'notes' | 'knocks'>('notes');
  const [notes, setNotes] = useState<NoteInfo[]>([]);
  const [knocks, setKnocks] = useState<QueuedKnock[]>([]);
  const unread = useUi((s) => s.unreadNotes);

  const load = async () => {
    const [n, k] = await Promise.all([
      api<NoteInfo[]>('GET', '/notes'),
      api<QueuedKnock[]>('GET', '/knocks/queued'),
    ]);
    setNotes(n);
    setKnocks(k);
  };
  useEffect(() => {
    void load();
  }, [unread]);

  const read = async (id: string) => {
    await api('POST', `/notes/${id}/read`);
    await Promise.all([load(), refreshInbox()]);
  };
  const clearKnocks = async () => {
    await api('POST', '/knocks/queued/clear');
    await Promise.all([load(), refreshInbox()]);
  };

  return (
    <>
      <PanelHeader title="Tu escritorio" sub="Post-its y toques que quedaron en cola (se guardan 30 días)." />
      <div className="tabs">
        <button className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>
          Post-its ({notes.filter((n) => !n.readAt).length})
        </button>
        <button className={tab === 'knocks' ? 'on' : ''} onClick={() => setTab('knocks')}>
          Toques en cola ({knocks.length})
        </button>
      </div>
      <div className="stack">
        {tab === 'notes' &&
          (notes.length ? (
            notes.map((n) => (
              <div key={n.id} className={`note${n.readAt ? ' read' : ''}`} data-testid="note">
                <small>
                  {n.fromName} · {timeStr(n.createdAt)}
                </small>
                {n.text}
                {!n.readAt && (
                  <div className="row">
                    <button className="btn sm" onClick={() => void read(n.id)}>
                      Marcar como leída
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="hint">No tienes post-its.</p>
          ))}
        {tab === 'knocks' &&
          (knocks.length ? (
            <>
              {knocks.map((k) => (
                <div className="person" key={k.id}>
                  <div className="pinfo">
                    <b>{k.fromName}</b>
                    <span>Tocó tu puerta · {timeStr(k.createdAt)}</span>
                  </div>
                </div>
              ))}
              <button className="btn sm" onClick={() => void clearKnocks()}>
                Marcar como vistos
              </button>
            </>
          ) : (
            <p className="hint">Nadie ha tocado mientras estabas en foco o fuera.</p>
          ))}
      </div>
    </>
  );
}
