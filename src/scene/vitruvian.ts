import * as THREE from "three";
import type { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { superellipsePerimeter } from "../body/circumference";
import type { Landmark, Measurement } from "../measurement/types";
import { AMBER_HEX, EMBER_HEX, GOLD_HEX, PHI, SUCCESS_HEX } from "../ui/theme";
import { circlePts, fatLines, glowSprite, labelSprite, loopSegments, setLinePositions, updateLabel } from "./fx";

/**
 * THE VITRUVIAN MASTER — a life-size holographic Da Vinci figure that is the
 * centrepiece of the app. It starts from canonical proportions and reshapes
 * itself from the person's captured landmarks and measurements in real time:
 * cross-section rings take the measured breadth × depth, heights move to the
 * measured landmark heights, and measured dimensions get callouts.
 *
 * Coordinates inside the group: metres, x right (of the figure), y up, z toward
 * the viewer. The group is placed in the world facing the user.
 */
type Body = {
  H: number; shoulderY: number; shoulderW: number; neckY: number; chestY: number; waistY: number; hipY: number; crotchY: number; kneeY: number;
  rings: Record<"neck" | "chest" | "waist" | "hip", { b: number; d: number; measured: boolean }>;
  armL: number;
};

export class VitruvianHologram {
  readonly group = new THREE.Group();
  private figure: LineSegments2;
  private ghost: LineSegments2;
  private rings: LineSegments2;
  private frame: LineSegments2;
  private base: THREE.Group = new THREE.Group();
  private scan: LineSegments2;
  private nodes = new Map<string, { mesh: THREE.Mesh; glow: THREE.Sprite }>();
  private callouts = new Map<string, { line: LineSegments2; label: THREE.Sprite }>();
  private highlight = new Set<string>();
  private focusMeasurement: string | null = null;
  private body: Body;
  private time = 0;
  private dataSig = "";

  constructor() {
    this.body = canonical(1.75);
    this.frame = fatLines([], GOLD_HEX, 0.004, 0.55);
    this.figure = fatLines([], GOLD_HEX, 0.006, 0.95);
    this.ghost = fatLines([], AMBER_HEX, 0.004, 0.28);
    this.rings = fatLines([], GOLD_HEX, 0.005, 0.9);
    this.scan = fatLines(loopSegments(circlePts(0.5, 96)), GOLD_HEX, 0.004, 0.5);
    this.group.add(this.frame, this.ghost, this.figure, this.rings, this.scan, this.base);
    this.buildBase();
    this.rebuild();
  }

  /** Concentric Stark-style projector rings on the floor. */
  /**
   * Projector base on Leonardo's canon: ring radii in φ proportion (R/φ², R/φ, R, R·φ^½),
   * tick counts on Fibonacci numbers (21 · 34 · 55 · 89), spin speeds in ratio φ.
   */
  private buildBase() {
    const R = 0.95;
    const ring = (r: number, w: number, o: number, dashes = 0, duty = 0.55) => {
      let pts: number[] = [];
      if (!dashes) pts = loopSegments(circlePts(r, 144, 0.003));
      else for (let i = 0; i < dashes; i++) pts.push(...loopSegments(circlePts(r, 6, 0.003, (i / dashes) * Math.PI * 2, ((Math.PI * 2) / dashes) * duty), false));
      const l = fatLines(pts, GOLD_HEX, w, o);
      this.base.add(l);
      return l;
    };
    const ticks = (r: number, n: number, len: number, w: number, o: number) => {
      const pts: number[] = [];
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        pts.push(Math.cos(t) * r, 0.003, Math.sin(t) * r, Math.cos(t) * (r + len), 0.003, Math.sin(t) * (r + len));
      }
      const l = fatLines(pts, GOLD_HEX, w, o);
      this.base.add(l);
      return l;
    };
    ring(R / (PHI * PHI), 0.004, 0.45);
    ring(R / PHI, 0.007, 0.4, 21).userData.spin = -0.1 * PHI;
    ring(R, 0.004, 0.4);
    ring(R * Math.sqrt(PHI), 0.003, 0.25, 89, 0.35).userData.spin = 0.1 / PHI;
    ticks(R / PHI + 0.03, 34, 0.04, 0.004, 0.35).userData.spin = 0.05;
    ticks(R + 0.02, 55, 0.05, 0.003, 0.4).userData.spin = -0.05 / PHI;
    // golden spiral etched on the floor (r = a·φ^(2θ/π))
    this.base.add(fatLines(loopSegments(goldenSpiral(0.012, R * 0.9, (x, y) => new THREE.Vector3(x, 0.004, y)), false), GOLD_HEX, 0.003, 0.3));
    const g = glowSprite(GOLD_HEX, 1.8, 0.12);
    g.position.y = 0.02;
    this.base.add(g);
  }

  /** Hide the canonical stick figure once the measured twin takes its place. */
  showFigure(v: boolean) {
    this.figure.visible = v;
    this.ghost.visible = v;
  }

  /** Update from the live session. */
  setData(landmarks: Record<string, Landmark>, measurements: Record<string, Measurement>, highlightLandmarks: string[], focus: string | null = null) {
    const sig = Object.keys(landmarks).length + "|" + Object.values(measurements).map((m) => m.value.toFixed(1)).join();
    if (sig === this.dataSig && highlightLandmarks.join() === [...this.highlight].join() && focus === this.focusMeasurement) return;
    this.dataSig = sig;
    const nb = fromData(landmarks, measurements);
    const changed = JSON.stringify(nb) !== JSON.stringify(this.body);
    this.body = nb;
    this.highlight = new Set(highlightLandmarks);
    this.focusMeasurement = focus;
    if (changed) this.rebuild();
    this.updateNodes(landmarks);
    this.updateCallouts(measurements);
  }

  private rebuild() {
    const b = this.body;
    // Vitruvian square (side = height) and circle (centre at navel, through feet).
    const sq: number[] = [];
    const s = b.H;
    const half = s / 2;
    const corners = [[-half, 0], [half, 0], [half, s], [-half, s]];
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = corners[i];
      const [x2, y2] = corners[(i + 1) % 4];
      sq.push(x1, y1, -0.02, x2, y2, -0.02);
    }
    // Leonardo's canon: navel at H/φ, the circle is centred on it and touches the floor
    const navelY = b.H / PHI;
    sq.push(...loopSegments(circlePts(navelY, 160, -0.02, 0, Math.PI * 2, "xy", navelY)));
    // golden spiral unwinding from the navel out to the circle
    sq.push(...loopSegments(goldenSpiral(0.01, navelY * 0.98, (x, y) => new THREE.Vector3(x, navelY + y, -0.03)), false));
    // φ-section marks up both sides of the square: H/φ³, H/φ², H/φ, H(1 − 1/φ³)
    for (const f of [1 / PHI ** 3, 1 / PHI ** 2, 1 / PHI, 1 - 1 / PHI ** 3]) {
      const y = s * f;
      sq.push(-half, y, -0.02, -half + 0.08, y, -0.02, half, y, -0.02, half - 0.08, y, -0.02);
    }
    // Leonardo's eighths (head = H/8), finer marks
    for (let i = 1; i < 8; i++) {
      const y = (s * i) / 8;
      sq.push(-half, y, -0.02, -half + 0.035, y, -0.02, half, y, -0.02, half - 0.035, y, -0.02);
    }
    setLinePositions(this.frame, sq);

    const { main, alt } = figureSegments(b);
    setLinePositions(this.figure, main);
    setLinePositions(this.ghost, alt);

    const rs: number[] = [];
    for (const k of ["neck", "chest", "waist", "hip"] as const) {
      const r = b.rings[k];
      const y = k === "neck" ? b.neckY : k === "chest" ? b.chestY : k === "waist" ? b.waistY : b.hipY;
      rs.push(...loopSegments(superPts(r.b, r.d, k === "neck" ? 2 : 2.35, y)));
    }
    setLinePositions(this.rings, rs);
  }

  private updateNodes(lms: Record<string, Landmark>) {
    const want = new Set([...Object.keys(lms), ...this.highlight]);
    for (const [id, n] of this.nodes) if (!want.has(id)) {
      this.group.remove(n.mesh, n.glow);
      this.nodes.delete(id);
    }
    for (const id of want) {
      const p = nodePosition(id, this.body, lms[id]);
      if (!p) continue;
      let n = this.nodes.get(id);
      if (!n) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), new THREE.MeshBasicMaterial({ color: GOLD_HEX, toneMapped: false }));
        const glow = glowSprite(GOLD_HEX, 0.09, 0.7);
        this.group.add(mesh, glow);
        n = { mesh, glow };
        this.nodes.set(id, n);
      }
      n.mesh.position.copy(p);
      n.glow.position.copy(p);
      const captured = !!lms[id];
      const active = this.highlight.has(id);
      (n.mesh.material as THREE.MeshBasicMaterial).color.setHex(active && !captured ? EMBER_HEX : captured ? GOLD_HEX : AMBER_HEX);
      n.mesh.userData.active = active;
      (n.glow.material as THREE.SpriteMaterial).color.setHex(active ? EMBER_HEX : GOLD_HEX);
    }
  }

  private calloutKey = "";
  private updateCallouts(ms: Record<string, Measurement>) {
    const key = JSON.stringify(this.body) + this.focusMeasurement + Object.values(ms).map((m) => m.id + m.value.toFixed(1) + m.status + m.method).join();
    if (key === this.calloutKey) return;
    this.calloutKey = key;
    const b = this.body;
    const defs: { id: string; a: THREE.Vector3; c: THREE.Vector3; label: string }[] = [];
    const add = (id: string, a: THREE.Vector3, c: THREE.Vector3, label: string) => ms[id] && defs.push({ id, a, c, label });
    add("height", new THREE.Vector3(b.H / 2 + 0.12, 0, 0), new THREE.Vector3(b.H / 2 + 0.12, b.H, 0), "HEIGHT");
    add("shoulder_width", new THREE.Vector3(-b.shoulderW / 2, b.shoulderY + 0.09, 0.05), new THREE.Vector3(b.shoulderW / 2, b.shoulderY + 0.09, 0.05), "SHOULDER");
    add("chest_circumference", new THREE.Vector3(b.rings.chest.b / 2, b.chestY, 0), new THREE.Vector3(b.rings.chest.b / 2 + 0.32, b.chestY + 0.05, 0), "CHEST");
    add("waist_circumference", new THREE.Vector3(-b.rings.waist.b / 2, b.waistY, 0), new THREE.Vector3(-b.rings.waist.b / 2 - 0.32, b.waistY + 0.05, 0), "WAIST");
    add("hip_circumference", new THREE.Vector3(b.rings.hip.b / 2, b.hipY, 0), new THREE.Vector3(b.rings.hip.b / 2 + 0.3, b.hipY - 0.04, 0), "HIP");
    add("arm_length", new THREE.Vector3(b.shoulderW / 2, b.shoulderY, 0.03), new THREE.Vector3(b.shoulderW / 2 + b.armL, b.shoulderY, 0.03), "ARM");
    add("neck_circumference", new THREE.Vector3(-b.rings.neck.b / 2, b.neckY, 0), new THREE.Vector3(-0.3, b.neckY + 0.1, 0), "NECK");
    add("inseam", new THREE.Vector3(0.02, 0, 0.04), new THREE.Vector3(0.02, b.crotchY, 0.04), "INSEAM");
    const want = new Set(defs.map((d) => d.id));
    for (const [id, c] of this.callouts) if (!want.has(id)) {
      this.group.remove(c.line, c.label);
      this.callouts.delete(id);
    }
    for (const d of defs) {
      const m = ms[d.id];
      const val = `${(m.value / 10).toFixed(1)} cm`;
      const sub = `${d.label} · ${m.status === "conflicted" ? "conflicted" : m.method}`;
      const focus = this.focusMeasurement === d.id;
      let c = this.callouts.get(d.id);
      const pts = [d.a.x, d.a.y, d.a.z, d.c.x, d.c.y, d.c.z];
      // end ticks
      const dir = new THREE.Vector3().subVectors(d.c, d.a).normalize();
      const perp = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(0.03);
      for (const e of [d.a, d.c]) pts.push(e.x - perp.x, e.y - perp.y, e.z, e.x + perp.x, e.y + perp.y, e.z);
      const color = m.status === "conflicted" ? EMBER_HEX : focus ? SUCCESS_HEX : GOLD_HEX;
      if (!c) {
        c = { line: fatLines(pts, color, 0.004, 0.9), label: labelSprite(val, sub, undefined, 0.13) };
        this.group.add(c.line, c.label);
        this.callouts.set(d.id, c);
      } else setLinePositions(c.line, pts);
      (c.line.material as { color: THREE.Color }).color.setHex(color);
      if (c.label.userData.text !== val + sub) {
        updateLabel(c.label, val, sub, m.status === "conflicted" ? "#FF3D00" : "#FFC61A");
        c.label.userData.text = val + sub;
      }
      c.label.position.set(d.c.x + (d.c.x >= 0 ? 0.15 : -0.15), d.c.y + 0.05, d.c.z + 0.02);
      if (d.id === "height") c.label.position.set(d.c.x + 0.16, b.H * 0.92, 0);
      if (d.id === "inseam") c.label.position.set(0.25, b.crotchY * 0.5, 0.05);
      if (d.id === "arm_length") c.label.position.set(d.c.x, d.c.y + 0.1, 0.05);
    }
  }

  tick(dt: number) {
    this.time += dt;
    for (const ch of this.base.children) if (ch.userData.spin) ch.rotation.y += ch.userData.spin * dt;
    // scan ring sweeps the body
    const ph = (Math.sin(this.time * 0.6) * 0.5 + 0.5) * this.body.H;
    this.scan.position.y = ph;
    const r = 0.18 + 0.2 * Math.sin((ph / this.body.H) * Math.PI);
    this.scan.scale.set(r / 0.5, 1, r / 0.5 * 0.7);
    (this.scan.material as { opacity: number }).opacity = 0.25 + 0.25 * Math.sin(this.time * 3) ** 2;
    for (const n of this.nodes.values()) {
      const k = n.mesh.userData.active ? 1 + 0.5 * Math.sin(this.time * 8) : 1;
      n.mesh.scale.setScalar(k);
      n.glow.scale.setScalar(0.09 * k);
    }
    // gentle sway so the 3D form reads, without spinning labels away
    this.group.rotation.y = this.group.userData.baseYaw + Math.sin(this.time * 0.25) * 0.35;
  }
}

function canonical(H: number): Body {
  return {
    H, shoulderY: H * 0.818, shoulderW: H * 0.23, neckY: H * 0.86, chestY: H * 0.72, waistY: H * 0.61, hipY: H * 0.52, crotchY: H * 0.47, kneeY: H * 0.285,
    rings: {
      neck: { b: H * 0.066, d: H * 0.07, measured: false },
      chest: { b: H * 0.18, d: H * 0.135, measured: false },
      waist: { b: H * 0.16, d: H * 0.12, measured: false },
      hip: { b: H * 0.195, d: H * 0.14, measured: false },
    },
    armL: H * 0.335,
  };
}

function fromData(lm: Record<string, Landmark>, m: Record<string, Measurement>): Body {
  const H = m.height ? m.height.value / 1000 : 1.75;
  const b = canonical(H);
  const y = (id: string) => lm[id]?.body.y;
  const avgY = (a: string, c: string) => (lm[a] && lm[c] ? (lm[a].body.y + lm[c].body.y) / 2 : undefined);
  b.shoulderY = y("arm_acromion_r") ?? avgY("acromion_l", "acromion_r") ?? b.shoulderY;
  if (m.shoulder_width) b.shoulderW = m.shoulder_width.value / 1000;
  b.chestY = avgY("chest_side_l", "chest_side_r") ?? b.chestY;
  b.waistY = avgY("waist_side_l", "waist_side_r") ?? b.waistY;
  b.hipY = avgY("hip_side_l", "hip_side_r") ?? b.hipY;
  b.neckY = avgY("neck_side_l", "neck_side_r") ?? b.neckY;
  b.crotchY = y("crotch") ?? b.crotchY;
  b.kneeY = y("knee_r") ?? b.kneeY;
  if (m.arm_length) b.armL = m.arm_length.value / 1000;
  for (const k of ["neck", "chest", "waist", "hip"] as const) {
    const bw = m[`${k}_width`];
    const dp = m[`${k}_depth`];
    const circ = m[`${k}_circumference`];
    let rb = bw ? bw.value / 1000 : b.rings[k].b;
    let rd = dp ? dp.value / 1000 : b.rings[k].d;
    if (circ?.method === "manual") {
      const p = superellipsePerimeter(rb * 1000, rd * 1000, 2.35, 180);
      const s = circ.value / p;
      rb *= s;
      rd *= s;
    }
    b.rings[k] = { b: rb, d: rd, measured: !!(bw && dp) };
  }
  return b;
}

function superPts(breadth: number, depth: number, n: number, y: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push(new THREE.Vector3((breadth / 2) * Math.sign(c) * Math.abs(c) ** (2 / n), y, (depth / 2) * Math.sign(s) * Math.abs(s) ** (2 / n)));
  }
  return pts;
}

/** Stylised contour figure: main pose (arms out, legs together) + Da Vinci's alternate pose as a ghost. */
/** Smooth a control polyline (centripetal Catmull-Rom) into fine segments — Da Vinci contour, not a stick figure. */
function smooth(pts: THREE.Vector3[], n = 24): THREE.Vector3[] {
  return pts.length < 3 ? pts : new THREE.CatmullRomCurve3(pts, false, "centripetal").getPoints(n);
}

/** Golden (logarithmic) spiral r = r0·φ^(2θ/π) — one quarter turn grows by φ, like the Fibonacci squares. */
export function goldenSpiral(r0: number, rMax: number, map: (x: number, y: number) => THREE.Vector3): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let th = 0; ; th += 0.06) {
    const r = r0 * Math.pow(PHI, (2 * th) / Math.PI);
    if (r > rMax) break;
    pts.push(map(r * Math.cos(th), r * Math.sin(th)));
  }
  return pts;
}

/** Contour figure: main pose (arms out, legs together) + Leonardo's second pose as a ghost. */
function figureSegments(b: Body): { main: number[]; alt: number[] } {
  const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
  const main: number[] = [];
  const alt: number[] = [];
  const curve = (arr: number[], ...pts: THREE.Vector3[]) => arr.push(...loopSegments(smooth(pts), false));
  const H = b.H;
  // head: Leonardo's H/8, slightly taller than wide (ratio √φ)
  const headH = H / 8;
  const headW = headH / Math.sqrt(PHI);
  const headC = H - headH / 2;
  const head: THREE.Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    head.push(V((headW / 2) * Math.cos(t), headC + (headH / 2) * Math.sin(t)));
  }
  main.push(...loopSegments(head, false));
  const sw = b.shoulderW / 2;
  const cw = b.rings.chest.b / 2;
  const ww = b.rings.waist.b / 2;
  const hw = b.rings.hip.b / 2;
  const nw = b.rings.neck.b / 2;
  for (const s of [-1, 1]) {
    // neck into the trapezius and shoulder cap
    curve(main, V(s * nw * 0.8, headC - headH * 0.42), V(s * nw, b.neckY), V(s * (nw + (sw - nw) * 0.5), b.shoulderY + 0.035), V(s * sw, b.shoulderY + 0.01), V(s * (sw + 0.02), b.shoulderY - 0.025));
    // side of the torso: armpit → chest → waist → hip → upper thigh
    curve(main, V(s * cw * 1.03, b.shoulderY - 0.07), V(s * cw, b.chestY), V(s * (cw + ww) / 2 * 0.98, (b.chestY + b.waistY) / 2), V(s * ww, b.waistY), V(s * hw, b.hipY), V(s * hw * 0.93, b.crotchY));
    // outer and inner leg
    curve(main, V(s * hw * 0.93, b.crotchY), V(s * hw * 0.8, (b.crotchY + b.kneeY) / 2), V(s * hw * 0.6, b.kneeY), V(s * hw * 0.62, b.kneeY * 0.6), V(s * hw * 0.42, H * 0.045), V(s * hw * 0.58, 0.005));
    curve(main, V(s * 0.012, b.crotchY - 0.015), V(s * hw * 0.24, (b.crotchY + b.kneeY) / 2), V(s * hw * 0.22, b.kneeY), V(s * hw * 0.24, b.kneeY * 0.6), V(s * hw * 0.2, H * 0.045), V(s * hw * 0.12, 0.005));
  }
  // arms horizontal: in the canon the span equals the height
  const reach = H / 2;
  for (const s of [-1, 1]) {
    curve(main, V(s * (sw + 0.02), b.shoulderY - 0.025), V(s * (sw + b.armL * 0.45), b.shoulderY + 0.01), V(s * (sw + b.armL), b.shoulderY + 0.012), V(s * reach, b.shoulderY + 0.005));
    curve(main, V(s * cw * 1.03, b.shoulderY - 0.07), V(s * (sw + b.armL * 0.45), b.shoulderY - 0.045), V(s * (sw + b.armL), b.shoulderY - 0.025), V(s * reach, b.shoulderY - 0.012));
  }
  // second pose (ghost): hands rise to the circle, feet spread on it
  const navelY = H / PHI;
  const R = navelY;
  for (const s of [-1, 1]) {
    const a = Math.atan2(H - navelY, H / 2) * 0.82;
    const tip = V(s * R * Math.cos(a), navelY + R * Math.sin(a));
    curve(alt, V(s * sw, b.shoulderY), V(s * (sw + (Math.abs(tip.x) - sw) * 0.5), (b.shoulderY + tip.y) / 2 + 0.025), tip);
    const fa = Math.PI / 2 - Math.PI / (PHI * 8);
    const foot = V(s * R * Math.cos(fa), navelY - R * Math.sin(fa));
    curve(alt, V(s * hw * 0.82, b.crotchY), V((s * hw * 0.82 + foot.x) / 2 + s * 0.03, (b.crotchY + foot.y) / 2), foot);
  }
  return { main, alt };
}

function nodePosition(id: string, b: Body, lm?: Landmark): THREE.Vector3 | null {
  const V = (x: number, y: number, z = 0.02) => new THREE.Vector3(x, y, z);
  const sw = b.shoulderW / 2;
  const tbl: Record<string, () => THREE.Vector3> = {
    top_of_head: () => V(0, b.H),
    acromion_l: () => V(-sw, b.shoulderY), acromion_r: () => V(sw, b.shoulderY), arm_acromion_r: () => V(sw, b.shoulderY + 0.01),
    chest_side_l: () => V(-b.rings.chest.b / 2, b.chestY), chest_side_r: () => V(b.rings.chest.b / 2, b.chestY),
    chest_front: () => V(0, b.chestY, b.rings.chest.d / 2), chest_back: () => V(0, b.chestY, -b.rings.chest.d / 2),
    waist_side_l: () => V(-b.rings.waist.b / 2, b.waistY), waist_side_r: () => V(b.rings.waist.b / 2, b.waistY),
    waist_front: () => V(0, b.waistY, b.rings.waist.d / 2), waist_back: () => V(0, b.waistY, -b.rings.waist.d / 2),
    hip_side_l: () => V(-b.rings.hip.b / 2, b.hipY), hip_side_r: () => V(b.rings.hip.b / 2, b.hipY),
    hip_front: () => V(0, b.hipY, b.rings.hip.d / 2), hip_back: () => V(0, b.hipY, -b.rings.hip.d / 2),
    wrist_r: () => V(sw + b.armL, b.shoulderY),
    neck_side_l: () => V(-b.rings.neck.b / 2, b.neckY), neck_side_r: () => V(b.rings.neck.b / 2, b.neckY),
    neck_front: () => V(0, b.neckY, b.rings.neck.d / 2), nape: () => V(0, b.neckY, -b.rings.neck.d / 2),
    crotch: () => V(0, b.crotchY), knee_r: () => V(b.rings.hip.b * 0.3, b.kneeY),
    hand_l: () => V(-b.H / 2 + 0.09, b.shoulderY), hand_r: () => V(b.H / 2 - 0.09, b.shoulderY),
    floor: () => V(0.25, 0),
  };
  void lm;
  return tbl[id]?.() ?? null;
}
