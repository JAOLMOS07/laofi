import { useEffect, useRef } from 'react';
import { send } from '../net/floor';
import { setPttMic } from '../net/voice';
import { Engine, getEngine, setEngine } from '../scene/engine';
import { firstName, useUi } from '../state/store';
import { Dock } from './Dock';
import { Hud } from './Hud';
import { Icon } from './icons';
import { PanelHost } from './panels/PanelHost';
import { RoomCard } from './RoomCard';
import { Toasts } from './Toasts';

/** Destino del walkie al apretar: la persona elegida, la sala donde estás o todo el piso. */
function pttTarget(): { target: 'USER' | 'ROOM' | 'FLOOR'; id?: string; label: string } {
  const s = useUi.getState();
  if (s.ptt.target === 'USER' && s.ptt.id) return { target: 'USER', id: s.ptt.id, label: s.ptt.label };
  if (s.roomId) return { target: 'ROOM', label: 'la sala' };
  return { target: 'FLOOR', label: 'todo el piso' };
}

export function pttStart(): void {
  const s = useUi.getState();
  if (s.ptt.live || s.conn !== 'connected') return;
  const t = pttTarget();
  send('ptt_start', t.id ? { target: t.target, id: t.id } : { target: t.target });
  s.set({ ptt: { ...s.ptt, live: true } });
  void setPttMic(true);
}

export function pttStop(): void {
  const s = useUi.getState();
  if (!s.ptt.live) return;
  send('ptt_stop', {});
  s.set({ ptt: { ...s.ptt, live: false } });
  void setPttMic(false);
}

export function Office() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const transition = useUi((s) => s.transition);
  const conn = useUi((s) => s.conn);
  const connError = useUi((s) => s.connError);
  const floor = useUi((s) => s.floor);

  useEffect(() => {
    const e = new Engine(canvas.current!, labels.current!);
    setEngine(e);
    const down = (ev: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
      if (ev.code === 'Space') {
        ev.preventDefault();
        if (!ev.repeat) pttStart();
      }
    };
    const up = (ev: KeyboardEvent) => {
      if (ev.code === 'Space') pttStop();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', pttStop);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', pttStop);
      e.dispose();
      setEngine(null);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvas}
        id="c"
        tabIndex={0}
        aria-label="Oficina virtual en vista isométrica. Haz clic en el piso para caminar."
        data-testid="scene"
      />
      <div ref={labels} id="labels" />
      <Hud />
      <aside className="helpcard glass">
        <b>Cómo moverte</b>
        Clic en el piso: caminar
        <br />
        Clic en alguien: toc toc o post-it
        <br />
        <kbd>Q</kbd> <kbd>E</kbd> girar · rueda: zoom
        <br />
        Mantén <kbd>Espacio</kbd>: walkie-talkie
      </aside>
      <RoomCard />
      <PanelHost />
      <Toasts />
      <Dock />
      <div className="cam glass" aria-label="Cámara">
        <button onClick={() => getEngine()?.zoomBy(1.15)} aria-label="Acercar">
          <Icon name="plus" />
        </button>
        <button onClick={() => getEngine()?.zoomBy(1 / 1.15)} aria-label="Alejar">
          <Icon name="minus" />
        </button>
        <button onClick={() => getEngine()?.rotate(-1)} aria-label="Girar a la izquierda (Q)">
          <Icon name="rotL" />
        </button>
        <button onClick={() => getEngine()?.rotate(1)} aria-label="Girar a la derecha (E)">
          <Icon name="rotR" />
        </button>
      </div>
      <div id="fade" className={transition ? 'on' : ''}>
        <div>
          <span>{transition?.title}</span>
          <small>{transition?.sub}</small>
        </div>
      </div>
      {conn === 'error' && (
        <div className="offline glass" role="alert">
          <b>Sin conexión</b>
          <p>{connError}</p>
          <button className="btn primary sm" onClick={() => location.reload()}>
            Volver a entrar
          </button>
        </div>
      )}
      {floor && (
        <span hidden data-testid="current-floor">
          {floor.id}
        </span>
      )}
    </>
  );
}

export const pttLabel = (): string => pttTarget().label;
export const pttFirst = firstName;
