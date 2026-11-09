import { api } from '../net/api';
import { leaveFloor, live } from '../net/floor';
import { toggleMyDoor } from '../scene/engine';
import { useUi } from '../state/store';
import { Icon, type IconName } from './icons';
import { pttLabel, pttStart, pttStop } from './Office';

function DockButton({
  icon,
  label,
  on,
  onClick,
  count,
  testid,
}: {
  icon: IconName;
  label: string;
  on?: boolean;
  onClick: () => void;
  count?: number;
  testid?: string;
}) {
  return (
    <button className={`dbtn${on ? ' on' : ''}`} onClick={onClick} data-testid={testid}>
      <Icon name={icon} />
      {label}
      {!!count && <span className="count">{count}</span>}
    </button>
  );
}

export function Dock() {
  const panel = useUi((s) => s.panel?.kind);
  const toggle = useUi((s) => s.togglePanel);
  const unread = useUi((s) => s.unreadNotes + s.queuedKnocks);
  const ptt = useUi((s) => s.ptt);
  useUi((s) => s.roomId);
  const me = useUi((s) => s.me);
  useUi((s) => s.staticVersion);
  const myOffice = [...live.offices.values()].find((o) => o.ownerId === me?.id);

  const logout = async () => {
    await leaveFloor();
    await api('POST', '/auth/logout').catch(() => undefined);
    location.reload();
  };

  return (
    <>
      {ptt.target === 'USER' && (
        <div className="ptt-target glass">
          Walkie a <b>{ptt.label}</b>
          <button
            className="x"
            aria-label="Volver a hablarle al piso"
            onClick={() =>
              useUi.getState().set({ ptt: { live: false, target: 'FLOOR', label: 'todo el piso' } })
            }
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      <nav className="dock glass" aria-label="Acciones">
        <DockButton
          icon="elevator"
          label="Ascensor"
          on={panel === 'elevator'}
          onClick={() => toggle('elevator')}
          testid="dock-elevator"
        />
        <DockButton
          icon="search"
          label="Directorio"
          on={panel === 'directory'}
          onClick={() => toggle('directory')}
          testid="dock-directory"
        />
        <DockButton
          icon="layers"
          label="Edificio"
          on={panel === 'building'}
          onClick={() => toggle('building')}
        />
        <div className="dsep" />
        <DockButton
          icon="pencil"
          label="Mi oficina"
          on={panel === 'edit'}
          onClick={() => toggle('edit')}
          testid="dock-edit"
        />
        {myOffice && (
          <DockButton
            icon="door"
            label={myOffice.doorClosed ? 'Abrir puerta' : 'Cerrar puerta'}
            on={myOffice.doorClosed}
            onClick={() => toggleMyDoor()}
            testid="dock-door"
          />
        )}
        <DockButton
          icon="note"
          label="Notas"
          on={panel === 'notes'}
          onClick={() => toggle('notes')}
          count={unread}
          testid="dock-notes"
        />
        <DockButton
          icon="box"
          label="Entregas"
          on={panel === 'deliveries'}
          onClick={() => toggle('deliveries')}
          testid="dock-deliveries"
        />
        <DockButton
          icon="calendar"
          label="Agenda"
          on={panel === 'agenda'}
          onClick={() => toggle('agenda')}
          testid="dock-agenda"
        />
        <button
          className={`dbtn ptt${ptt.live ? ' live' : ''}`}
          title={`Mantén presionado para hablar a ${pttLabel()}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pttStart();
          }}
          onPointerUp={pttStop}
          onPointerCancel={pttStop}
        >
          <Icon name="mic" />
          {ptt.live ? 'Hablando…' : 'Walkie'}
        </button>
        <div className="dsep" />
        <DockButton icon="user" label="Mi avatar" on={panel === 'avatar'} onClick={() => toggle('avatar')} />
        <DockButton
          icon="plug"
          label="Integraciones"
          on={panel === 'integrations'}
          onClick={() => toggle('integrations')}
          testid="dock-integrations"
        />
        {me?.role === 'ADMIN' && (
          <DockButton
            icon="gear"
            label="Admin"
            on={panel === 'admin'}
            onClick={() => toggle('admin')}
            testid="dock-admin"
          />
        )}
        <DockButton icon="out" label="Salir" onClick={() => void logout()} />
      </nav>
    </>
  );
}
