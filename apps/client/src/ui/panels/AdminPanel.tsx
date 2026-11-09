import type { AdminOverview, OfficeHours } from '@laofi/shared';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../../net/api';
import { refreshBuilding } from '../../net/floor';
import { useUi } from '../../state/store';
import { PanelHeader } from '../common';

type Tab = 'people' | 'rooms' | 'floors' | 'hours';

export function AdminPanel() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [tab, setTab] = useState<Tab>('people');
  const [error, setError] = useState<string | null>(null);
  const me = useUi((s) => s.me);
  const toast = useUi((s) => s.toast);

  const load = () => api<AdminOverview>('GET', '/admin/overview').then(setData);
  useEffect(() => {
    void load();
  }, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(null);
    try {
      await fn();
      await Promise.all([load(), refreshBuilding()]);
      toast({ title: ok, icon: 'hi', timeout: 2200 });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  if (!data) return <PanelHeader title="Administración" sub="Cargando…" />;
  const floorName = (id: string | null) => data.floors.find((f) => f.id === id)?.name ?? '—';

  return (
    <>
      <PanelHeader title="Administración" sub="Células, personas, salas y pisos." />
      <div className="tabs">
        {(['people', 'rooms', 'floors', 'hours'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'people'
              ? 'Personas'
              : t === 'rooms'
                ? 'Salas'
                : t === 'floors'
                  ? 'Pisos y células'
                  : 'Horario'}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {tab === 'hours' && (
        <OfficeHoursForm
          onSave={(h) => run(() => api('PUT', '/admin/office-hours', h), 'Horario guardado')}
        />
      )}

      {tab === 'people' && (
        <div className="stack">
          {data.users.map((u) => (
            <div className="admin-row" key={u.id}>
              <div className="pinfo">
                <b>{u.name}</b>
                <span>
                  {u.email} · oficina en {floorName(u.homeFloorId)}
                </span>
              </div>
              <div className="row">
                <select
                  className="input sm"
                  value={u.cellId ?? ''}
                  aria-label={`Célula de ${u.name}`}
                  onChange={(e) =>
                    void run(
                      () => api('PATCH', `/admin/users/${u.id}`, { cellId: e.target.value || null }),
                      'Célula actualizada',
                    )
                  }
                >
                  <option value="">Sin célula (Lobby)</option>
                  {data.cells.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  className="input sm"
                  value={u.role}
                  aria-label={`Rol de ${u.name}`}
                  disabled={u.id === me?.id}
                  onChange={(e) =>
                    void run(
                      () => api('PATCH', `/admin/users/${u.id}`, { role: e.target.value }),
                      'Rol actualizado',
                    )
                  }
                >
                  <option value="MEMBER">Miembro</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <EditText
                label="Cargo"
                value={u.title ?? ''}
                onSave={(v) =>
                  run(() => api('PATCH', `/admin/users/${u.id}`, { title: v || null }), 'Cargo guardado')
                }
              />
              {u.id !== me?.id && (
                <button
                  className="btn sm"
                  onClick={() =>
                    void api<{ password: string }>('POST', `/admin/users/${u.id}/reset-password`)
                      .then(({ password }) =>
                        toast({
                          title: `Contraseña temporal de ${u.name}`,
                          text: `${password} · Se muestra solo esta vez. Deberá cambiarla al entrar.`,
                          icon: 'lock',
                          timeout: 0,
                        }),
                      )
                      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : String(e)))
                  }
                >
                  Restablecer contraseña
                </button>
              )}
            </div>
          ))}
          <NewUser
            cells={data.cells}
            onCreate={(body) =>
              run(async () => {
                const r = await api<{ password: string }>('POST', '/admin/users', body);
                toast({
                  title: `Contraseña temporal de ${String(body.name)}`,
                  text: `${r.password} · Se muestra solo esta vez. Deberá cambiarla al entrar.`,
                  icon: 'lock',
                  timeout: 0,
                });
              }, 'Persona creada')
            }
          />
        </div>
      )}

      {tab === 'rooms' && (
        <div className="stack">
          <p className="hint">
            Pega el link fijo de Teams de cada reunión. La Sala libre la puede cambiar cualquiera.
          </p>
          {data.rooms.map((r) => (
            <div className="admin-row" key={r.id}>
              <div className="pinfo">
                <b>{r.name}</b>
                <span>
                  {floorName(r.floorId)}
                  {r.linkEditableByAll ? ' · editable por todos' : ''}
                </span>
              </div>
              <EditText
                label="Link de Teams"
                placeholder="https://teams.microsoft.com/l/meetup-join/…"
                value={r.teamsLink ?? ''}
                onSave={(v) =>
                  run(() => api('PATCH', `/admin/rooms/${r.id}`, { teamsLink: v || null }), 'Link guardado')
                }
              />
            </div>
          ))}
        </div>
      )}

      {tab === 'floors' && (
        <div className="stack">
          {data.floors.map((f) => (
            <div className="admin-row" key={f.id}>
              <div className="pinfo">
                <b>
                  P{f.level} · {f.name}
                </b>
                <span>
                  {f.isCommon
                    ? 'Zona común (siempre abierta)'
                    : f.isLocked
                      ? 'Cerrado: solo su célula'
                      : 'Abierto a visitas'}
                </span>
              </div>
              {!f.isCommon && (
                <button
                  className="btn sm"
                  onClick={() =>
                    void run(
                      () => api('PATCH', `/admin/floors/${f.id}`, { isLocked: !f.isLocked }),
                      f.isLocked ? 'Piso abierto' : 'Piso cerrado',
                    )
                  }
                  data-testid={`lock-${f.id}`}
                >
                  {f.isLocked ? 'Abrir a visitas' : 'Cerrar a visitas'}
                </button>
              )}
            </div>
          ))}
          <div className="lbl">Células</div>
          {data.cells.map((c) => (
            <div className="admin-row" key={c.id}>
              <div className="row" style={{ alignItems: 'center' }}>
                <input
                  type="color"
                  value={c.color}
                  aria-label={`Color de ${c.name}`}
                  onChange={(e) =>
                    void run(
                      () => api('PATCH', `/admin/cells/${c.id}`, { color: e.target.value }),
                      'Color guardado',
                    )
                  }
                />
                <EditText
                  label="Nombre"
                  value={c.name}
                  onSave={(v) =>
                    run(() => api('PATCH', `/admin/cells/${c.id}`, { name: v }), 'Nombre guardado')
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function EditText({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (v: string) => Promise<unknown>;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <form
      className="row edit-text"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(v.trim());
      }}
    >
      <input
        className="input sm"
        value={v}
        placeholder={placeholder ?? label}
        aria-label={label}
        onChange={(e) => setV(e.target.value)}
      />
      {v !== value && <button className="btn sm primary">Guardar</button>}
    </form>
  );
}

function NewUser({
  cells,
  onCreate,
}: {
  cells: AdminOverview['cells'];
  onCreate: (b: Record<string, unknown>) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', title: '', cellId: '' });
  if (!open)
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        Agregar persona
      </button>
    );
  return (
    <form
      className="stack admin-row"
      onSubmit={(e) => {
        e.preventDefault();
        void onCreate({ ...f, title: f.title || null, cellId: f.cellId || null }).then(() => {
          setOpen(false);
          setF({ name: '', email: '', title: '', cellId: '' });
        });
      }}
    >
      <input
        className="input sm"
        placeholder="Nombre completo"
        value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })}
        required
      />
      <input
        className="input sm"
        placeholder="Email"
        type="email"
        value={f.email}
        onChange={(e) => setF({ ...f, email: e.target.value })}
        required
      />
      <input
        className="input sm"
        placeholder="Cargo (opcional)"
        value={f.title}
        onChange={(e) => setF({ ...f, title: e.target.value })}
      />
      <select
        className="input sm"
        value={f.cellId}
        onChange={(e) => setF({ ...f, cellId: e.target.value })}
        aria-label="Célula"
      >
        <option value="">Sin célula (Lobby)</option>
        {cells.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="hint">Se genera una contraseña temporal que debe cambiar al entrar.</p>
      <div className="row">
        <button className="btn primary sm">Crear</button>
        <button type="button" className="btn sm" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Horario de oficina: dentro de él, quien no está conectado se ve en su puesto; fuera, no aparece. */
function OfficeHoursForm({ onSave }: { onSave: (h: OfficeHours) => Promise<unknown> }) {
  const [h, setH] = useState<OfficeHours | null>(null);
  useEffect(() => {
    void api<OfficeHours>('GET', '/admin/office-hours').then(setH);
  }, []);
  if (!h) return <p className="hint">Cargando…</p>;
  const toggleDay = (d: number) =>
    setH({ ...h, days: h.days.includes(d) ? h.days.filter((x) => x !== d) : [...h.days, d].sort() });
  return (
    <form
      className="stack admin-row"
      data-testid="office-hours"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(h);
      }}
    >
      <p className="hint">
        En este horario, quien no está conectado se ve en su puesto haciendo algo según su estado
        (escribiendo, almorzando en el comedor, en reunión). Fuera de horario no aparece.
      </p>
      <div className="row">
        <label className="row">
          Entrada
          <input
            className="input sm"
            type="time"
            value={h.start}
            onChange={(e) => setH({ ...h, start: e.target.value })}
            required
          />
        </label>
        <label className="row">
          Salida
          <input
            className="input sm"
            type="time"
            value={h.end}
            onChange={(e) => setH({ ...h, end: e.target.value })}
            required
          />
        </label>
      </div>
      <div className="row">
        {DAYS.map((name, d) => (
          <label key={d} className="row">
            <input type="checkbox" checked={h.days.includes(d)} onChange={() => toggleDay(d)} />
            {name}
          </label>
        ))}
      </div>
      <label className="row">
        Zona horaria
        <input
          className="input sm"
          value={h.timeZone}
          onChange={(e) => setH({ ...h, timeZone: e.target.value })}
          required
        />
      </label>
      <div className="row">
        <button className="btn primary sm">Guardar horario</button>
      </div>
    </form>
  );
}
