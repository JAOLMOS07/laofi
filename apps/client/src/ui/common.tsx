import { type AvatarConfig, type CurrentWork, type Status, WORK_ACTIVITY_LABEL } from '@laofi/shared';
import { STATUS_INFO, useUi } from '../state/store';
import { Icon } from './icons';

export function Face({ avatar, big }: { avatar?: AvatarConfig | null; big?: boolean }) {
  const style = {
    '--skin': avatar?.skin ?? '#d9a47c',
    '--hair': avatar?.hair === 'none' ? 'transparent' : (avatar?.hairColor ?? '#2a1a12'),
    background: avatar?.shirt ?? '#2f6f62',
  } as React.CSSProperties;
  return <div className={`face${big ? ' big' : ''}`} style={style} aria-hidden="true" />;
}

export function StatusChip({ status }: { status: Status }) {
  return (
    <span className="chip">
      <i
        className="dot"
        style={{ background: STATUS_INFO[status].color, boxShadow: 'none', width: 8, height: 8 }}
      />
      {STATUS_INFO[status].label}
    </span>
  );
}

export function PanelHeader({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  const close = useUi((s) => s.closePanel);
  return (
    <div className="ph">
      {children ?? (
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
      )}
      <button className="x" onClick={close} aria-label="Cerrar">
        <Icon name="close" />
      </button>
    </div>
  );
}

export const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
export const timeStr = (iso: string): string =>
  new Date(iso).toLocaleString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  });

export const workLabel = (w: CurrentWork): string => `${WORK_ACTIVITY_LABEL[w.activity]} ${w.itemId}`;

/** "Desarrollando HU-1302", con link al work item si la persona lo puso. */
export function WorkLink({ work }: { work: CurrentWork }) {
  const text = workLabel(work);
  return (
    <>
      {work.url ? (
        <a href={work.url} target="_blank" rel="noopener noreferrer" data-testid="work-link">
          {text}
        </a>
      ) : (
        text
      )}
      {work.title ? ` · ${work.title}` : ''}
    </>
  );
}
