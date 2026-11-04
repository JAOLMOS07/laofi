import { CATALOG, FURNITURE_KEYS, type FurnitureKey } from '@laofi/shared';
import { goHome } from '../../actions';
import { live, send } from '../../net/floor';
import { rotateSelected } from '../../scene/engine';
import { useUi } from '../../state/store';
import { PanelHeader } from '../common';

const COLORS = [
  '#b98a5e',
  '#e07a5f',
  '#f2cc8f',
  '#81b29a',
  '#5c9a5a',
  '#577590',
  '#3f5a73',
  '#9c89b8',
  '#d98f6c',
  '#3d405b',
];
const WALLS = ['#fbf2e9', '#f7efdf', '#eef4f1', '#e8eef7', '#f6e6e6', '#efe6f5', '#e9e3d6', '#dfe7d8'];
const FLOORS = ['#ecd6c3', '#e8dcc0', '#d0e4de', '#d8dfea', '#e6d3c9', '#cfc6b8', '#c9b79c', '#b9c9b4'];

export function EditPanel() {
  const me = useUi((s) => s.me);
  const floor = useUi((s) => s.floor);
  const edit = useUi((s) => s.edit);
  const setEdit = useUi((s) => s.setEdit);
  useUi((s) => s.staticVersion);
  const office = floor?.offices.find((o) => o.ownerId === me?.id);

  if (!office) {
    return (
      <>
        <PanelHeader title="Decorar mi oficina" />
        <p className="hint">Tu oficina queda en otro piso.</p>
        <button className="btn primary" onClick={() => void goHome()}>
          Ir a mi oficina
        </button>
      </>
    );
  }
  const st = live.offices.get(office.id);
  const sel = edit.selId ? live.furniture.get(edit.selId) : undefined;
  const editable = FURNITURE_KEYS.filter((k) => CATALOG[k].editable);

  const pick = (k: FurnitureKey) =>
    setEdit(
      edit.key === k && !edit.movingId
        ? { key: null }
        : { key: k, rot: 0, color: CATALOG[k].color, selId: null, movingId: null },
    );

  return (
    <>
      <PanelHeader
        title="Decorar mi oficina"
        sub="Solo tú puedes editarla. Los demás ven los cambios en vivo."
      />
      <div className="stack">
        <div className="lbl">Catálogo</div>
        <div className="grid-cat">
          {editable.map((k) => (
            <button
              key={k}
              className={`cat${edit.key === k && !edit.movingId ? ' on' : ''}`}
              onClick={() => pick(k)}
              data-testid={`cat-${k}`}
            >
              <b>{CATALOG[k].name}</b>
              <span>
                {CATALOG[k].w}×{CATALOG[k].d}
              </span>
            </button>
          ))}
        </div>
        {edit.key && (
          <>
            <div className="lbl">Color</div>
            <div className="sw">
              {COLORS.map((c) => (
                <button
                  key={c}
                  style={{ background: c }}
                  className={edit.color === c ? 'on' : ''}
                  onClick={() => setEdit({ color: c })}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </>
        )}
        <p className="hint">
          {edit.key ? (
            <>
              Clic en tu oficina para {edit.movingId ? 'soltarlo' : 'colocarlo'}. <kbd>R</kbd> rota,{' '}
              <kbd>Esc</kbd> cancela.
            </>
          ) : (
            'Elige un mueble, o haz clic en uno de tu oficina para rotarlo, moverlo, cambiarle el color o quitarlo.'
          )}
        </p>
        {sel && !edit.key && (
          <>
            <div className="lbl">Seleccionado: {CATALOG[sel.key].name}</div>
            <div className="row">
              <button className="btn sm" onClick={rotateSelected}>
                Rotar 90°
              </button>
              <button
                className="btn sm"
                onClick={() =>
                  setEdit({ key: sel.key, rot: sel.rot, color: sel.color, movingId: sel.id, selId: null })
                }
              >
                Mover
              </button>
              <button
                className="btn sm"
                onClick={() => {
                  send('furniture_remove', { id: sel.id });
                  setEdit({ selId: null });
                }}
              >
                Quitar
              </button>
            </div>
            {CATALOG[sel.key].colorable && (
              <div className="sw">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    style={{ background: c }}
                    className={sel.color === c ? 'on' : ''}
                    onClick={() => send('furniture_recolor', { id: sel.id, color: c })}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
        <div className="lbl">Paredes</div>
        <div className="sw">
          {WALLS.map((c) => (
            <button
              key={c}
              style={{ background: c }}
              className={st?.wallColor === c ? 'on' : ''}
              onClick={() => send('office_style', { wallColor: c })}
              aria-label={`Pared ${c}`}
            />
          ))}
        </div>
        <div className="lbl">Piso</div>
        <div className="sw">
          {FLOORS.map((c) => (
            <button
              key={c}
              style={{ background: c }}
              className={st?.floorColor === c ? 'on' : ''}
              onClick={() => send('office_style', { floorColor: c })}
              aria-label={`Piso ${c}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
