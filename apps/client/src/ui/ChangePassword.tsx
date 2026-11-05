import type { Me } from '@laofi/shared';
import { useState } from 'react';
import { startSession } from '../actions';
import { api } from '../net/api';
import { useUi } from '../state/store';
import { Icon } from './icons';

/** Primer ingreso con contraseña temporal: hay que cambiarla antes de entrar a la oficina. */
export function ChangePassword() {
  const name = useUi((s) => s.me?.name);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== repeat) {
      setError('Las dos contraseñas nuevas no coinciden.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await startSession(await api<Me>('POST', '/me/password', { current, next }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await api('POST', '/auth/logout').catch(() => undefined);
    location.reload();
  };

  return (
    <div className="login">
      <form className="login-card glass" onSubmit={submit}>
        <div className="brand big">
          <div className="brand-mark">
            <Icon name="lock" />
          </div>
          <span>Cambia tu contraseña</span>
        </div>
        <p className="hint">Hola, {name}. Esa contraseña era temporal: elige una tuya para seguir.</p>
        <label className="lbl" htmlFor="pw-current">
          Contraseña temporal
        </label>
        <input
          id="pw-current"
          className="input"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <label className="lbl" htmlFor="pw-next">
          Contraseña nueva (mínimo 10 caracteres)
        </label>
        <input
          id="pw-next"
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={10}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <label className="lbl" htmlFor="pw-repeat">
          Repite la contraseña nueva
        </label>
        <input
          id="pw-repeat"
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={10}
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          required
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary wide" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar y entrar'}
        </button>
        <button type="button" className="btn wide" onClick={() => void logout()}>
          Salir
        </button>
      </form>
    </div>
  );
}
