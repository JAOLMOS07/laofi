import { ACCESSORIES, type AvatarConfig, HAIR_STYLES, type Me, SKIN_TONES } from '@laofi/shared';
import { useState } from 'react';
import { api } from '../../net/api';
import { useUi } from '../../state/store';
import { Face, PanelHeader } from '../common';

const HAIR_LABEL: Record<(typeof HAIR_STYLES)[number], string> = {
  short: 'Corto',
  long: 'Largo',
  bun: 'Moño',
  cap: 'Gorra',
  none: 'Sin pelo',
};
const ACC_LABEL: Record<(typeof ACCESSORIES)[number], string> = {
  none: 'Nada',
  glasses: 'Gafas',
  headphones: 'Audífonos',
};
const HAIR_COLORS = ['#1b1b1b', '#24170f', '#4a2c17', '#6b3a1f', '#8a5a2b', '#c38e4f', '#e2c27a', '#9aa0a6'];
const CLOTHES = [
  '#2f6f62',
  '#e07a5f',
  '#81b29a',
  '#f2cc8f',
  '#577590',
  '#9c89b8',
  '#f28482',
  '#e9c46a',
  '#3d405b',
  '#6d9dc5',
];
const PANTS = ['#3a3f55', '#2d3142', '#22223b', '#264653', '#355070', '#43485c', '#3d3d3d', '#5a4a3a'];

function Swatches({
  list,
  value,
  onPick,
  label,
}: {
  list: readonly string[];
  value: string;
  onPick: (c: string) => void;
  label: string;
}) {
  return (
    <div className="sw">
      {list.map((c) => (
        <button
          key={c}
          style={{ background: c }}
          className={value === c ? 'on' : ''}
          onClick={() => onPick(c)}
          aria-label={`${label} ${c}`}
        />
      ))}
    </div>
  );
}

export function AvatarPanel() {
  const me = useUi((s) => s.me)!;
  const [a, setA] = useState<AvatarConfig>(me.avatar);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<AvatarConfig>) => setA({ ...a, ...p });

  const save = async () => {
    setBusy(true);
    try {
      const next = await api<Me>('PUT', '/me/avatar', a);
      useUi.getState().set({ me: next });
      useUi.getState().toast({ title: 'Avatar guardado', icon: 'hi', timeout: 2500 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PanelHeader title="Mi avatar">
        <div className="card-hero">
          <Face avatar={a} big />
          <div>
            <h2>Mi avatar</h2>
            <p>Así te ven los demás.</p>
          </div>
        </div>
      </PanelHeader>
      <div className="stack">
        <div className="lbl">Piel</div>
        <Swatches list={SKIN_TONES} value={a.skin} onPick={(skin) => set({ skin })} label="Piel" />
        <div className="lbl">Peinado</div>
        <div className="row">
          {HAIR_STYLES.map((h) => (
            <button
              key={h}
              className={`btn sm${a.hair === h ? ' primary' : ''}`}
              onClick={() => set({ hair: h })}
            >
              {HAIR_LABEL[h]}
            </button>
          ))}
        </div>
        <div className="lbl">Color de pelo</div>
        <Swatches
          list={HAIR_COLORS}
          value={a.hairColor}
          onPick={(hairColor) => set({ hairColor })}
          label="Pelo"
        />
        <div className="lbl">Camisa</div>
        <Swatches list={CLOTHES} value={a.shirt} onPick={(shirt) => set({ shirt })} label="Camisa" />
        <div className="lbl">Pantalón</div>
        <Swatches list={PANTS} value={a.pants} onPick={(pants) => set({ pants })} label="Pantalón" />
        <div className="lbl">Accesorio</div>
        <div className="row">
          {ACCESSORIES.map((x) => (
            <button
              key={x}
              className={`btn sm${a.accessory === x ? ' primary' : ''}`}
              onClick={() => set({ accessory: x })}
            >
              {ACC_LABEL[x]}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </>
  );
}
