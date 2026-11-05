import { ApiError, api } from '../../net/api';
import { useUi } from '../../state/store';
import { PanelHeader } from '../common';

type Level = 'ok' | 'demo' | 'ti' | 'later';

const LEVEL_LABEL: Record<Level, string> = {
  ok: 'Funciona',
  demo: 'Demo',
  ti: 'Pendiente de TI',
  later: 'Más adelante',
};

interface Item {
  name: string;
  level: Level;
  what: string;
  needs?: string;
}

/** Lo que ya funciona y lo que falta decidir con el equipo y con TI. */
const ITEMS: Item[] = [
  {
    name: 'Reuniones de Teams en cada sala',
    level: 'ok',
    what: 'Cada sala abre su reunión con un link fijo. No necesita permisos.',
  },
  {
    name: 'Agenda y aviso “¿vamos?”',
    level: 'ok',
    what: 'Agregas la reunión a mano; te avisa, te lleva a la sala y al final te ofrece volver.',
  },
  {
    name: 'Entregas a QA',
    level: 'ok',
    what: 'Registro a mano, caja al muelle, estados y tablero en el Lobby.',
  },
  {
    name: 'Despliegues',
    level: 'ok',
    what: 'Lo que QA aprueba vuelve a la célula; al desplegarlo, el trencito cruza el piso.',
  },
  {
    name: 'En qué trabaja cada quien',
    level: 'ok',
    what: 'Cada persona publica su HU en su oficina, con clic al work item.',
  },
  {
    name: 'Entregas automáticas desde Azure DevOps',
    level: 'demo',
    what: 'La caja saldría sola cuando el work item pase al estado acordado. Hoy se simula.',
    needs: 'Saber cómo marcan una entrega a QA y una URL pública para el webhook.',
  },
  {
    name: 'Despliegues automáticos',
    level: 'demo',
    what: 'El trencito saldría solo con el pipeline, y un fallo pondría la sala en rojo. Hoy se marca a mano.',
    needs: 'Eventos de los pipelines de Azure DevOps o AWS y una URL pública.',
  },
  {
    name: 'Mis HU desde Azure Boards',
    level: 'later',
    what: 'Elegir tu HU de una lista en vez de pegar el link.',
    needs: 'Un acceso de solo lectura a Azure DevOps.',
  },
  {
    name: 'Calendario de Outlook',
    level: 'ti',
    what: 'Tus reuniones y su link de Teams llegarían solos a la agenda.',
    needs: 'Registrar la app en Microsoft Entra ID con el permiso Calendars.Read.',
  },
  {
    name: 'Presencia de Teams',
    level: 'ti',
    what: 'Tu estado cambiaría a “En reunión” cuando estés en una llamada. Cada quien lo activaría.',
    needs: 'Permiso Presence.Read en Microsoft Entra ID.',
  },
  {
    name: 'Crear reuniones desde La Ofi',
    level: 'ti',
    what: 'Una reunión improvisada de Teams con un clic.',
    needs: 'Permiso OnlineMeetings.ReadWrite en Microsoft Entra ID.',
  },
  {
    name: 'Entrar con la cuenta de Microsoft',
    level: 'ti',
    what: 'Sin contraseña propia de La Ofi.',
    needs: 'La misma app registrada en Microsoft Entra ID.',
  },
  {
    name: 'Logros e invitados',
    level: 'later',
    what: 'Trofeos opcionales e invitados de otros equipos en las salas.',
    needs: 'Eventos de DevOps y del calendario.',
  },
];

function DemoControls() {
  const toast = useUi((s) => s.toast);
  const run = async (path: string, title: string) => {
    try {
      await api('POST', `/demo/deliveries/${path}`);
      toast({ title, icon: 'box', timeout: 2600 });
    } catch (e) {
      toast({ title: 'No se pudo', text: e instanceof ApiError ? e.message : String(e), icon: 'x' });
    }
  };
  return (
    <div className="row">
      <button
        className="btn sm primary"
        onClick={() => void run('simulate', 'Evento simulado de Azure DevOps')}
        data-testid="demo-simulate"
      >
        Simular entrega
      </button>
      <button className="btn sm" onClick={() => void run('load', 'Ejemplos cargados')}>
        Cargar ejemplos
      </button>
      <button className="btn sm" onClick={() => void run('clear', 'Demo quitada')}>
        Quitar demo
      </button>
    </div>
  );
}

export function IntegrationsPanel() {
  const isAdmin = useUi((s) => s.me?.role === 'ADMIN');
  return (
    <>
      <PanelHeader title="Integraciones" sub="Qué funciona hoy y qué falta para llegar más lejos." />
      <div className="stack">
        {ITEMS.map((it) => (
          <div key={it.name} className="sena" data-testid={`integration-${it.level}`}>
            <div className="sena-top">
              <b>{it.name}</b>
              <span className={`pill ${it.level}`}>{LEVEL_LABEL[it.level]}</span>
            </div>
            <p>{it.what}</p>
            {it.needs && <small>Necesita: {it.needs}</small>}
            {it.name.startsWith('Entregas automáticas') &&
              (isAdmin ? <DemoControls /> : <small>Un admin puede simularlo.</small>)}
            {it.name === 'Presencia de Teams' && (
              <label className="sena-toggle">
                <input type="checkbox" checked={false} disabled readOnly />
                Sincronizar mi estado con Teams
              </label>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
