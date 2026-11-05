import {
  type CurrentWork,
  WORK_ACTIVITIES,
  WORK_ACTIVITY_LABEL,
  type WorkActivity,
  canCreateDelivery,
  workItemIdFromUrl,
} from '@laofi/shared';
import { useState } from 'react';
import { ApiError, api } from '../../net/api';
import { actorFrom, useUi } from '../../state/store';
import { PanelHeader } from '../common';

/** Publica en qué estás trabajando. Se ve sobre tu oficina y el clic lleva al work item. */
export function WorkPanel() {
  const me = useUi((s) => s.me);
  const current = me?.currentWork ?? null;
  const [activity, setActivity] = useState<WorkActivity>(
    current?.activity ?? (me?.cellType === 'QA' ? 'TESTING' : 'DEVELOPING'),
  );
  const [itemId, setItemId] = useState(current?.itemId ?? '');
  const [title, setTitle] = useState(current?.title ?? '');
  const [url, setUrl] = useState(current?.url ?? '');
  const [error, setError] = useState<string | null>(null);
  if (!me) return null;

  const publish = async (work: Omit<CurrentWork, 'title' | 'url'> & Partial<CurrentWork>) => {
    const r = await api<{ work: CurrentWork | null }>('PUT', '/me/work', { work });
    useUi.getState().set({ me: { ...me, currentWork: r.work } });
    useUi.getState().closePanel();
  };

  const guarded = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const clear = async () => {
    const r = await api<{ work: null }>('PUT', '/me/work', { work: null });
    useUi.getState().set({ me: { ...me, currentWork: r.work } });
    setItemId('');
    setTitle('');
    setUrl('');
  };

  /** Saca la HU de tu oficina y la manda a QA en un solo paso. */
  const deliver = async () => {
    if (!current) return;
    await api('POST', '/deliveries', {
      externalId: current.itemId,
      title: current.title || `Entrega ${current.itemId}`,
      url: current.url,
    });
    await clear();
    useUi.getState().toast({
      title: `${current.itemId} va para QA`,
      text: 'La caja salió hacia el muelle.',
      icon: 'box',
    });
  };

  return (
    <>
      <PanelHeader title="¿En qué estás?" sub="Se ve sobre tu oficina. Lo pones y lo quitas tú." />
      <form
        className="stack dlv-form"
        onSubmit={(e) => {
          e.preventDefault();
          void guarded(() =>
            publish({
              activity,
              itemId,
              title: title.trim() || null,
              url: url.trim() || null,
            }),
          );
        }}
      >
        <select
          className="input"
          value={activity}
          onChange={(e) => setActivity(e.target.value as WorkActivity)}
          aria-label="Qué estás haciendo"
        >
          {WORK_ACTIVITIES.map((a) => (
            <option key={a} value={a}>
              {WORK_ACTIVITY_LABEL[a]}
            </option>
          ))}
        </select>
        <input
          className="input"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            const id = workItemIdFromUrl(e.target.value);
            if (id && !itemId) setItemId(id);
          }}
          placeholder="Link del work item (https://dev.azure.com/…)"
          aria-label="Link del work item"
        />
        <input
          className="input"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          placeholder="HU o work item, por ejemplo HU-1302"
          aria-label="HU o work item"
          maxLength={40}
          required
        />
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="De qué se trata (opcional)"
          aria-label="De qué se trata"
          maxLength={120}
        />
        <button className="btn primary sm" data-testid="work-save">
          Publicar en mi oficina
        </button>
        {error && <p className="error">{error}</p>}
      </form>
      {current && (
        <div className="row" style={{ marginTop: 10 }}>
          {canCreateDelivery(actorFrom(me)) && (
            <button className="btn sm" onClick={() => void guarded(deliver)} data-testid="work-deliver">
              Entregar a QA
            </button>
          )}
          <button className="btn sm" onClick={() => void guarded(clear)} data-testid="work-clear">
            Ya terminé
          </button>
        </div>
      )}
    </>
  );
}
