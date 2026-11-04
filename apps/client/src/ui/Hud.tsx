import { STATUSES, type Status } from '@laofi/shared';
import { send } from '../net/floor';
import { STATUS_INFO, useUi } from '../state/store';
import { Icon } from './icons';

export function Hud() {
  const floor = useUi((s) => s.floor);
  const me = useUi((s) => s.me);
  const building = useUi((s) => s.building);
  useUi((s) => s.peopleVersion);
  const mySid = useUi((s) => s.mySid);
  if (!me) return null;
  const visitor = !!floor?.cell && floor.cell.id !== me.cell?.id;
  const accent = floor?.cell?.color ?? '#6b7f99';
  const level = building?.floors.find((f) => f.id === floor?.id)?.level ?? floor?.level;
  const status = me.status;

  const setStatus = (s: Status) => {
    send('set_status', { status: s });
    useUi.getState().set({ me: { ...me, status: s } });
  };

  return (
    <header className="top">
      <div className="where glass">
        <div className="brand">
          <div className="brand-mark" style={{ background: accent }}>
            <Icon name="hi" />
          </div>
          <span>La Ofi</span>
        </div>
        <div className="sep" />
        <div className="floorinfo">
          <small>Piso {level ?? '–'}</small>
          <b data-testid="floor-name">
            {floor ? (floor.cell ? `Célula ${floor.cell.name}` : floor.name) : 'Conectando…'}
          </b>
        </div>
        {visitor && me.cell && (
          <div className="visitor on" data-testid="visitor-badge">
            <i style={{ background: me.cell.color }} />
            <span>Visitante ·</span> <b>{me.cell.name}</b>
          </div>
        )}
        {floor?.isLocked && <span className="chip">Cerrado a visitas</span>}
      </div>
      <div className="me glass" data-sid={mySid ?? ''}>
        <div className="who">
          <b>{me.name}</b>
          <span>{me.cell ? `Célula ${me.cell.name}` : (me.title ?? 'Sin célula')}</span>
        </div>
        <div className="status-wrap">
          <i className="dot" style={{ background: STATUS_INFO[status].color }} />
          <select
            className="status-select"
            aria-label="Tu estado"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            data-testid="status-select"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_INFO[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
