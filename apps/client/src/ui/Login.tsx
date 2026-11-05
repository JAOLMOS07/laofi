import type { Me } from '@laofi/shared';
import { useState } from 'react';
import { startSession } from '../actions';
import { api } from '../net/api';
import { Icon } from './icons';

/** Login de desarrollo (email y contraseña). En la Fase 3 se suma "Entrar con Microsoft". */
export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api<Me>('POST', '/auth/login', { email, password });
      await startSession(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card glass" onSubmit={submit}>
        <div className="brand big">
          <div className="brand-mark">
            <Icon name="hi" />
          </div>
          <span>La Ofi</span>
        </div>
        <p className="hint">La oficina virtual del equipo. Entra con tu cuenta.</p>
        <label className="lbl" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu correo del trabajo"
          required
        />
        <label className="lbl" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary wide" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
