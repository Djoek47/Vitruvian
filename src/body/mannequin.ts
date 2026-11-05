import type { BodyPassport } from "../passport/passport";
import { SHAPE_PRIORS, superellipsePerimeter } from "./circumference";

/**
 * Parametric measurement mannequin.
 *
 * A lofted body built from superellipse cross-sections placed at the measured
 * landmark heights. Its purpose is dimensional, not cosmetic: at chest, waist,
 * hip and neck the ring perimeter equals the passport circumference exactly, so a
 * garment simulated on it sees the person's real girths. Any dimension the
 * passport lacks is filled from height proportions and listed in `estimated`.
 *
 * Units: millimetres. Y up, floor at y = 0, body facing +Z, right side at −X
 * (so the figure faces the viewer in a default front view).
 */
export type Mesh = {
  vertices: [number, number, number][];
  faces: number[][];
  groups: { name: string; start: number }[];
  estimated: string[];
  /** Anatomical region of every vertex (for change maps). Same order as `vertices`. */
  vertexRegion: string[];
};

/** Generator id: the topology is fixed for a given generator version (required for interpolation). */
export const MANNEQUIN_GENERATOR = "vitruvian-mannequin@1";

const SEG = 48;

type Ring = { y: number; breadth: number; depth: number; n: number; cx?: number; cz?: number };

function ringPoints(r: Ring): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const a = r.breadth / 2;
  const b = r.depth / 2;
  for (let i = 0; i < SEG; i++) {
    const t = (i / SEG) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push([(r.cx ?? 0) + a * Math.sign(c) * Math.abs(c) ** (2 / r.n), r.y, (r.cz ?? 0) + b * Math.sign(s) * Math.abs(s) ** (2 / r.n)]);
  }
  return pts;
}

/** Scale a ring uniformly so its perimeter equals `targetPerimeter`. */
function fitPerimeter(r: Ring, targetPerimeter: number): Ring {
  const p = superellipsePerimeter(r.breadth, r.depth, r.n, 360);
  const k = p > 0 ? targetPerimeter / p : 1;
  return { ...r, breadth: r.breadth * k, depth: r.depth * k };
}

export function buildMannequin(p: BodyPassport): Mesh {
  const m = Object.fromEntries(p.measurements.map((x) => [x.id, x.value]));
  const lm = Object.fromEntries(p.landmarks.map((l) => [l.id, l]));
  const estimated: string[] = [];
  const get = (id: string, fallback: number) => {
    if (Number.isFinite(m[id])) return m[id];
    estimated.push(id);
    return fallback;
  };
  const H = get("height", 1750);
  const lmY = (id: string, ratio: number) => (lm[id] ? lm[id].body.y * 1000 : (estimated.push(`${id}_height`), H * ratio));

  const shoulderW = get("shoulder_width", H * 0.23);
  const chestB = get("chest_width", H * 0.18);
  const chestD = get("chest_depth", H * 0.135);
  const waistB = get("waist_width", H * 0.16);
  const waistD = get("waist_depth", H * 0.12);
  const hipB = get("hip_width", H * 0.195);
  const hipD = get("hip_depth", H * 0.14);
  const neckB = get("neck_width", H * 0.068);
  const neckD = get("neck_depth", H * 0.07);
  const armL = get("arm_length", H * 0.335);
  const inseam = get("inseam", H * 0.45);

  const yShoulder = Number.isFinite(m.shoulder_height) ? m.shoulder_height : lmY("acromion_l", 0.818);
  const yChest = lm.chest_side_l ? (lm.chest_side_l.body.y + (lm.chest_side_r?.body.y ?? lm.chest_side_l.body.y)) * 500 : lmY("chest_side_l", 0.72);
  const yWaist = Number.isFinite(m.waist_height) ? m.waist_height : lmY("waist_side_l", 0.6);
  const yHip = lm.hip_side_l ? (lm.hip_side_l.body.y + (lm.hip_side_r?.body.y ?? lm.hip_side_l.body.y)) * 500 : lmY("hip_side_l", 0.5);
  const yNeck = lm.nape ? lm.nape.body.y * 1000 : (estimated.push("nape_height"), yShoulder + H * 0.03);

  const circ = (id: string, B: number, D: number, region: string) => (Number.isFinite(m[id]) ? m[id] : superellipsePerimeter(B, D, SHAPE_PRIORS[region], 360));
  const chestRing = fitPerimeter({ y: yChest, breadth: chestB, depth: chestD, n: SHAPE_PRIORS.chest }, circ("chest_circumference", chestB, chestD, "chest"));
  const waistRing = fitPerimeter({ y: yWaist, breadth: waistB, depth: waistD, n: SHAPE_PRIORS.waist }, circ("waist_circumference", waistB, waistD, "waist"));
  const hipRing = fitPerimeter({ y: yHip, breadth: hipB, depth: hipD, n: SHAPE_PRIORS.hip }, circ("hip_circumference", hipB, hipD, "hip"));
  const neckRing = fitPerimeter({ y: yNeck, breadth: neckB, depth: neckD, n: SHAPE_PRIORS.neck }, circ("neck_circumference", neckB, neckD, "neck"));

  const yCrotch = Math.min(inseam, yHip - 40);
  const torso: Ring[] = [
    { y: yCrotch, breadth: hipRing.breadth * 0.9, depth: hipRing.depth * 0.85, n: 2.2 },
    hipRing,
    { y: (yHip + yWaist) / 2, breadth: (hipRing.breadth + waistRing.breadth) / 2, depth: (hipRing.depth + waistRing.depth) / 2, n: 2.3 },
    waistRing,
    { y: (yWaist + yChest) / 2, breadth: (waistRing.breadth + chestRing.breadth) / 2, depth: (waistRing.depth + chestRing.depth) / 2, n: 2.35 },
    chestRing,
    { y: yShoulder - 25, breadth: Math.max(chestRing.breadth, shoulderW * 0.92), depth: chestRing.depth * 0.82, n: 2.6 },
    { y: yShoulder, breadth: shoulderW * 0.75, depth: chestRing.depth * 0.6, n: 2.2 },
    neckRing,
    { y: yNeck + 70, breadth: neckRing.breadth * 0.95, depth: neckRing.depth * 0.95, n: 2 },
  ];
  // Head: ellipsoid-ish rings up to the vertex.
  const headBase = yNeck + 70;
  const headH = Math.max(150, H - headBase);
  const headB = H * 0.088;
  const headD = H * 0.11;
  for (let i = 1; i <= 6; i++) {
    const f = i / 7;
    const r = Math.sin(Math.acos(1 - 2 * Math.min(1, f * 1.1)) || 0);
    torso.push({ y: headBase + headH * f, breadth: Math.max(10, headB * (0.75 + 0.25 * r)), depth: Math.max(10, headD * (0.75 + 0.25 * r)), n: 2, cz: headD * 0.05 });
  }

  const mesh: Mesh = { vertices: [], faces: [], groups: [], estimated, vertexRegion: [] };
  const torsoRegions = ["hips", "hips", "waist", "waist", "chest", "chest", "shoulders", "shoulders", "neck", "neck", "head", "head", "head", "head", "head", "head"];
  loft(mesh, "torso", torso, true, H, torsoRegions);

  // Legs: tubes from crotch to floor, centred under the hip ring. Measured thigh/calf girths when available.
  const legOffset = hipRing.breadth * 0.24;
  const thighB = Number.isFinite(m.thigh_width) ? m.thigh_width : hipRing.breadth * 0.42;
  const thighD = Number.isFinite(m.thigh_depth) ? m.thigh_depth : thighB * 1.05;
  const calfB = Number.isFinite(m.calf_width) ? m.calf_width : thighB * 0.62;
  const calfD = Number.isFinite(m.calf_depth) ? m.calf_depth : thighB * 0.66;
  if (!Number.isFinite(m.thigh_width)) estimated.push("thigh_girth");
  if (!Number.isFinite(m.calf_width)) estimated.push("calf_girth");
  const yKnee = Number.isFinite(m.knee_height) ? m.knee_height : H * 0.285;
  const yAnkle = Number.isFinite(m.ankle_height) ? m.ankle_height : H * 0.045;
  const yCalf = yAnkle + (yKnee - yAnkle) * 0.62;
  for (const side of [-1, 1]) {
    const thighRing: Ring = { y: yCrotch - 30, breadth: thighB, depth: thighD, n: SHAPE_PRIORS.thigh, cx: side * legOffset };
    const calfRing: Ring = { y: yCalf, breadth: calfB, depth: calfD, n: SHAPE_PRIORS.calf, cx: side * legOffset * 0.75 };
    loft(mesh, side < 0 ? "leg_right" : "leg_left", [
      Number.isFinite(m.thigh_circumference) ? fitPerimeter(thighRing, m.thigh_circumference) : thighRing,
      { y: yKnee, breadth: calfB * 0.95, depth: calfD * 0.92, n: 2, cx: side * legOffset * 0.8 },
      Number.isFinite(m.calf_circumference) ? fitPerimeter(calfRing, m.calf_circumference) : calfRing,
      { y: yAnkle + 20, breadth: calfB * 0.58, depth: calfD * 0.55, n: 2, cx: side * legOffset * 0.7 },
      { y: 5, breadth: calfB * 0.62, depth: calfD * 1.4, n: 2, cx: side * legOffset * 0.7, cz: calfD * 0.35 },
    ], false, undefined, ["thighs", "thighs", "calves", "calves", "feet"]);
  }
  estimated.push("arm_girths");

  // Arms: hang along the sides with a 12° abduction so cloth can pass (A-pose).
  const ang = (12 * Math.PI) / 180;
  for (const side of [-1, 1]) {
    const x0 = side * (shoulderW / 2 - 25);
    const rings: Ring[] = [];
    for (let i = 0; i <= 5; i++) {
      const f = i / 5;
      const d = armL * f;
      const g = 110 - 55 * f;
      rings.push({ y: yShoulder - 30 - d * Math.cos(ang), breadth: g, depth: g * 0.95, n: 2, cx: x0 + side * d * Math.sin(ang) });
    }
    loft(mesh, side < 0 ? "arm_right" : "arm_left", rings, false, undefined, ["upper arms", "upper arms", "upper arms", "forearms", "forearms", "forearms"]);
  }
  return mesh;
}

function loft(mesh: Mesh, name: string, rings: Ring[], capTop: boolean, topY?: number, regions?: string[]) {
  mesh.groups.push({ name, start: mesh.faces.length });
  const base = mesh.vertices.length;
  rings.forEach((r, j) => {
    mesh.vertices.push(...ringPoints(r));
    for (let i = 0; i < SEG; i++) mesh.vertexRegion.push(regions?.[j] ?? name);
  });
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < SEG; i++) {
      const a = base + j * SEG + i;
      const b = base + j * SEG + ((i + 1) % SEG);
      const c = base + (j + 1) * SEG + ((i + 1) % SEG);
      const d = base + (j + 1) * SEG + i;
      mesh.faces.push([a, d, c, b]);
    }
  // bottom cap
  const bottomC = mesh.vertices.length;
  const r0 = rings[0];
  mesh.vertices.push([r0.cx ?? 0, r0.y, r0.cz ?? 0]);
  mesh.vertexRegion.push(regions?.[0] ?? name);
  for (let i = 0; i < SEG; i++) mesh.faces.push([bottomC, base + i, base + ((i + 1) % SEG)]);
  // top cap
  const last = rings[rings.length - 1];
  const topC = mesh.vertices.length;
  mesh.vertices.push([last.cx ?? 0, capTop && topY ? topY : last.y, last.cz ?? 0]);
  mesh.vertexRegion.push(regions?.[rings.length - 1] ?? name);
  const lb = base + (rings.length - 1) * SEG;
  for (let i = 0; i < SEG; i++) mesh.faces.push([topC, lb + ((i + 1) % SEG), lb + i]);
}

export function mannequinToObj(mesh: Mesh, header: string): string {
  const out: string[] = [`# ${header}`, "# units: millimetres, Y up, floor y=0, facing +Z", `# estimated (not measured): ${mesh.estimated.join(", ") || "none"}`];
  for (const v of mesh.vertices) out.push(`v ${v[0].toFixed(2)} ${v[1].toFixed(2)} ${v[2].toFixed(2)}`);
  let g = 0;
  mesh.faces.forEach((f, i) => {
    while (g < mesh.groups.length && mesh.groups[g].start === i) out.push(`g ${mesh.groups[g++].name}`);
    out.push("f " + f.map((x) => x + 1).join(" "));
  });
  return out.join("\n") + "\n";
}

/** Perimeter of the mannequin's horizontal section through ring index (for tests). */
export function ringPerimeterAt(mesh: Mesh, y: number): number {
  const pts = mesh.vertices.filter((v) => Math.abs(v[1] - y) < 0.01);
  const ring = pts.slice(0, SEG);
  let per = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    per += Math.hypot(a[0] - b[0], a[2] - b[2]);
  }
  return per;
}
