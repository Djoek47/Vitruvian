import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { T } from "../ui/theme";

/** World-unit fat lines (crisp in a headset, unlike 1-px GL lines). */
export function fatLines(positions: number[], color: number, widthM: number, opacity = 1, additive = true): LineSegments2 {
  const g = new LineSegmentsGeometry();
  g.setPositions(positions.length ? positions : [0, 0, 0, 0, 0, 0]);
  const m = new LineMaterial({
    color, linewidth: widthM, worldUnits: true, transparent: true, opacity, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false,
  });
  const l = new LineSegments2(g, m);
  l.frustumCulled = false;
  return l;
}

export function setLinePositions(l: LineSegments2, positions: number[]) {
  const g = new LineSegmentsGeometry();
  g.setPositions(positions.length ? positions : [0, 0, 0, 0, 0, 0]);
  l.geometry.dispose();
  l.geometry = g;
}

/** Closed polyline → segment pairs. */
export function loopSegments(pts: THREE.Vector3[], closed = true): number[] {
  const out: number[] = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  return out;
}

export function circlePts(r: number, n = 96, y = 0, start = 0, sweep = Math.PI * 2, plane: "xz" | "xy" = "xz", cy = 0): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = start + (i / n) * sweep;
    pts.push(plane === "xz" ? new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r) : new THREE.Vector3(Math.cos(t) * r, cy + Math.sin(t) * r, y));
  }
  return pts;
}

/** Soft radial glow sprite texture (additive). */
let glowTex: THREE.Texture | null = null;
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.2, "rgba(255,255,255,0.6)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function glowSprite(color: number, size: number, opacity = 0.8): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.setScalar(size);
  return s;
}

/** Small text label texture as a billboard sprite. */
export function labelSprite(text: string, sub: string | null, color = T.gold, heightM = 0.05): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false }));
  sp.userData.canvas = c;
  updateLabel(sp, text, sub, color);
  sp.scale.set(heightM * 4, heightM, 1);
  sp.renderOrder = 20;
  return sp;
}

export function updateLabel(sp: THREE.Sprite, text: string, sub: string | null, color = T.gold) {
  const c = sp.userData.canvas as HTMLCanvasElement;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = "rgba(13,11,8,0.72)";
  g.beginPath();
  g.roundRect(6, 10, 500, 108, 16);
  g.fill();
  g.fillStyle = color;
  g.fillRect(6, 10, 6, 108);
  g.font = `600 46px ${T.display}`;
  g.fillStyle = color;
  g.textBaseline = "middle";
  g.fillText(text, 30, sub ? 50 : 64, 460);
  if (sub) {
    g.font = `600 24px ${T.ui}`;
    g.fillStyle = T.text2;
    g.fillText(sub.toUpperCase(), 30, 94, 460);
  }
  const tex = (sp.material as THREE.SpriteMaterial).map!;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
}

/** A unit fat line along +Z (0→1) that is re-aimed by transform — no per-frame geometry. */
export function unitLine(color: number, widthM: number, opacity = 1): LineSegments2 {
  return fatLines([0, 0, 0, 0, 0, 1], color, widthM, opacity);
}
const _d = new THREE.Vector3();
export function aimLine(l: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  _d.subVectors(b, a);
  const len = Math.max(1e-5, _d.length());
  l.position.copy(a);
  l.lookAt(b);
  l.scale.set(1, 1, len);
}
