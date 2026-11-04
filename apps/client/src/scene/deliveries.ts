/**
 * Entregas en la escena: el muelle del piso de QA, el tablero del Lobby y las cajas.
 * Cada piso es una escena aparte, así que una caja "viaja" saliendo por el ascensor de un piso
 * y llegando por el ascensor del otro. Solo se dibuja lo que corresponde al piso actual.
 */
import {
  type DeliveryInfo,
  type DeliveryStatus,
  type FloorInfo,
  type Rect,
  floorFeatures,
} from '@laofi/shared';
import * as THREE from 'three';
import { SHARED_GEOMETRIES, box, plane, textTex } from './models';

export const DELIVERY_COLORS: Record<DeliveryStatus, string> = {
  SENT: '#c9a26b',
  TESTING: '#5b8fd6',
  APPROVED: '#3faa6b',
  RETURNED: '#d9534f',
};

const DOCK_COLS = 5;
const DOCK_ROWS = 2;
const TRAY_MAX = 6;

interface Flight {
  obj: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  arc: number;
  onDone?: () => void;
}

const isActive = (d: DeliveryInfo): boolean => d.status === 'SENT' || d.status === 'TESTING';
const byAge = (a: DeliveryInfo, b: DeliveryInfo): number => a.createdAt.localeCompare(b.createdAt);

function disposeTree(o: THREE.Object3D): void {
  o.traverse((c) => {
    const g = (c as THREE.Mesh).geometry;
    if (g && !SHARED_GEOMETRIES.has(g)) g.dispose();
  });
}

function makeBox(d: DeliveryInfo, status: DeliveryStatus): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.72, 0.54, 0.72, DELIVERY_COLORS[status], 0, 0.27, 0));
  g.add(box(0.74, 0.04, 0.2, d.fromCell.color, 0, 0.55, 0));
  const bg = status === 'RETURNED' ? '#c4473d' : '#fffcf6';
  const fg = status === 'RETURNED' ? '#ffffff' : '#2a2622';
  const label = plane(
    0.7,
    0.26,
    textTex(d.externalId, { w: 256, h: 96, bg, fg, font: '700 44px Figtree, sans-serif', radius: 12 }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.y = 0.585;
  g.add(label);
  return g;
}

export class DeliveryLayer {
  readonly clickables: THREE.Object3D[] = [];
  private fixed = new THREE.Group();
  private boxes = new THREE.Group();
  private flying = new THREE.Group();
  private flights: Flight[] = [];
  /** Cajas en el aire: llegan al piso cuando aterrizan, no antes. */
  private inFlight = new Set<string>();
  private floor: FloorInfo | null = null;
  private list: DeliveryInfo[] = [];
  private boardTex: THREE.Texture | null = null;

  constructor(parent: THREE.Group) {
    parent.add(this.fixed, this.boxes, this.flying);
  }

  setFloor(floor: FloorInfo | null): void {
    const changed = floor?.id !== this.floor?.id;
    this.floor = floor;
    if (changed) {
      this.flights = [];
      this.inFlight.clear();
      this.clear(this.flying);
      this.buildFixed();
    }
    this.render();
  }

  sync(list: DeliveryInfo[]): void {
    this.list = list;
    this.render();
  }

  /** Anima un cambio. Se llama antes de actualizar la lista: los puestos viejos siguen disponibles. */
  animate(d: DeliveryInfo, previous: DeliveryStatus | null): void {
    const f = this.floor;
    if (!f) return;
    const e = f.layout.elevator;
    const lift = new THREE.Vector3(e.x + 1, 0, e.y + 1);
    const dock = floorFeatures(f.id).dock;
    const isOrigin = f.cell?.id === d.fromCell.id;
    const onDock = this.docked();

    if (d.status === 'SENT' && (previous === null || previous === 'RETURNED')) {
      if (isOrigin) {
        const s = f.layout.spawn;
        this.fly(d, 'SENT', new THREE.Vector3(s.x - 6, 0, s.y - 4), lift, 2.2);
      }
      if (dock) {
        this.inFlight.add(d.id);
        this.fly(d, 'SENT', lift, this.dockSlot(dock, onDock.length), 2.4, () => this.land(d.id));
      }
    } else if (d.status === 'RETURNED' && previous) {
      if (dock) {
        const i = onDock.findIndex((x) => x.id === d.id);
        if (i >= 0) this.fly(d, 'RETURNED', this.dockSlot(dock, i), lift, 2.2);
      }
      if (isOrigin) {
        const count = this.tray().length;
        this.inFlight.add(d.id);
        this.fly(d, 'RETURNED', lift, this.traySlot(count), 1.8, () => this.land(d.id));
      }
    } else if (d.status === 'APPROVED' && dock) {
      const i = onDock.findIndex((x) => x.id === d.id);
      if (i >= 0) {
        const from = this.dockSlot(dock, i);
        this.fly(d, 'APPROVED', from, from.clone().setY(from.y + 3), 1.3);
      }
    }
  }

  update(dt: number): void {
    if (!this.flights.length) return;
    const pending: Flight[] = [];
    for (const f of this.flights) {
      f.t = Math.min(1, f.t + dt / f.dur);
      const p = f.t * f.t * (3 - 2 * f.t);
      f.obj.position.lerpVectors(f.from, f.to, p);
      f.obj.position.y += Math.sin(Math.PI * p) * f.arc;
      if (f.t < 1) {
        pending.push(f);
        continue;
      }
      this.flying.remove(f.obj);
      disposeTree(f.obj);
      f.onDone?.();
    }
    this.flights = pending;
  }

  dispose(): void {
    this.clear(this.fixed);
    this.clear(this.boxes);
    this.clear(this.flying);
    this.boardTex?.dispose();
  }

  private land(id: string): void {
    this.inFlight.delete(id);
    this.render();
  }

  private fly(
    d: DeliveryInfo,
    status: DeliveryStatus,
    from: THREE.Vector3,
    to: THREE.Vector3,
    dur: number,
    onDone?: () => void,
  ): void {
    const obj = makeBox(d, status);
    obj.position.copy(from);
    this.flying.add(obj);
    this.flights.push({ obj, from, to, t: 0, dur, arc: 0.7, ...(onDone ? { onDone } : {}) });
  }

  private docked(): DeliveryInfo[] {
    return this.list.filter(isActive).sort(byAge);
  }

  private tray(): DeliveryInfo[] {
    const cell = this.floor?.cell?.id;
    return this.list.filter((d) => d.status === 'RETURNED' && d.fromCell.id === cell).sort(byAge);
  }

  private dockSlot(dock: Rect, i: number): THREE.Vector3 {
    const perLayer = DOCK_COLS * DOCK_ROWS;
    const layer = Math.floor(i / perLayer);
    const k = i % perLayer;
    return new THREE.Vector3(
      dock.x + 0.6 + (k % DOCK_COLS) * 1.2,
      0.08 + layer * 0.6,
      dock.y + 0.9 + Math.floor(k / DOCK_COLS) * 1.5,
    );
  }

  /** Bandeja de devoluciones, en el pasillo junto al ascensor del piso de origen. */
  private traySlot(i: number): THREE.Vector3 {
    const e = this.floor!.layout.elevator;
    return new THREE.Vector3(e.x - 2.5 + (i % TRAY_MAX) * 0.95, 0, e.y - 2.5);
  }

  private clear(g: THREE.Group): void {
    for (const c of [...g.children]) {
      g.remove(c);
      disposeTree(c);
    }
  }

  private render(): void {
    this.clear(this.boxes);
    const f = this.floor;
    if (!f) return;
    const features = floorFeatures(f.id);
    if (features.dock) {
      const dock = features.dock;
      this.docked().forEach((d, i) => {
        if (this.inFlight.has(d.id) || i >= DOCK_COLS * DOCK_ROWS * 2) return;
        const b = makeBox(d, d.status);
        b.position.copy(this.dockSlot(dock, i));
        this.boxes.add(b);
      });
    }
    this.tray()
      .slice(0, TRAY_MAX)
      .forEach((d, i) => {
        if (this.inFlight.has(d.id)) return;
        const b = makeBox(d, 'RETURNED');
        b.position.copy(this.traySlot(i));
        this.boxes.add(b);
      });
    if (features.board) this.drawBoard();
  }

  private buildFixed(): void {
    this.clear(this.fixed);
    this.clickables.length = 0;
    const f = this.floor;
    if (!f) return;
    const { dock, board } = floorFeatures(f.id);
    if (dock) {
      const cx = dock.x + dock.w / 2;
      const cz = dock.y + dock.d / 2;
      const base = box(dock.w, 0.08, dock.d, '#b98a5e', cx, 0.04, cz);
      base.castShadow = false;
      base.userData.panel = 'deliveries';
      this.fixed.add(base);
      this.clickables.push(base);
      for (let i = 0; i < dock.w; i += 2) {
        this.fixed.add(box(1, 0.09, 0.12, '#e8b54a', dock.x + i + 0.5, 0.045, dock.y + 0.06));
        this.fixed.add(box(1, 0.09, 0.12, '#2a2622', dock.x + i + 1.5, 0.045, dock.y + 0.06));
      }
      const sign = plane(
        dock.w - 0.6,
        0.5,
        textTex('Muelle de entregas', { w: 640, h: 90, fg: 'rgba(60,45,30,.8)' }),
      );
      sign.rotation.x = -Math.PI / 2;
      sign.position.set(cx, 0.09, dock.y + dock.d - 0.3);
      this.fixed.add(sign);
    }
    if (board) {
      const cx = board.x + board.w / 2;
      const cz = board.y + board.d / 2;
      this.fixed.add(box(0.1, 1.9, 0.1, '#5a5148', board.x + 0.2, 0.95, cz));
      this.fixed.add(box(0.1, 1.9, 0.1, '#5a5148', board.x + board.w - 0.2, 0.95, cz));
      const back = box(board.w, 1.4, 0.1, '#3a3f47', cx, 1.35, cz);
      back.userData.panel = 'deliveries';
      this.fixed.add(back);
      this.clickables.push(back);
    }
  }

  private drawBoard(): void {
    const { board } = floorFeatures(this.floor!.id);
    if (!board) return;
    const today = new Date().toDateString();
    const count = (s: DeliveryStatus): number =>
      this.list.filter(
        (d) =>
          d.status === s &&
          (s === 'SENT' || s === 'TESTING' || new Date(d.updatedAt).toDateString() === today),
      ).length;
    const cols: Array<[string, DeliveryStatus]> = [
      ['Enviadas', 'SENT'],
      ['En pruebas', 'TESTING'],
      ['Aprobadas', 'APPROVED'],
      ['Devueltas', 'RETURNED'],
    ];
    const tex = textTex('', {
      w: 768,
      h: 356,
      draw: (g, w, h) => {
        g.fillStyle = '#2b2f36';
        g.fillRect(0, 0, w, h);
        g.textAlign = 'center';
        g.fillStyle = '#efe8dd';
        g.font = '600 44px Fredoka, sans-serif';
        g.fillText('Entregas de hoy', w / 2, 56);
        cols.forEach(([label, status], i) => {
          const x = (w / 4) * (i + 0.5);
          g.fillStyle = DELIVERY_COLORS[status];
          g.font = '700 104px Fredoka, sans-serif';
          g.fillText(String(count(status)), x, 196);
          g.fillStyle = '#c9c2b5';
          g.font = '600 30px Figtree, sans-serif';
          g.fillText(label, x, 296);
        });
      },
    });
    this.boardTex?.dispose();
    this.boardTex = tex;
    for (const o of this.fixed.children.filter((c) => c.userData.boardFace)) {
      this.fixed.remove(o);
      disposeTree(o);
    }
    const cx = board.x + board.w / 2;
    const cz = board.y + board.d / 2;
    for (const side of [1, -1]) {
      const face = plane(board.w - 0.1, 1.3, tex);
      face.position.set(cx, 1.35, cz + side * 0.06);
      if (side < 0) face.rotation.y = Math.PI;
      face.userData.boardFace = true;
      this.fixed.add(face);
    }
  }
}
