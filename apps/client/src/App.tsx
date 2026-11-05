import type { Me } from '@laofi/shared';
import { useEffect } from 'react';
import { startSession } from './actions';
import { ApiError, api } from './net/api';
import { useUi } from './state/store';
import { ChangePassword } from './ui/ChangePassword';
import { Login } from './ui/Login';
import { Office } from './ui/Office';

export function App() {
  const me = useUi((s) => s.me);
  const booted = useUi((s) => s.booted);

  useEffect(() => {
    api<Me>('GET', '/me')
      .then((m) => startSession(m))
      .catch((e) => {
        if (!(e instanceof ApiError) || e.status !== 401) console.error(e);
      })
      .finally(() => useUi.getState().set({ booted: true }));
  }, []);

  if (!booted) return <div className="boot">La Ofi</div>;
  if (!me) return <Login />;
  return me.mustChangePassword ? <ChangePassword /> : <Office />;
}
