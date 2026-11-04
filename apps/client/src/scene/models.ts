/**
 * Modelos low-poly hechos con cajas y cilindros (sin archivos externos), portados del prototipo.
 * Las geometrías y materiales se comparten para que un piso con muchos muebles siga siendo liviano.
 */
import { type AvatarConfig, type FurnitureKey, CATALOG } from '@laofi/shared';
import * as THREE from 'three';

const BOXG = new THREE.BoxGeometry(1, 1, 1);
const ICO = new THREE.IcosahedronGeometry(1, 0);
const cylCache = new Map<string, THREE.CylinderGeometry>();
const matCache = new Map<string, THREE.MeshStandardMaterial>();
export const SHARED_GEOMETRIES = new Set<THREE.BufferGeometry>([BOXG, ICO]);

interface MatOpts {
  emissive?: string;
  ei?: number;
  opacity?: number;
}

export function mat(color: string, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const k = `${color}|${o.emissive ?? ''}|${o.ei ?? ''}|${o.opacity ?? 1}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, flatShading: true });
    if (o.emissive) {
      m.emissive = new THREE.Color(o.emissive);
      m.emissiveIntensity = o.ei ?? 0.6;
    }
    if (o.opacity) {
      m.transparent = true;
      m.opacity = o.opacity;
      m.depthWrite = false;
    }
    matCache.set(k, m);
  }
  return m;
}

export function box(
  w: number,
  h: number,
  d: number,
  color: string,
  x = 0,
  y = 0,
  z = 0,
  o?: MatOpts,
): THREE.Mesh {
  const m = new THREE.Mesh(BOXG, mat(color, o));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function cyl(
  rt: number,
  rb: number,
  h: number,
  color: string,
  x = 0,
  y = 0,
  z = 0,
  seg = 10,
  o?: MatOpts,
): THREE.Mesh {
  const k = `${rt},${rb},${seg}`;
  let g = cylCache.get(k);
  if (!g) {
    g = new THREE.CylinderGeometry(rt, rb, 1, seg);
    cylCache.set(k, g);
    SHARED_GEOMETRIES.add(g);
  }
  const m = new THREE.Mesh(g, mat(color, o));
  m.scale.y = h;
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function ico(r: number, color: string, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(ICO, mat(color));
  m.scale.setScalar(r);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function shade(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, f);
  return `#${c.getHexString()}`;
}

/** Mezcla un color con blanco: base de las paletas de cada piso. */
export function tint(hex: string, amount: number): string {
  const c = new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), amount);
  return `#${c.getHexString()}`;
}

// ---------------------------------------------------------------- texturas de texto
interface TextLine {
  t: string;
  font?: string;
  fg?: string;
  x?: number;
  y?: number;
}
interface TexOpts {
  w?: number;
  h?: number;
  bg?: string;
  fg?: string;
  font?: string;
  radius?: number;
  align?: CanvasTextAlign;
  lh?: number;
  draw?: (g: CanvasRenderingContext2D, w: number, h: number) => void;
}
const texCache = new Map<string, THREE.CanvasTexture>();

export function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function textTex(
  lines: string | Array<string | TextLine>,
  o: TexOpts = {},
  cacheKey?: string,
): THREE.CanvasTexture {
  const key = cacheKey ?? JSON.stringify([lines, { ...o, draw: undefined }]);
  const hit = texCache.get(key);
  if (hit && !o.draw) return hit;
  const w = o.w ?? 512;
  const h = o.h ?? 128;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  if (o.bg) {
    g.fillStyle = o.bg;
    roundRect(g, 0, 0, w, h, o.radius ?? 18);
    g.fill();
  }
  g.textAlign = o.align ?? 'center';
  g.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((ln, i) => {
    const L: TextLine = typeof ln === 'string' ? { t: ln } : ln;
    g.font = L.font ?? o.font ?? '600 60px Fredoka, sans-serif';
    g.fillStyle = L.fg ?? o.fg ?? '#2a2622';
    const y = L.y != null ? L.y * h : h / 2 + (i - (arr.length - 1) / 2) * (o.lh ?? 64);
    g.fillText(L.t, L.x != null ? L.x * w : o.align === 'left' ? 24 : w / 2, y);
  });
  o.draw?.(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  if (!o.draw) texCache.set(key, t);
  return t;
}

export function plane(w: number, h: number, tex: THREE.Texture): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
}

// ---------------------------------------------------------------- muebles
/** Semilla simple para que los libros del estante no cambien en cada redibujo. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export interface FurnitureLook {
  id: string;
  key: FurnitureKey;
  color: string;
  /** Para la pantalla de una sala. */
  roomName?: string;
  hasLink?: boolean;
  /** Para el directorio del Lobby. */
  floors?: Array<{ level: number; name: string; color: string }>;
}

export function buildFurniture(f: FurnitureLook): THREE.Group {
  const g = new THREE.Group();
  const c = f.color || CATALOG[f.key].color;
  const rnd = seeded(f.id);
  switch (f.key) {
    case 'desk':
      g.add(box(1.9, 0.07, 0.86, c, 0, 0.74, 0));
      for (const [x, z] of [
        [-0.86, -0.36],
        [0.86, -0.36],
        [-0.86, 0.36],
        [0.86, 0.36],
      ] as const)
        g.add(box(0.07, 0.72, 0.07, shade(c, -0.18), x, 0.36, z));
      g.add(
        box(0.64, 0.4, 0.05, '#2b2f38', -0.25, 1.04, -0.24),
        box(0.58, 0.33, 0.01, '#8fc1e3', -0.25, 1.04, -0.212, { emissive: '#4f86b0', ei: 0.5 }),
        box(0.07, 0.22, 0.07, '#2b2f38', -0.25, 0.86, -0.24),
      );
      g.add(
        box(0.46, 0.025, 0.15, '#dcd7ce', -0.25, 0.79, 0.12),
        cyl(0.05, 0.05, 0.1, '#f4f1ea', 0.55, 0.83, 0.05, 8),
        box(0.3, 0.03, 0.22, '#f4f1ea', 0.35, 0.79, -0.15),
      );
      break;
    case 'chair':
      g.add(
        box(0.48, 0.08, 0.46, c, 0, 0.46, 0),
        box(0.48, 0.5, 0.07, c, 0, 0.74, 0.21),
        cyl(0.035, 0.035, 0.4, '#505560', 0, 0.24, 0, 6),
        box(0.42, 0.04, 0.42, '#505560', 0, 0.04, 0),
      );
      break;
    case 'plant':
      g.add(cyl(0.2, 0.15, 0.36, '#c4714a', 0, 0.18, 0, 8), cyl(0.18, 0.18, 0.02, '#5a3d2b', 0, 0.36, 0, 8));
      g.add(
        ico(0.34, c, 0, 0.7, 0),
        ico(0.22, shade(c, 0.07), 0.08, 0.98, -0.05),
        ico(0.18, shade(c, -0.06), -0.16, 0.9, 0.12),
      );
      break;
    case 'shelf': {
      const dk = shade(c, -0.12);
      for (const y of [0.05, 0.55, 1.05, 1.55]) g.add(box(1.8, 0.06, 0.38, c, 0, y, 0));
      g.add(
        box(0.06, 1.6, 0.38, c, -0.87, 0.8, 0),
        box(0.06, 1.6, 0.38, c, 0.87, 0.8, 0),
        box(1.8, 1.6, 0.03, dk, 0, 0.8, -0.18),
      );
      const bc = ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#577590', '#9c89b8'];
      [0.1, 0.6, 1.1].forEach((y, r) => {
        let x = -0.75;
        while (x < 0.7) {
          const bw = 0.07 + rnd() * 0.06;
          const bh = 0.26 + rnd() * 0.12;
          if (rnd() > 0.18)
            g.add(box(bw, bh, 0.26, bc[Math.floor(rnd() * bc.length)]!, x + bw / 2, y + bh / 2, 0));
          x += bw + 0.015;
          if (r === 1 && x > 0.1 && x < 0.3) x = 0.4;
        }
      });
      g.add(ico(0.12, '#5c9a5a', 0.25, 0.72, 0));
      break;
    }
    case 'sofa':
      g.add(
        box(1.8, 0.34, 0.78, c, 0, 0.25, 0),
        box(1.8, 0.52, 0.2, shade(c, -0.05), 0, 0.6, 0.29),
        box(0.18, 0.44, 0.78, shade(c, -0.05), -0.81, 0.4, 0),
        box(0.18, 0.44, 0.78, shade(c, -0.05), 0.81, 0.4, 0),
      );
      g.add(
        box(0.7, 0.1, 0.58, shade(c, 0.06), -0.36, 0.46, -0.06),
        box(0.7, 0.1, 0.58, shade(c, 0.06), 0.36, 0.46, -0.06),
      );
      for (const [x, z] of [
        [-0.8, -0.32],
        [0.8, -0.32],
        [-0.8, 0.32],
        [0.8, 0.32],
      ] as const)
        g.add(box(0.06, 0.08, 0.06, '#3a3a3a', x, 0.04, z));
      break;
    case 'rug': {
      const a = box(1.9, 0.02, 1.9, c, 0, 0.012, 0);
      a.castShadow = false;
      const b = box(1.5, 0.022, 1.5, shade(c, 0.08), 0, 0.014, 0);
      b.castShadow = false;
      g.add(a, b);
      break;
    }
    case 'lamp':
      g.add(
        cyl(0.16, 0.18, 0.05, '#3a3a3a', 0, 0.03, 0, 10),
        cyl(0.025, 0.025, 1.3, '#3a3a3a', 0, 0.68, 0, 6),
        cyl(0.13, 0.25, 0.28, c, 0, 1.4, 0, 10, { emissive: c, ei: 0.35 }),
      );
      break;
    case 'frame':
      g.add(
        box(0.05, 1.2, 0.05, '#6b5a4a', -0.25, 0.6, 0.12),
        box(0.05, 1.2, 0.05, '#6b5a4a', 0.25, 0.6, 0.12),
        box(0.05, 1.1, 0.05, '#6b5a4a', 0, 0.55, -0.18),
      );
      g.add(
        box(0.72, 0.62, 0.05, '#f7f3ea', 0, 1.05, 0.06),
        box(0.36, 0.3, 0.01, c, -0.08, 1.1, 0.09),
        box(0.22, 0.2, 0.01, shade(c, 0.2), 0.14, 0.95, 0.09),
        ico(0.07, '#f2cc8f', 0.16, 1.2, 0.1),
      );
      break;
    case 'table':
      g.add(
        cyl(0.8, 0.8, 0.06, c, 0, 0.74, 0, 14),
        cyl(0.07, 0.07, 0.7, '#6b5a4a', 0, 0.37, 0, 8),
        cyl(0.34, 0.34, 0.04, '#6b5a4a', 0, 0.02, 0, 12),
      );
      break;
    case 'coffee':
      g.add(box(0.94, 0.88, 0.9, c, 0, 0.44, 0), box(0.98, 0.05, 0.94, '#f3efe7', 0, 0.9, 0));
      g.add(
        box(0.42, 0.5, 0.36, '#3a3d44', 0, 1.18, -0.1),
        box(0.2, 0.08, 0.04, '#e07a5f', 0, 1.28, 0.09, { emissive: '#e07a5f', ei: 0.6 }),
        cyl(0.05, 0.04, 0.08, '#f4f1ea', 0, 0.97, 0.06, 8),
      );
      break;
    case 'whiteboard':
      g.add(box(1.8, 1.05, 0.05, '#fbfbf8', 0, 1.25, 0), box(1.86, 0.05, 0.08, '#9aa0a6', 0, 0.72, 0.02));
      g.add(
        box(0.05, 0.75, 0.05, '#9aa0a6', -0.85, 0.37, 0),
        box(0.05, 0.75, 0.05, '#9aa0a6', 0.85, 0.37, 0),
      );
      g.add(
        box(0.5, 0.03, 0.01, '#e07a5f', -0.45, 1.5, 0.03),
        box(0.7, 0.03, 0.01, '#3d405b', -0.35, 1.38, 0.03),
        box(0.4, 0.03, 0.01, '#3d405b', -0.5, 1.26, 0.03),
      );
      g.add(
        box(0.28, 0.28, 0.01, '#fff2a8', 0.45, 1.4, 0.03),
        box(0.28, 0.28, 0.01, '#b5e3c8', 0.45, 1.05, 0.03),
        box(0.28, 0.28, 0.01, '#ffd1c2', 0.1, 1.05, 0.03),
      );
      break;
    case 'tv': {
      g.add(box(1.6, 0.46, 0.42, c, 0, 0.23, -0.18), box(1.84, 1.04, 0.07, '#23262d', 0, 1.3, -0.32));
      const scr = plane(
        1.72,
        0.94,
        textTex(
          [
            { t: 'Reunión de Teams', font: '600 34px Figtree, sans-serif', y: 0.3, fg: '#c9d4ff' },
            { t: f.roomName ?? 'Sala', font: '600 52px Fredoka, sans-serif', y: 0.55, fg: '#ffffff' },
            {
              t: f.hasLink ? 'Link listo' : 'Sin link todavía',
              font: '500 28px Figtree, sans-serif',
              y: 0.77,
              fg: '#9aa3c7',
            },
          ],
          { w: 512, h: 280, bg: '#3b4377', radius: 6 },
        ),
      );
      scr.position.set(0, 1.3, -0.282);
      g.add(scr);
      break;
    }
    case 'bench':
      g.add(box(2.8, 0.1, 0.5, c, 0, 0.45, 0), box(2.8, 0.42, 0.08, shade(c, -0.06), 0, 0.72, 0.22));
      for (const x of [-1.25, 0, 1.25]) g.add(box(0.08, 0.42, 0.42, '#4a4a4a', x, 0.21, 0));
      break;
    case 'reception':
      g.add(
        box(2.8, 1.0, 0.8, c, 0, 0.5, 0),
        box(3.0, 0.06, 0.95, '#f3efe7', 0, 1.03, 0),
        box(2.8, 0.12, 0.02, '#f2cc8f', 0, 0.75, 0.41, { emissive: '#f2cc8f', ei: 0.3 }),
      );
      g.add(
        box(0.5, 0.32, 0.04, '#2b2f38', 0.6, 1.25, -0.2),
        box(0.06, 0.15, 0.06, '#2b2f38', 0.6, 1.1, -0.2),
        ico(0.14, '#5c9a5a', -1.1, 1.2, -0.1),
      );
      break;
    case 'directory': {
      const bw = 1.8;
      g.add(
        box(0.08, 0.9, 0.08, '#5a5f6b', -bw / 2 + 0.2, 0.45, 0),
        box(0.08, 0.9, 0.08, '#5a5f6b', bw / 2 - 0.2, 0.45, 0),
        box(bw, 1.5, 0.08, '#2b2f38', 0, 1.6, 0),
      );
      const floors = f.floors ?? [];
      const tex = textTex(
        [{ t: 'Directorio', font: '600 44px Fredoka, sans-serif', y: 0.1, fg: '#ffffff' }],
        {
          w: 512,
          h: 392,
          bg: '#2b2f38',
          radius: 4,
          draw(ctx) {
            floors.forEach((fl, i) => {
              const y = 90 + i * 58;
              ctx.fillStyle = fl.color;
              roundRect(ctx, 28, y - 22, 54, 44, 10);
              ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.font = '600 28px Fredoka, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(`P${fl.level}`, 55, y + 2);
              ctx.textAlign = 'left';
              ctx.fillStyle = '#e9e6df';
              ctx.font = '600 28px Figtree, sans-serif';
              ctx.fillText(fl.name, 100, y + 2);
            });
          },
        },
      );
      const p = plane(bw - 0.12, 1.38, tex);
      p.position.set(0, 1.6, 0.045);
      g.add(p);
      break;
    }
  }
  return g;
}

// ---------------------------------------------------------------- avatar
export interface AvatarParts {
  body: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
}

export function buildAvatar(a: AvatarConfig): { group: THREE.Group; parts: AvatarParts } {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const mkLeg = (x: number) => {
    const pv = new THREE.Group();
    pv.position.set(x, 0.42, 0);
    pv.add(box(0.15, 0.42, 0.17, a.pants, 0, -0.21, 0), box(0.16, 0.07, 0.22, '#2f2a26', 0, -0.39, 0.03));
    return pv;
  };
  const mkArm = (x: number) => {
    const pv = new THREE.Group();
    pv.position.set(x, 0.8, 0);
    pv.add(box(0.11, 0.34, 0.13, a.shirt, 0, -0.15, 0), box(0.1, 0.08, 0.11, a.skin, 0, -0.34, 0));
    return pv;
  };
  const legL = mkLeg(-0.09);
  const legR = mkLeg(0.09);
  const armL = mkArm(-0.28);
  const armR = mkArm(0.28);
  body.add(legL, legR, armL, armR);
  body.add(box(0.44, 0.42, 0.27, a.shirt, 0, 0.63, 0));
  body.add(box(0.12, 0.06, 0.12, a.skin, 0, 0.87, 0));
  const head = new THREE.Group();
  head.position.y = 1.04;
  body.add(head);
  head.add(box(0.32, 0.3, 0.3, a.skin, 0, 0, 0));
  head.add(
    box(0.045, 0.06, 0.01, '#1e1a17', -0.075, 0, 0.152),
    box(0.045, 0.06, 0.01, '#1e1a17', 0.075, 0, 0.152),
  );
  head.add(box(0.07, 0.04, 0.03, shade(a.skin, -0.12), 0, -0.07, 0.155));
  const hc = a.hairColor;
  if (a.hair !== 'none')
    head.add(box(0.34, 0.1, 0.32, hc, 0, 0.18, -0.005), box(0.34, 0.2, 0.08, hc, 0, 0.07, -0.13));
  if (a.hair === 'long')
    head.add(
      box(0.36, 0.42, 0.1, hc, 0, -0.06, -0.15),
      box(0.06, 0.3, 0.24, hc, -0.17, -0.01, -0.02),
      box(0.06, 0.3, 0.24, hc, 0.17, -0.01, -0.02),
    );
  if (a.hair === 'bun') head.add(ico(0.1, hc, 0, 0.27, -0.1));
  if (a.hair === 'cap')
    head.add(
      box(0.36, 0.1, 0.34, shade(a.shirt, -0.15), 0, 0.2, 0),
      box(0.3, 0.03, 0.16, shade(a.shirt, -0.15), 0, 0.16, 0.22),
    );
  if (a.accessory === 'glasses')
    head.add(
      box(0.12, 0.08, 0.02, '#1e1a17', -0.075, 0.0, 0.16),
      box(0.12, 0.08, 0.02, '#1e1a17', 0.075, 0.0, 0.16),
      box(0.04, 0.02, 0.02, '#1e1a17', 0, 0.01, 0.16),
    );
  if (a.accessory === 'headphones')
    head.add(
      box(0.36, 0.04, 0.06, '#2b2f38', 0, 0.21, 0),
      box(0.05, 0.14, 0.12, '#2b2f38', -0.18, 0.0, 0),
      box(0.05, 0.14, 0.12, '#2b2f38', 0.18, 0.0, 0),
    );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.44, 28),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  g.add(ring);
  return { group: g, parts: { body, legL, legR, armL, armR, ring } };
}
