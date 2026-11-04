import type { DirectoryEntry } from '@laofi/shared';
import { useEffect, useState } from 'react';
import { directory, goToDoor } from '../../actions';
import { live } from '../../net/floor';
import { STATUS_INFO, useUi } from '../../state/store';
import { Face, PanelHeader, fold } from '../common';

export function DirectoryPanel() {
  const [list, setList] = useState<DirectoryEntry[]>([]);
  const [q, setQ] = useState('');
  const me = useUi((s) => s.me);
  const building = useUi((s) => s.building);
  const open = useUi((s) => s.openPanel);

  useEffect(() => {
    void directory(true).then(setList);
  }, []);

  const avatarOf = (id: string) => [...live.players.values()].find((p) => p.userId === id)?.avatar;
  const floorName = (id: string | null) => building?.floors.find((f) => f.id === id)?.name ?? 'Fuera';
  const shown = list.filter(
    (p) =>
      p.id !== me?.id && (!q || fold(`${p.name} ${p.cell?.name ?? ''} ${p.title ?? ''}`).includes(fold(q))),
  );

  return (
    <>
      <PanelHeader title="Directorio" sub={`${list.length - 1} compañeros`} />
      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Busca por nombre o célula"
        autoComplete="off"
        autoFocus={window.innerWidth > 720}
        aria-label="Buscar"
      />
      <div style={{ marginTop: 8 }}>
        {shown.map((p) => (
          <div className="person" key={p.id} data-testid={`dir-${p.id}`}>
            <Face avatar={avatarOf(p.id)} />
            <button className="pinfo" onClick={() => open('person', p.id)}>
              <b>{p.name}</b>
              <span>
                <i
                  className="dot"
                  style={{ background: STATUS_INFO[p.status].color, boxShadow: 'none', width: 7, height: 7 }}
                />{' '}
                {STATUS_INFO[p.status].label} · {p.online ? floorName(p.floorId) : 'Desconectada'}
                {p.cell ? ` · ${p.cell.name}` : p.title ? ` · ${p.title}` : ''}
              </span>
            </button>
            <button
              className="btn sm"
              onClick={() => {
                useUi.getState().closePanel();
                void goToDoor(p.id).then((ok) => ok && open('person', p.id));
              }}
            >
              Ir a su puerta
            </button>
          </div>
        ))}
        {!shown.length && <p className="hint">No encontré a nadie con ese nombre.</p>}
      </div>
    </>
  );
}
