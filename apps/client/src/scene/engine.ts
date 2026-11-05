/**
 * Escena isométrica en three.js puro (portada del prototipo). React maneja la interfaz;
 * esta clase dibuja el piso, mueve los avatares con lo que manda el servidor y traduce clics en acciones.
 */
import {
  CATALOG,
  type CurrentWork,
  type FloorInfo,
  type FurnitureKey,
  type OfficeInfo,
  type PlacedItem,
  type Rotation,
  buildFloorGeometry,
  doorOutside,
  featureBlocks,
  footprint,
  rectContains,
  validatePlacement,
  WORK_ACTIVITY_LABEL,
} from '@laofi/shared';
import * as THREE from 'three';
import {
  type FurnSnap,
  type PlayerSnap,
  initAudio,
  live,
  myPlayer,
  send,
  setDeliveryListener,
} from '../net/floor';
import { type PanelKind, STATUS_INFO, firstName, useUi } from '../state/store';
import { DeliveryLayer } from './deliveries';
import {
  type AvatarParts,
  SHARED_GEOMETRIES,
  box,
  buildAvatar,
  buildFurniture,
  plane,
  shade,
  textTex,
  tint,
} from './models';

const WALL_H = 1.45;
const CUT_H = 0.2;
const LOBBY_PAL = {
  slab: '#c9c2b5',
  floor: '#ece7dd',
  wall: '#f8f5ef',
  office: '#e0d9cc',
  room: '#dcd5c6',
  accent: '#6b7f99',
};

export interface Palette {
  slab: string;
  floor: string;
  wall: string;
  office: string;
  room: string;
  accent: string;
}

export function paletteFor(floor: FloorInfo): Palette {
  if (!floor.cell) return LOBBY_PAL;
  const a = floor.cell.color;
  return {
    slab: tint(a, 0.55),
    floor: tint(a, 0.86),
    wall: tint(a, 0.93),
    office: tint(a, 0.76),
    room: tint(a, 0.68),
    accent: a,
  };
}

interface AvatarView {
  sid: string;
  userId: string;
  group: THREE.Group;
  parts: AvatarParts;
  tag: HTMLDivElement;
  pos: THREE.Vector3;
  heading: number;
  walkT: number;
  sit: number;
  avatarRaw: string;
}

interface WallView {
  group: THREE.Group;
  mesh: THREE.Mesh;
  cap?: THREE.Mesh;
  normals: Array<[number, number]>;
  door?: { officeId: string };
  h: number;
}

const lerpAngle = (a: number, b: number, t: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  private sun = new THREE.DirectionalLight(0xfff3e0, 2.3);
  private staticGroup = new THREE.Group();
  private agentGroup = new THREE.Group();
  private fxGroup = new THREE.Group();
  private deliveryGroup = new THREE.Group();
  private deliveries = new DeliveryLayer(this.deliveryGroup);
  private walls: WallView[] = [];
  private furnMeshes: THREE.Group[] = [];
  private doorMats: THREE.Mesh[] = [];
  private avatars = new Map<string, AvatarView>();
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hover: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private dest: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private ghost: THREE.Group | null = null;
  private ghostKey = '';
  private ghostTile: { x: number; y: number } | null = null;
  private selBox: THREE.BoxHelper | null = null;
  private camIdx = 0;
  private camAngle = Math.PI / 4;
  private zoom = 1;
  private camTarget = new THREE.Vector3(15, 0, 11);
  private floor: FloorInfo | null = null;
  private blocked: Uint8Array = new Uint8Array(0);
  private down: { x: number; y: number } | null = null;
  private last = performance.now();
  private raf = 0;
  private unsub: Array<() => void> = [];
  private atElevator = false;
  /** Carteles "Desarrollando HU-…" sobre las oficinas. Son DOM para que el link sea un link. */
  private workCards: Array<{ el: HTMLElement; pos: THREE.Vector3 }> = [];
  private v3 = new THREE.Vector3();

  constructor(
    private canvas: HTMLCanvasElement,
    private labels: HTMLDivElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight(0xfff7ea, 0xb4a28a, 2.1));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 });
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(
      this.sun,
      this.sun.target,
      this.staticGroup,
      this.agentGroup,
      this.fxGroup,
      this.deliveryGroup,
    );

    this.hover = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.92),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.position.y = 0.025;
    this.hover.visible = false;
    this.dest = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.34, 24),
      new THREE.MeshBasicMaterial({ color: 0x2f6f62, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.dest.rotation.x = -Math.PI / 2;
    this.dest.position.y = 0.03;
    this.dest.visible = false;
    this.scene.add(this.hover, this.dest);

    this.bind();
    this.resize();
    setDeliveryListener((d, previous) => this.deliveries.animate(d, previous));
    this.deliveries.sync(useUi.getState().deliveries);
    this.unsub.push(
      useUi.subscribe((s, p) => {
        if (s.deliveries !== p.deliveries) this.deliveries.sync(s.deliveries);
        if (s.floor !== p.floor || s.staticVersion !== p.staticVersion || s.building !== p.building)
          this.rebuildStatic();
        if (s.peopleVersion !== p.peopleVersion || s.ptt.live !== p.ptt.live || s.me !== p.me)
          this.refreshTags();
        if (s.edit !== p.edit || (s.panel?.kind === 'edit') !== (p.panel?.kind === 'edit')) this.syncEdit();
      }),
    );
    this.rebuildStatic();
    this.raf = requestAnimationFrame((t) => {
      this.last = t;
      this.frame(t);
    });
  }

  dispose(): void {
    setDeliveryListener(null);
    this.clearWorkCards();
    this.deliveries.dispose();
    cancelAnimationFrame(this.raf);
    this.unsub.forEach((u) => u());
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKey);
    this.avatars.forEach((a) => a.tag.remove());
    this.renderer.dispose();
  }

  // ---------------------------------------------------------------- cámara
  rotate(dir: 1 | -1): void {
    this.camIdx = (this.camIdx + dir + 4) % 4;
  }
  zoomBy(f: number): void {
    this.zoom = Math.min(2.2, Math.max(0.55, this.zoom * f));
    this.resize();
  }
  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    let half = 7.6 / this.zoom;
    if (aspect < 1) half = (half / Math.max(aspect, 0.45)) * 0.62;
    Object.assign(this.camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    this.camera.updateProjectionMatrix();
  };

  // ---------------------------------------------------------------- piso
  private furnitureList(): PlacedItem[] {
    return [...live.furniture.values()].map((f) => ({
      id: f.id,
      key: f.key,
      x: f.x,
      y: f.y,
      rot: f.rot,
      color: f.color,
      officeId: f.officeId || null,
    }));
  }

  private rebuildStatic(): void {
    const floor = useUi.getState().floor;
    const isNewFloor = floor?.id !== this.floor?.id;
    this.floor = floor;
    this.clearStatic();
    this.deliveries.setFloor(floor);
    if (!floor) return;
    if (isNewFloor) {
      const sp = floor.layout.spawn;
      this.camTarget.set(sp.x + 0.5, 0, sp.y + 0.5);
      this.avatars.forEach((a) => this.removeAvatar(a.sid));
    }
    const W = floor.layout.width;
    const D = floor.layout.depth;
    const pal = paletteFor(floor);
    const furniture = this.furnitureList();
    const offices = floor.offices;
    const geo = buildFloorGeometry(floor.layout, offices, floor.rooms, furniture, featureBlocks(floor.id));
    this.blocked = geo.grid.blocked;
    this.sun.position.set(W / 2 - 12, 26, D / 2 + 16);
    this.sun.target.position.set(W / 2, 0, D / 2);
    const G = this.staticGroup;

    const slab = box(W + 0.7, 0.6, D + 0.7, pal.slab, W / 2, -0.31, D / 2);
    slab.castShadow = false;
    const lip = box(W + 0.9, 0.08, D + 0.9, shade(pal.slab, -0.08), W / 2, -0.62, D / 2);
    lip.castShadow = false;
    const fl = box(W, 0.02, D, pal.floor, W / 2, -0.005, D / 2);
    fl.castShadow = false;
    G.add(slab, lip, fl);
    const pts: number[] = [];
    for (let x = 0; x <= W; x++) pts.push(x, 0.003, 0, x, 0.003, D);
    for (let z = 0; z <= D; z++) pts.push(0, 0.003, z, W, 0.003, z);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    G.add(
      new THREE.LineSegments(
        gg,
        new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.05 }),
      ),
    );

    const officeState = (o: OfficeInfo) => live.offices.get(o.id);
    for (const o of offices) {
      const st = officeState(o);
      const t = box(
        o.w,
        0.02,
        o.d,
        st?.floorColor || o.floorColor || pal.office,
        o.x + o.w / 2,
        0.004,
        o.y + o.d / 2,
      );
      t.castShadow = false;
      G.add(t);
    }
    for (const r of floor.rooms) {
      const t = box(r.w, 0.02, r.d, pal.room, r.x + r.w / 2, 0.004, r.y + r.d / 2);
      t.castShadow = false;
      G.add(t);
    }

    // Color de pared por oficina (el dueño la puede pintar).
    const wallColor = new Map<string, string>();
    for (const o of offices) {
      const c = officeState(o)?.wallColor || o.wallColor;
      if (!c) continue;
      for (let x = o.x; x < o.x + o.w; x++) wallColor.set(`h:${x}:${o.y}`, c).set(`h:${x}:${o.y + o.d}`, c);
      for (let y = o.y; y < o.y + o.d; y++) wallColor.set(`v:${o.x}:${y}`, c).set(`v:${o.x + o.w}:${y}`, c);
    }
    for (const k of geo.grid.walls) {
      const [t, a, b] = k.split(':');
      const A = Number(a);
      const B = Number(b);
      const perim = (t === 'h' && (B === 0 || B === D)) || (t === 'v' && (A === 0 || A === W));
      const glass = perim && ((t === 'h' && B === 0 && A % 3 === 1) || (t === 'v' && A === 0 && B % 3 === 1));
      const g = new THREE.Group();
      const m = box(
        t === 'h' ? 1 : 0.12,
        1,
        t === 'h' ? 0.12 : 1,
        glass ? '#bcd9e8' : (wallColor.get(k) ?? pal.wall),
        0,
        0,
        0,
        glass ? { opacity: 0.55 } : undefined,
      );
      const cap = box(
        t === 'h' ? 1.02 : 0.16,
        0.05,
        t === 'h' ? 0.16 : 1.02,
        shade(pal.slab, -0.15),
        0,
        0,
        0,
      );
      g.add(m, cap);
      g.position.set(t === 'h' ? A + 0.5 : A, 0, t === 'h' ? B : B + 0.5);
      G.add(g);
      this.walls.push({ group: g, mesh: m, cap, normals: geo.wallNormals.get(k) ?? [], h: -1 });
    }

    // Puertas de oficinas (hoja que se cierra) y tapetes "toc toc".
    for (const o of offices) {
      const k = [...geo.doors.entries()].find(([, id]) => id === o.id)?.[0];
      if (!k) continue;
      const [t, a, b] = k.split(':');
      const A = Number(a);
      const B = Number(b);
      const leaf = box(t === 'h' ? 0.92 : 0.07, 1, t === 'h' ? 0.07 : 0.92, '#9a7656', 0, 0, 0);
      const g = new THREE.Group();
      g.add(leaf);
      g.position.set(t === 'h' ? A + 0.5 : A, 0, t === 'h' ? B : B + 0.5);
      G.add(g);
      this.walls.push({
        group: g,
        mesh: leaf,
        normals: geo.wallNormals.get(k) ?? [],
        door: { officeId: o.id },
        h: -1,
      });
      if (!o.ownerId) continue;
      const me = useUi.getState().me;
      const mine = o.ownerId === me?.id;
      const closed = officeState(o)?.doorClosed ?? false;
      const bg = closed ? '#8f949b' : pal.accent;
      const label = mine ? 'Tu oficina' : firstName(o.ownerName ?? '');
      const sub = closed ? 'No molestar' : mine ? 'Tu puerta' : 'Toc toc';
      const tex = textTex(
        [
          { t: label, font: '600 54px Fredoka, sans-serif', y: 0.38, fg: '#fff' },
          { t: sub, font: '600 30px Figtree, sans-serif', y: 0.75, fg: 'rgba(255,255,255,.88)' },
        ],
        { w: 320, h: 150, bg, radius: 26 },
      );
      const out = doorOutside(o);
      const mt = plane(0.95, 0.46, tex);
      mt.rotation.x = -Math.PI / 2;
      mt.position.set(out.x + 0.5, 0.02, out.y + 0.5);
      mt.userData.doorOwner = o.ownerId;
      G.add(mt);
      this.doorMats.push(mt);
    }

    const floorsForDirectory = (useUi.getState().building?.floors ?? [])
      .slice()
      .sort((x, y) => y.level - x.level)
      .map((f) => ({ level: f.level, name: f.name, color: f.cell?.color ?? LOBBY_PAL.accent }));
    for (const f of live.furniture.values()) this.addFurniture(f, floor, floorsForDirectory);

    const e = floor.layout.elevator;
    const eg = new THREE.Group();
    const pad = box(2, 0.05, 2, '#b8bec7', 1, 0.02, 1);
    pad.castShadow = false;
    eg.add(pad, box(1.7, 0.055, 1.7, '#d0d5dc', 1, 0.025, 1));
    eg.add(
      box(0.16, 2.2, 0.16, '#5a5f6b', 0.08, 1.1, 0.08),
      box(0.16, 2.2, 0.16, '#5a5f6b', 1.92, 1.1, 0.08),
      box(2, 0.18, 0.2, '#5a5f6b', 1, 2.2, 0.08),
    );
    const sign = plane(
      1.7,
      0.42,
      textTex([{ t: `Ascensor · P${floor.level}`, font: '600 46px Fredoka, sans-serif', fg: '#fff' }], {
        w: 420,
        h: 104,
        bg: pal.accent,
        radius: 20,
      }),
    );
    sign.position.set(1, 2.2, 0.19);
    eg.add(sign);
    const arrows = plane(
      1.2,
      1.2,
      textTex(
        [
          { t: '▲', font: '600 120px Figtree', y: 0.3, fg: 'rgba(60,70,90,.4)' },
          { t: '▼', font: '600 120px Figtree', y: 0.72, fg: 'rgba(60,70,90,.4)' },
        ],
        { w: 256, h: 256 },
      ),
    );
    arrows.rotation.x = -Math.PI / 2;
    arrows.position.set(1, 0.06, 1);
    eg.add(arrows);
    eg.position.set(e.x, 0, e.y);
    G.add(eg);

    const me = useUi.getState().me;
    for (const o of offices)
      if (o.ownerName)
        this.addDecal(
          o.ownerId === me?.id
            ? `Oficina de ${firstName(o.ownerName)} (tú)`
            : `Oficina de ${firstName(o.ownerName)}`,
          o.x + o.w / 2,
          o.y + (o.door.side === 'n' ? 0.45 : o.d - 0.45),
          o.w - 0.8,
          0.5,
        );
    for (const r of floor.rooms) this.addDecal(r.name, r.x + r.w / 2, r.y + r.d - 0.45, r.w - 0.4, 0.55);
    if (!floor.cell)
      this.addDecal(
        'La Ofi',
        floor.layout.spawn.x + 0.5,
        floor.layout.spawn.y - 3.5,
        4,
        1.2,
        'rgba(60,45,30,.25)',
      );

    this.syncWorkCards();
    this.applyCutaway(true);
    this.syncEdit();
  }

  private addFurniture(
    f: FurnSnap,
    floor: FloorInfo,
    floors: Array<{ level: number; name: string; color: string }>,
  ): void {
    const fp = footprint(f.key, f.rot);
    const room = f.key === 'tv' ? floor.rooms.find((r) => rectContains(r, f.x, f.y)) : undefined;
    const g = buildFurniture({
      id: f.id,
      key: f.key,
      color: f.color,
      roomName: room?.name,
      hasLink: !!room?.teamsLink,
      floors,
    });
    g.rotation.y = (f.rot * Math.PI) / 180;
    g.position.set(f.x + fp.w / 2, 0, f.y + fp.d / 2);
    g.userData.furnId = f.id;
    g.userData.officeId = f.officeId;
    if (useUi.getState().edit.movingId === f.id) g.visible = false;
    this.staticGroup.add(g);
    this.furnMeshes.push(g);
    if (f.key === 'desk' && f.officeId) {
      const n = live.offices.get(f.officeId)?.unreadNotes ?? 0;
      const desks = [...live.furniture.values()].filter((x) => x.officeId === f.officeId && x.key === 'desk');
      if (desks[0]?.id !== f.id) return;
      for (let i = 0; i < Math.min(n, 3); i++) {
        const pn = box(0.16, 0.012, 0.16, ['#fff2a8', '#ffd1c2', '#b5e3c8'][i]!, 0, 0, 0);
        pn.position.set(f.x + fp.w / 2 + 0.2 + i * 0.05, 0.79 + i * 0.004, f.y + fp.d / 2 + 0.18 - i * 0.04);
        pn.rotation.y = i * 0.3;
        this.staticGroup.add(pn);
      }
    }
  }

  private clearWorkCards(): void {
    for (const c of this.workCards) c.el.remove();
    this.workCards = [];
  }

  private workCard(office: OfficeInfo, work: CurrentWork): HTMLElement {
    const el = document.createElement(work.url ? 'a' : 'button');
    if (el instanceof HTMLAnchorElement) {
      el.href = work.url!;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    } else {
      el.addEventListener('click', () => {
        if (office.ownerId) useUi.getState().openPanel('person', office.ownerId);
      });
    }
    el.className = 'work-card';
    el.textContent = `${WORK_ACTIVITY_LABEL[work.activity]} ${work.itemId}`;
    if (work.title) el.title = work.title;
    el.dataset.testid = `work-${office.ownerId}`;
    return el;
  }

  private syncWorkCards(): void {
    this.clearWorkCards();
    for (const o of this.floor?.offices ?? []) {
      const work = live.offices.get(o.id)?.work;
      if (!work) continue;
      const el = this.workCard(o, work);
      this.labels.appendChild(el);
      this.workCards.push({ el, pos: new THREE.Vector3(o.x + o.w / 2, 1.9, o.y + o.d / 2) });
    }
  }

  private addDecal(
    text: string,
    x: number,
    z: number,
    w: number,
    h: number,
    color = 'rgba(60,45,30,.45)',
  ): void {
    const tex = textTex([{ t: text, font: '600 60px Fredoka, sans-serif', fg: color }], {
      w: Math.max(128, Math.round((512 * w) / 4)),
      h: 100,
    });
    const p = plane(w, h, tex);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.015, z);
    this.staticGroup.add(p);
  }

  private clearStatic(): void {
    const g = this.staticGroup;
    while (g.children.length) {
      const c = g.children.pop()!;
      c.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry && !SHARED_GEOMETRIES.has(mesh.geometry)) mesh.geometry.dispose();
      });
    }
    this.walls = [];
    this.furnMeshes = [];
    this.doorMats = [];
  }

  private applyCutaway(force = false): void {
    const cx = Math.sin(this.camAngle);
    const cz = Math.cos(this.camAngle);
    for (const w of this.walls) {
      const cut = w.normals.some((n) => n[0] * cx + n[1] * cz > 0.05);
      let target: number;
      if (w.door) {
        const closed = live.offices.get(w.door.officeId)?.doorClosed ?? false;
        target = closed ? (cut ? CUT_H : 1.25) : 0.0001;
      } else target = cut ? CUT_H : WALL_H;
      if (force || w.h !== target) {
        w.h = target;
        w.mesh.scale.y = target;
        w.mesh.position.y = target / 2;
        w.mesh.visible = target > 0.001;
        if (w.cap) w.cap.position.y = target + 0.025;
      }
    }
  }

  // ---------------------------------------------------------------- avatares
  private addAvatar(p: PlayerSnap): AvatarView {
    const { group, parts } = buildAvatar(p.avatar);
    group.traverse((o) => (o.userData.sid = p.sid));
    this.agentGroup.add(group);
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.dataset.testid = `tag-${p.userId}`;
    this.labels.appendChild(tag);
    const a: AvatarView = {
      sid: p.sid,
      userId: p.userId,
      group,
      parts,
      tag,
      pos: new THREE.Vector3(p.x, 0, p.y),
      heading: 0,
      walkT: Math.random() * 6,
      sit: 0,
      avatarRaw: p.avatarRaw,
    };
    this.avatars.set(p.sid, a);
    this.renderTag(a, p);
    return a;
  }

  private removeAvatar(sid: string): void {
    const a = this.avatars.get(sid);
    if (!a) return;
    this.agentGroup.remove(a.group);
    a.tag.remove();
    this.avatars.delete(sid);
  }

  private refreshTags(): void {
    for (const a of this.avatars.values()) {
      const p = live.players.get(a.sid);
      if (p) this.renderTag(a, p);
    }
  }

  private renderTag(a: AvatarView, p: PlayerSnap): void {
    const ui = useUi.getState();
    const isMe = p.sid === ui.mySid;
    const cell = ui.building?.cells.find((c) => c.id === p.cellId);
    const talking = p.talking || (isMe && ui.ptt.live);
    a.tag.className = `tag${isMe ? ' me-tag' : ''}${talking ? ' talking' : ''}`;
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const vm =
      p.voiceMode === 'APP'
        ? '<span class="vm">En la app</span>'
        : p.voiceMode === 'TEAMS'
          ? '<span class="vm">En Teams</span>'
          : '';
    const vb =
      p.isVisitor && cell
        ? `<span class="vb" style="background:${cell.color}">Visita · ${esc(cell.name)}</span>`
        : '';
    a.tag.innerHTML = `<span class="talk">Walkie</span>${vm}${vb}<span class="nm"><i class="dot" style="background:${STATUS_INFO[p.status].color}"></i>${esc(isMe ? 'Tú' : firstName(p.name))}</span>`;
  }

  private chairAt(x: number, y: number): FurnSnap | undefined {
    for (const f of live.furniture.values()) if (f.key === 'chair' && f.x === x && f.y === y) return f;
    return undefined;
  }

  private updateAvatars(dt: number): void {
    for (const sid of [...this.avatars.keys()]) if (!live.players.has(sid)) this.removeAvatar(sid);
    const mySid = useUi.getState().mySid;
    for (const p of live.players.values()) {
      let a = this.avatars.get(p.sid);
      if (a && a.avatarRaw !== p.avatarRaw) {
        this.removeAvatar(p.sid);
        a = undefined;
      }
      if (!a) a = this.addAvatar(p);
      const tx = p.x;
      const tz = p.y;
      const dx = tx - a.pos.x;
      const dz = tz - a.pos.z;
      const dist = Math.hypot(dx, dz);
      // El servidor manda posiciones 20 veces por segundo: se suaviza para que no se vea a saltos.
      if (dist > 3) a.pos.set(tx, 0, tz);
      else a.pos.lerp(this.v3.set(tx, 0, tz), Math.min(1, dt * 14));
      const moving = p.moving || dist > 0.05;
      if (dist > 0.02) a.heading = lerpAngle(a.heading, Math.atan2(dx, dz), Math.min(1, dt * 14));
      const u = a.parts;
      if (moving) {
        a.walkT += dt * 11;
        a.sit = Math.max(0, a.sit - dt * 6);
      } else {
        a.walkT += dt * 1.6;
        const chair = this.chairAt(Math.floor(p.x), Math.floor(p.y));
        if (chair) {
          a.sit = Math.min(1, a.sit + dt * 4);
          const r = (chair.rot * Math.PI) / 180;
          a.heading = lerpAngle(a.heading, Math.atan2(-Math.sin(r), -Math.cos(r)), Math.min(1, dt * 8));
        } else a.sit = Math.max(0, a.sit - dt * 6);
      }
      const s = moving ? Math.sin(a.walkT) : 0;
      u.legL.rotation.x = s * 0.6 * (1 - a.sit) - a.sit * 1.45;
      u.legR.rotation.x = -s * 0.6 * (1 - a.sit) - a.sit * 1.45;
      u.armL.rotation.x = -s * 0.5;
      u.armR.rotation.x = s * 0.5;
      u.body.position.y = moving
        ? Math.abs(Math.cos(a.walkT)) * 0.045
        : a.sit * 0.05 + Math.sin(a.walkT) * 0.006;
      u.body.position.z = -a.sit * 0.05;
      a.group.position.copy(a.pos);
      a.group.rotation.y = a.heading;
      const isMe = p.sid === mySid;
      const talking = p.talking || (isMe && useUi.getState().ptt.live);
      u.ring.material.opacity = talking ? 0.5 + Math.sin(performance.now() / 120) * 0.3 : isMe ? 0.35 : 0;
      u.ring.material.color.set(talking ? '#d9534f' : '#ffffff');
    }
  }

  // ---------------------------------------------------------------- modo edición
  private myOffice(): OfficeInfo | undefined {
    const me = useUi.getState().me;
    return this.floor?.offices.find((o) => o.ownerId === me?.id);
  }

  private syncEdit(): void {
    const ui = useUi.getState();
    const on = ui.panel?.kind === 'edit';
    const { key, rot, color, selId, movingId } = ui.edit;
    for (const g of this.furnMeshes) g.visible = g.userData.furnId !== movingId;
    const wantGhost = on && key ? `${key}|${color}` : '';
    if (wantGhost !== this.ghostKey) {
      if (this.ghost) this.fxGroup.remove(this.ghost);
      this.ghost = null;
      this.ghostKey = wantGhost;
      if (on && key) {
        const g = buildFurniture({ id: 'ghost', key, color });
        g.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.material = (m.material as THREE.MeshStandardMaterial).clone();
            (m.material as THREE.MeshStandardMaterial).transparent = true;
            (m.material as THREE.MeshStandardMaterial).opacity = 0.6;
            m.castShadow = false;
          }
        });
        g.visible = false;
        this.ghost = g;
        this.fxGroup.add(g);
      }
    }
    if (this.ghost) this.ghost.rotation.y = (rot * Math.PI) / 180;
    if (this.selBox) this.fxGroup.remove(this.selBox);
    this.selBox = null;
    const sel = on && selId ? this.furnMeshes.find((g) => g.userData.furnId === selId) : undefined;
    if (sel) {
      this.selBox = new THREE.BoxHelper(sel, 0x2f6f62);
      (this.selBox.material as THREE.LineBasicMaterial).depthTest = false;
      this.fxGroup.add(this.selBox);
    }
  }

  private placementOk(key: FurnitureKey, x: number, y: number, rot: Rotation, ignoreId?: string): boolean {
    const o = this.myOffice();
    if (!o) return false;
    if (validatePlacement(o, { key, x, y, rot }, this.furnitureList(), ignoreId)) return false;
    if (!CATALOG[key].block) return true;
    const fp = footprint(key, rot);
    for (const p of live.players.values()) {
      const tx = Math.floor(p.x);
      const ty = Math.floor(p.y);
      if (tx >= x && tx < x + fp.w && ty >= y && ty < y + fp.d) return false;
    }
    return true;
  }

  private updateGhost(t: { x: number; y: number } | null): void {
    if (!this.ghost) return;
    const { key, rot, movingId } = useUi.getState().edit;
    if (!t || !key) {
      this.ghost.visible = false;
      this.ghostTile = null;
      return;
    }
    const fp = footprint(key, rot);
    this.ghost.visible = true;
    this.ghost.position.set(t.x + fp.w / 2, 0, t.y + fp.d / 2);
    const ok = this.placementOk(key, t.x, t.y, rot, movingId ?? undefined);
    this.ghost.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (m.material as THREE.MeshStandardMaterial).emissive?.set(ok ? '#000000' : '#c4473d');
    });
    this.ghostTile = ok ? t : null;
  }

  private editClick(): void {
    const ui = useUi.getState();
    const { key, rot, color, movingId } = ui.edit;
    if (key) {
      this.updateGhost(this.tileFromRay());
      const t = this.ghostTile;
      if (!t) {
        ui.toast({
          title: 'No cabe ahí',
          text: 'Coloca el mueble dentro de tu oficina, sin tapar la entrada ni otros muebles.',
          icon: 'x',
          timeout: 2600,
        });
        return;
      }
      if (movingId) {
        send('furniture_move', { id: movingId, x: t.x, y: t.y, rot });
        ui.setEdit({ key: null, movingId: null, selId: movingId });
      } else send('furniture_place', { key, x: t.x, y: t.y, rot, color });
      return;
    }
    const office = this.myOffice();
    const mine = this.furnMeshes.filter((g) => g.userData.officeId && g.userData.officeId === office?.id);
    const hit = this.ray.intersectObjects(mine, true)[0];
    let id: string | undefined;
    hit?.object.traverseAncestors((o) => {
      if (!id && o.userData.furnId) id = o.userData.furnId as string;
    });
    ui.setEdit({ selId: id ?? null });
  }

  // ---------------------------------------------------------------- entrada
  private bind(): void {
    const c = this.canvas;
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onKey);
    c.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY };
      initAudio();
    });
    c.addEventListener('pointermove', (e) => {
      this.setRay(e);
      const t = this.tileFromRay();
      if (useUi.getState().panel?.kind === 'edit' && this.ghost) {
        this.updateGhost(t);
        this.hover.visible = false;
        return;
      }
      if (t && e.pointerType === 'mouse') {
        this.hover.visible = true;
        this.hover.position.x = t.x + 0.5;
        this.hover.position.z = t.y + 0.5;
        this.hover.material.color.set(this.isBlocked(t.x, t.y) ? '#d9534f' : '#ffffff');
        const hit =
          this.ray.intersectObjects(this.agentGroup.children, true).length ||
          this.ray.intersectObjects(this.doorMats, false).length;
        c.style.cursor = hit ? 'pointer' : 'default';
      } else this.hover.visible = false;
    });
    c.addEventListener('pointerleave', () => (this.hover.visible = false));
    c.addEventListener('pointerup', (e) => {
      if (!this.down) return;
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      this.down = null;
      if (moved > 8) return;
      this.setRay(e);
      this.handleClick();
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomBy(e.deltaY > 0 ? 0.9 : 1.1);
      },
      { passive: false },
    );
  }

  private onKey = (e: KeyboardEvent): void => {
    const el = document.activeElement;
    if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
    const k = e.key.toLowerCase();
    const ui = useUi.getState();
    if (k === 'q') this.rotate(-1);
    else if (k === 'e') this.rotate(1);
    else if (k === '+' || k === '=') this.zoomBy(1.12);
    else if (k === '-') this.zoomBy(1 / 1.12);
    else if (k === 'r' && ui.panel?.kind === 'edit') {
      if (ui.edit.key) ui.setEdit({ rot: ((ui.edit.rot + 90) % 360) as Rotation });
      else if (ui.edit.selId) rotateSelected();
    } else if ((k === 'delete' || k === 'backspace') && ui.panel?.kind === 'edit' && ui.edit.selId) {
      send('furniture_remove', { id: ui.edit.selId });
      ui.setEdit({ selId: null });
    } else if (k === 'escape') {
      if (ui.panel?.kind === 'edit' && ui.edit.key) ui.setEdit({ key: null, movingId: null });
      else ui.closePanel();
    }
  };

  private setRay(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
  }

  private tileFromRay(): { x: number; y: number } | null {
    const p = new THREE.Vector3();
    if (!this.floor || !this.ray.ray.intersectPlane(this.groundPlane, p)) return null;
    const x = Math.floor(p.x);
    const y = Math.floor(p.z);
    return x >= 0 && y >= 0 && x < this.floor.layout.width && y < this.floor.layout.depth ? { x, y } : null;
  }

  private isBlocked(x: number, y: number): boolean {
    if (!this.floor) return true;
    return this.blocked[y * this.floor.layout.width + x] === 1;
  }

  private handleClick(): void {
    const ui = useUi.getState();
    if (ui.panel?.kind === 'edit') return this.editClick();
    const ah = this.ray.intersectObjects(this.agentGroup.children, true)[0];
    const sid = ah?.object.userData.sid as string | undefined;
    if (sid && sid !== ui.mySid) {
      const p = live.players.get(sid);
      if (p) return ui.openPanel('person', p.userId);
    }
    const dm = this.ray.intersectObjects(this.doorMats, false)[0];
    const owner = dm?.object.userData.doorOwner as string | undefined;
    if (owner) {
      if (owner !== ui.me?.id) return ui.openPanel('person', owner);
    }
    const fixture = this.ray.intersectObjects(this.deliveries.clickables, false)[0];
    const panel = fixture?.object.userData.panel as PanelKind | undefined;
    if (panel) return ui.openPanel(panel);
    const t = this.tileFromRay();
    if (!t) return;
    this.walkTo(t.x, t.y);
  }

  walkTo(x: number, y: number): void {
    send('move', { x, y });
    this.dest.visible = true;
    this.dest.position.x = x + 0.5;
    this.dest.position.z = y + 0.5;
  }

  // ---------------------------------------------------------------- bucle
  private frame(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.updateAvatars(dt);
    this.deliveries.update(dt);
    this.camAngle = lerpAngle(this.camAngle, (this.camIdx * Math.PI) / 2 + Math.PI / 4, Math.min(1, dt * 7));
    this.applyCutaway();
    const ui = useUi.getState();
    const me = ui.mySid ? this.avatars.get(ui.mySid) : undefined;
    const office = ui.panel?.kind === 'edit' ? this.myOffice() : undefined;
    const goal = office ? this.v3.set(office.x + office.w / 2, 0, office.y + office.d / 2) : me?.pos;
    if (goal) this.camTarget.lerp(goal, Math.min(1, dt * 3));
    const dist = 40;
    this.camera.position.set(
      this.camTarget.x + Math.sin(this.camAngle) * dist,
      dist * 0.82,
      this.camTarget.z + Math.cos(this.camAngle) * dist,
    );
    this.camera.lookAt(this.camTarget.x, 0, this.camTarget.z);
    if (this.dest.visible) {
      this.dest.rotation.z += dt * 2;
      const p = myPlayer();
      if (p && !p.moving && Math.hypot(p.x - this.dest.position.x, p.y - this.dest.position.z) < 0.6)
        this.dest.visible = false;
    }
    this.checkElevator();
    this.renderer.render(this.scene, this.camera);
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const a of this.avatars.values()) {
      this.v3.copy(a.pos);
      this.v3.y = 1.62 - a.sit * 0.28;
      this.v3.project(this.camera);
      const x = (this.v3.x * 0.5 + 0.5) * w;
      const y = (-this.v3.y * 0.5 + 0.5) * h;
      a.tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      a.tag.style.display = this.v3.z > 1 ? 'none' : '';
    }
    for (const c of this.workCards) {
      this.v3.copy(c.pos).project(this.camera);
      const x = (this.v3.x * 0.5 + 0.5) * w;
      const y = (-this.v3.y * 0.5 + 0.5) * h;
      c.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /** Al detenerse sobre el ascensor se abre el selector de piso. */
  private checkElevator(): void {
    const p = myPlayer();
    const f = this.floor;
    if (!p || !f) return;
    const e = f.layout.elevator;
    const on = p.x >= e.x && p.x < e.x + 2 && p.y >= e.y && p.y < e.y + 2;
    if (on && !p.moving && !this.atElevator) {
      this.atElevator = true;
      useUi.getState().openPanel('elevator');
    } else if (!on) this.atElevator = false;
  }
}

/** Gira 90° el mueble seleccionado si cabe. */
export function rotateSelected(): void {
  const ui = useUi.getState();
  const f = ui.edit.selId ? live.furniture.get(ui.edit.selId) : undefined;
  if (!f) return;
  send('furniture_move', { id: f.id, x: f.x, y: f.y, rot: ((f.rot + 90) % 360) as Rotation });
}

let engine: Engine | null = null;
export const getEngine = (): Engine | null => engine;
export const setEngine = (e: Engine | null): void => {
  engine = e;
};
