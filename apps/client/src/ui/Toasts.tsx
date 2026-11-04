import { useUi } from '../state/store';
import { Icon } from './icons';

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div id="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast glass" data-testid="toast">
          <div className="ic">
            <Icon name={t.icon ?? 'hi'} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{t.title}</b>
            {t.text && <p>{t.text}</p>}
            {t.actions && (
              <div className="row">
                {t.actions.map((a) => (
                  <button
                    key={a.label}
                    className={`btn sm${a.primary ? ' primary' : ''}`}
                    onClick={() => {
                      a.run();
                      dismiss(t.id);
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="x" aria-label="Cerrar aviso" onClick={() => dismiss(t.id)}>
            <Icon name="close" />
          </button>
        </div>
      ))}
    </div>
  );
}
