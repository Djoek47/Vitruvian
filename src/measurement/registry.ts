import { distance, forwardSeparation, lateralSeparation, type BodyFrame } from "../core/math";
import { mToMm } from "../core/units";
import { LANDMARKS } from "../anatomy/landmarks";
import { circumferenceFromBreadthDepth, DEPTH_RATIO, SHAPE_PRIORS } from "../body/circumference";
import type { Calibration, Landmark, Measurement, MeasurementMethod, ProfileKind } from "./types";

/**
 * Measurement registry. Adding a measurement = adding one entry here; the UI,
 * Body Passport, CSV, Marvelous Designer sheet and mannequin all iterate this.
 */
export type ComputeCtx = {
  lm: Record<string, Landmark>;
  m: Record<string, Measurement>;
  frame: BodyFrame;
  cal: Calibration;
  /** Per-user / per-dataset shape exponents (falls back to SHAPE_PRIORS). */
  shape: Record<string, number>;
};

export type ComputeResult = { valueMm: number; uncertaintyMm: number; randomUncertaintyMm?: number; method: MeasurementMethod; sources: string[]; procedure: string };

export type MeasurementDef = {
  id: string;
  label: string;
  labelFr: string;
  group: "Global" | "Head/neck" | "Torso" | "Arms" | "Legs" | "Feet";
  profiles: ProfileKind[];
  /** Tolerance that matters for T-shirt fit; drives the confidence score. */
  fitToleranceMm: number;
  /** Relevance to the first garment target. */
  tshirt: boolean;
  /** Broad plausibility window (mm) to catch gross capture errors — not population norms. */
  plausibleMm: [number, number];
  compute: (c: ComputeCtx) => ComputeResult | null;
};

// ── uncertainty helpers ──────────────────────────────────────────────────────
/** Assumed tracking noise floor per point (mm). Replace with the value measured in Test 001. */
export const TRACKING_FLOOR_MM = 2;
/** Extra error when two landmarks are captured in separate windows (body sway). */
export const SEQUENTIAL_MOTION_MM = 6;

function pointUnc(c: ComputeCtx, id: string): number {
  const l = c.lm[id];
  // "More points = more established": n independent placements reduce the random placement
  // error by √n. With ≥2 samples the observed repeat spread replaces the prior (floored at half the prior).
  const n = Math.max(1, l.samples ?? 1);
  const prior = LANDMARKS[id]?.placementUncMm ?? 8;
  const placement = n >= 2 ? Math.max(l.repeatSdMm ?? prior, prior * 0.5) / Math.sqrt(n) : prior;
  const tip = l.captureMethod === "controller-tip" ? (c.cal.tipResidualMm ?? 6) : 0; // uncalibrated tip ⇒ 6 mm
  return Math.sqrt(placement ** 2 + tip ** 2 + TRACKING_FLOOR_MM ** 2 + l.spreadMm ** 2);
}
const rss = (...xs: number[]) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0));
const has = (c: ComputeCtx, ...ids: string[]) => ids.every((i) => c.lm[i]?.validation === "confirmed");
const hasM = (c: ComputeCtx, ...ids: string[]) => ids.every((i) => c.m[i] && Number.isFinite(c.m[i].value));

function heightAboveFloor(c: ComputeCtx, id: string, procedure: string): ComputeResult | null {
  if (!has(c, id) || !c.cal.floorCalibrated || c.cal.floorY === null) return null;
  const floorU = c.lm.floor ? pointUnc(c, "floor") : 5;
  return {
    valueMm: mToMm(c.lm[id].position.y - c.cal.floorY),
    uncertaintyMm: rss(pointUnc(c, id), floorU),
    method: "direct",
    sources: [id, "floor"],
    procedure,
  };
}

function vertical(c: ComputeCtx, top: string, bottom: string, procedure: string, sequential = true): ComputeResult | null {
  if (!has(c, top, bottom)) return null;
  return {
    valueMm: mToMm(c.lm[top].position.y - c.lm[bottom].position.y),
    uncertaintyMm: rss(pointUnc(c, top), pointUnc(c, bottom), sequential ? SEQUENTIAL_MOTION_MM : 0),
    method: "direct", sources: [top, bottom], procedure,
  };
}
function between(c: ComputeCtx, a: string, b: string, procedure: string, sequential = true): ComputeResult | null {
  if (!has(c, a, b)) return null;
  return {
    valueMm: mToMm(distance(c.lm[a].position, c.lm[b].position)),
    uncertaintyMm: rss(pointUnc(c, a), pointUnc(c, b), sequential ? SEQUENTIAL_MOTION_MM : 0),
    method: "direct", sources: [a, b], procedure,
  };
}

function breadth(c: ComputeCtx, a: string, b: string): ComputeResult | null {
  if (!has(c, a, b)) return null;
  return {
    valueMm: mToMm(lateralSeparation(c.frame, c.lm[a].position, c.lm[b].position)),
    uncertaintyMm: rss(pointUnc(c, a), pointUnc(c, b)),
    method: "direct",
    sources: [a, b],
    procedure: "Simultaneous two-tip capture, separation projected on body lateral axis",
  };
}
function depth(c: ComputeCtx, a: string, b: string): ComputeResult | null {
  if (!has(c, a, b)) return null;
  return {
    valueMm: mToMm(forwardSeparation(c.frame, c.lm[a].position, c.lm[b].position)),
    uncertaintyMm: rss(pointUnc(c, a), pointUnc(c, b)),
    method: "direct",
    sources: [a, b],
    procedure: "Simultaneous two-tip capture, separation projected on body forward axis",
  };
}
function girth(c: ComputeCtx, region: string, bId: string, dId: string): ComputeResult | null {
  if (!hasM(c, bId)) return null;
  if (!hasM(c, dId)) {
    // Mode without depth points (Simple): ESTIMATE depth from breadth with a population prior.
    const B0 = c.m[bId];
    const k = DEPTH_RATIO[region] ?? 0.8;
    const n0 = c.shape[region] ?? SHAPE_PRIORS[region] ?? 2.2;
    const est = circumferenceFromBreadthDepth(B0.value, B0.value * k, B0.uncertaintyMm, B0.uncertaintyMm * k, n0, 0.06);
    const rnd = circumferenceFromBreadthDepth(B0.value, B0.value * k, B0.uncertaintyMm, B0.uncertaintyMm * k, n0, 0);
    return { valueMm: est.valueMm, uncertaintyMm: est.uncertaintyMm, randomUncertaintyMm: rnd.uncertaintyMm, method: "estimated", sources: [bId],
      procedure: `ESTIMATED: depth assumed ${k}× breadth (population prior, not measured) — Intermediate mode measures it` };
  }
  const B = c.m[bId];
  const D = c.m[dId];
  const n = c.shape[region] ?? SHAPE_PRIORS[region];
  const fitted = c.shape[region] !== undefined;
  const r = circumferenceFromBreadthDepth(B.value, D.value, B.uncertaintyMm, D.uncertaintyMm, n, fitted ? 0.015 : 0.03);
  const rand = circumferenceFromBreadthDepth(B.value, D.value, B.uncertaintyMm, D.uncertaintyMm, n, 0);
  return {
    valueMm: r.valueMm,
    uncertaintyMm: r.uncertaintyMm,
    randomUncertaintyMm: rand.uncertaintyMm,
    method: "derived",
    sources: [bId, dId],
    procedure: `Superellipse cross-section (n=${n.toFixed(2)}${fitted ? ", fitted" : ", prior"}) from measured breadth and depth`,
  };
}

const BOTH: ProfileKind[] = ["simple", "intermediate", "ultra"];
const PRE: ProfileKind[] = ["intermediate", "ultra"];
const ULT: ProfileKind[] = ["ultra"];

export const MEASUREMENTS: MeasurementDef[] = [
  { id: "height", label: "Height", labelFr: "Taille", group: "Global", profiles: BOTH, fitToleranceMm: 15, tshirt: true, plausibleMm: [1200, 2300],
    compute: (c) => heightAboveFloor(c, "top_of_head", "Controller tip on vertex, height above calibrated floor") },
  { id: "shoulder_width", label: "Shoulder width (biacromial)", labelFr: "Largeur d'épaules", group: "Torso", profiles: BOTH, fitToleranceMm: 10, tshirt: true, plausibleMm: [280, 520],
    compute: (c) => has(c, "acromion_l", "acromion_r") ? {
      valueMm: mToMm(distance(c.lm.acromion_l.position, c.lm.acromion_r.position)),
      uncertaintyMm: rss(pointUnc(c, "acromion_l"), pointUnc(c, "acromion_r")),
      method: "direct", sources: ["acromion_l", "acromion_r"], procedure: "Crossed-arm simultaneous tip capture, straight-line acromion to acromion",
    } : null },
  { id: "chest_width", label: "Chest breadth", labelFr: "Largeur poitrine", group: "Torso", profiles: BOTH, fitToleranceMm: 10, tshirt: true, plausibleMm: [200, 500], compute: (c) => breadth(c, "chest_side_l", "chest_side_r") },
  { id: "chest_depth", label: "Chest depth", labelFr: "Profondeur poitrine", group: "Torso", profiles: PRE, fitToleranceMm: 10, tshirt: true, plausibleMm: [150, 400], compute: (c) => depth(c, "chest_front", "chest_back") },
  { id: "chest_circumference", label: "Chest circumference", labelFr: "Tour de poitrine", group: "Torso", profiles: BOTH, fitToleranceMm: 20, tshirt: true, plausibleMm: [650, 1600], compute: (c) => girth(c, "chest", "chest_width", "chest_depth") },
  { id: "waist_width", label: "Waist breadth", labelFr: "Largeur taille", group: "Torso", profiles: BOTH, fitToleranceMm: 10, tshirt: true, plausibleMm: [180, 520], compute: (c) => breadth(c, "waist_side_l", "waist_side_r") },
  { id: "waist_depth", label: "Waist depth", labelFr: "Profondeur taille", group: "Torso", profiles: PRE, fitToleranceMm: 10, tshirt: true, plausibleMm: [130, 450], compute: (c) => depth(c, "waist_front", "waist_back") },
  { id: "waist_circumference", label: "Waist circumference", labelFr: "Tour de taille", group: "Torso", profiles: BOTH, fitToleranceMm: 20, tshirt: true, plausibleMm: [500, 1700], compute: (c) => girth(c, "waist", "waist_width", "waist_depth") },
  { id: "hip_width", label: "Hip breadth", labelFr: "Largeur hanches", group: "Torso", profiles: BOTH, fitToleranceMm: 10, tshirt: true, plausibleMm: [250, 560], compute: (c) => breadth(c, "hip_side_l", "hip_side_r") },
  { id: "hip_depth", label: "Hip depth", labelFr: "Profondeur hanches", group: "Torso", profiles: PRE, fitToleranceMm: 10, tshirt: true, plausibleMm: [150, 450], compute: (c) => depth(c, "hip_front", "hip_back") },
  { id: "hip_circumference", label: "Hip circumference", labelFr: "Tour de hanches", group: "Torso", profiles: BOTH, fitToleranceMm: 20, tshirt: true, plausibleMm: [700, 1700], compute: (c) => girth(c, "hip", "hip_width", "hip_depth") },
  { id: "arm_length", label: "Arm length (shoulder → wrist)", labelFr: "Longueur de bras", group: "Arms", profiles: BOTH, fitToleranceMm: 15, tshirt: true, plausibleMm: [420, 750],
    compute: (c) => has(c, "arm_acromion_r", "wrist_r") ? {
      valueMm: mToMm(distance(c.lm.arm_acromion_r.position, c.lm.wrist_r.position)),
      uncertaintyMm: rss(pointUnc(c, "arm_acromion_r"), pointUnc(c, "wrist_r"), SEQUENTIAL_MOTION_MM),
      method: "direct", sources: ["arm_acromion_r", "wrist_r"], procedure: "Sequential tip capture, arm hanging straight, acromion to ulnar styloid",
    } : has(c, "acromion_r", "wrist_r") ? {
      // Simple mode: the acromion was captured with arms crossed (it shifts when the arm hangs) → derived, wider uncertainty
      valueMm: mToMm(distance(c.lm.acromion_r.position, c.lm.wrist_r.position)),
      uncertaintyMm: rss(pointUnc(c, "acromion_r"), pointUnc(c, "wrist_r"), SEQUENTIAL_MOTION_MM, 15),
      method: "derived", sources: ["acromion_r", "wrist_r"], procedure: "Crossed-arm acromion (Simple mode) to wrist with the arm hanging — approximate",
    } : null },
  { id: "shoulder_height", label: "Shoulder height", labelFr: "Hauteur d'épaule", group: "Torso", profiles: BOTH, fitToleranceMm: 15, tshirt: false, plausibleMm: [950, 1900],
    compute: (c) => {
      return heightAboveFloor(c, "arm_acromion_r", "Acromion (arm hanging) height above floor") ?? heightAboveFloor(c, "acromion_r", "Acromion height above floor (crossed-arm capture)");
    } },
  { id: "waist_height", label: "Waist height", labelFr: "Hauteur de taille", group: "Torso", profiles: BOTH, fitToleranceMm: 15, tshirt: true, plausibleMm: [700, 1400],
    compute: (c) => {
      if (!has(c, "waist_side_l", "waist_side_r") || c.cal.floorY === null) return null;
      const y = (c.lm.waist_side_l.position.y + c.lm.waist_side_r.position.y) / 2;
      return { valueMm: mToMm(y - c.cal.floorY), uncertaintyMm: rss(pointUnc(c, "waist_side_l") / 1.4, 5), method: "direct", sources: ["waist_side_l", "waist_side_r", "floor"], procedure: "Mean height of waist side landmarks above floor" };
    } },
  { id: "back_length", label: "Back length (nape → waist)", labelFr: "Longueur de dos", group: "Torso", profiles: PRE, fitToleranceMm: 15, tshirt: true, plausibleMm: [320, 620],
    compute: (c) => {
      if (!has(c, "nape", "waist_back")) return null;
      return { valueMm: mToMm(c.lm.nape.position.y - c.lm.waist_back.position.y), uncertaintyMm: rss(pointUnc(c, "nape"), pointUnc(c, "waist_back"), SEQUENTIAL_MOTION_MM), method: "direct", sources: ["nape", "waist_back"], procedure: "Vertical separation of C7 and back-waist landmarks (separate captures)" };
    } },
  { id: "neck_width", label: "Neck breadth", labelFr: "Largeur du cou", group: "Head/neck", profiles: PRE, fitToleranceMm: 8, tshirt: true, plausibleMm: [80, 200], compute: (c) => breadth(c, "neck_side_l", "neck_side_r") },
  { id: "neck_depth", label: "Neck depth", labelFr: "Profondeur du cou", group: "Head/neck", profiles: PRE, fitToleranceMm: 8, tshirt: true, plausibleMm: [80, 220], compute: (c) => depth(c, "neck_front", "nape") },
  { id: "neck_circumference", label: "Neck circumference", labelFr: "Tour de cou", group: "Head/neck", profiles: PRE, fitToleranceMm: 15, tshirt: true, plausibleMm: [250, 600], compute: (c) => girth(c, "neck", "neck_width", "neck_depth") },
  { id: "inseam", label: "Inseam", labelFr: "Entrejambe", group: "Legs", profiles: PRE, fitToleranceMm: 15, tshirt: false, plausibleMm: [550, 1050], compute: (c) => heightAboveFloor(c, "crotch", "Crotch tip height above floor") },
  { id: "outseam", label: "Outseam (waist → floor)", labelFr: "Hauteur extérieure", group: "Legs", profiles: PRE, fitToleranceMm: 15, tshirt: false, plausibleMm: [700, 1400],
    compute: (c) => (hasM(c, "waist_height") ? { valueMm: c.m.waist_height.value, uncertaintyMm: c.m.waist_height.uncertaintyMm, method: "derived", sources: ["waist_height"], procedure: "Equal to waist height above floor (straight-leg outseam)" } : null) },
  { id: "knee_height", label: "Knee height", labelFr: "Hauteur du genou", group: "Legs", profiles: PRE, fitToleranceMm: 15, tshirt: false, plausibleMm: [350, 700], compute: (c) => heightAboveFloor(c, "knee_r", "Knee joint line height above floor") },
  { id: "arm_span", label: "Arm span", labelFr: "Envergure", group: "Arms", profiles: PRE, fitToleranceMm: 20, tshirt: false, plausibleMm: [1200, 2300],
    compute: (c) => {
      if (!has(c, "hand_l", "hand_r")) return null;
      // Grip pose is the palm centre. Palm-centre → middle fingertip is NOT measured; we add an
      // estimated 2 × 95 mm (adult hand) with ±15 mm each, so the result is DERIVED, not DIRECT.
      const grip = mToMm(distance(c.lm.hand_l.position, c.lm.hand_r.position));
      return { valueMm: grip + 190, uncertaintyMm: rss(pointUnc(c, "hand_l"), pointUnc(c, "hand_r"), 15, 15), method: "derived", sources: ["hand_l", "hand_r"], procedure: "Grip-to-grip distance in T-pose + estimated palm-to-fingertip offset (2 × 95 mm)" };
    } },
];

MEASUREMENTS.push(
  { id: "eye_height", label: "Eye height (headset)", labelFr: "Hauteur des yeux", group: "Global", profiles: BOTH, fitToleranceMm: 15, tshirt: false, plausibleMm: [1050, 2150],
    compute: (c) => (has(c, "head_device") && c.cal.floorY !== null ? { valueMm: mToMm(c.lm.head_device.position.y - c.cal.floorY), uncertaintyMm: 8, method: "direct", sources: ["head_device", "floor"], procedure: "Headset viewer pose (between the eyes) above floor while standing straight" } : null) },
  { id: "upper_arm_length", label: "Upper arm (shoulder → elbow)", labelFr: "Bras supérieur", group: "Arms", profiles: PRE, fitToleranceMm: 12, tshirt: true, plausibleMm: [230, 450],
    compute: (c) => between(c, "arm_acromion_r", "elbow_r", "Sequential tip capture, arm hanging, acromion to lateral epicondyle") },
  { id: "forearm_length", label: "Forearm (elbow → wrist)", labelFr: "Avant-bras", group: "Arms", profiles: PRE, fitToleranceMm: 12, tshirt: false, plausibleMm: [180, 360],
    compute: (c) => between(c, "elbow_r", "wrist_r", "Sequential tip capture, arm hanging, lateral epicondyle to ulnar styloid") },
  { id: "front_waist_length", label: "Front waist length (neck → waist)", labelFr: "Longueur taille devant", group: "Torso", profiles: PRE, fitToleranceMm: 15, tshirt: true, plausibleMm: [280, 600],
    compute: (c) => vertical(c, "neck_front", "waist_front", "Vertical separation of front-neck and front-waist landmarks") },
  { id: "rise", label: "Rise (waist → crotch)", labelFr: "Montant", group: "Legs", profiles: PRE, fitToleranceMm: 12, tshirt: false, plausibleMm: [150, 450],
    compute: (c) => (has(c, "waist_side_l", "waist_side_r", "crotch") ? { valueMm: mToMm((c.lm.waist_side_l.position.y + c.lm.waist_side_r.position.y) / 2 - c.lm.crotch.position.y), uncertaintyMm: rss(pointUnc(c, "waist_side_l") / 1.4, pointUnc(c, "crotch"), SEQUENTIAL_MOTION_MM), method: "direct", sources: ["waist_side_l", "waist_side_r", "crotch"], procedure: "Waist height minus crotch height" } : null) },
  { id: "ankle_height", label: "Ankle height", labelFr: "Hauteur de cheville", group: "Legs", profiles: PRE, fitToleranceMm: 10, tshirt: false, plausibleMm: [40, 140],
    compute: (c) => heightAboveFloor(c, "ankle_r", "Lateral malleolus height above floor") },
  { id: "foot_length", label: "Foot length", labelFr: "Longueur du pied", group: "Feet", profiles: PRE, fitToleranceMm: 5, tshirt: false, plausibleMm: [180, 330],
    compute: (c) => (has(c, "heel_r", "toe_r") ? { valueMm: mToMm(Math.hypot(c.lm.heel_r.position.x - c.lm.toe_r.position.x, c.lm.heel_r.position.z - c.lm.toe_r.position.z)), uncertaintyMm: rss(pointUnc(c, "heel_r"), pointUnc(c, "toe_r")), method: "direct", sources: ["heel_r", "toe_r"], procedure: "Horizontal heel-to-toe distance, both tips on the floor" } : null) },
);

MEASUREMENTS.push(
  { id: "thigh_width", label: "Thigh breadth", labelFr: "Largeur de cuisse", group: "Legs", profiles: PRE, fitToleranceMm: 8, tshirt: false, plausibleMm: [90, 260], compute: (c) => breadth(c, "thigh_in_r", "thigh_out_r") },
  { id: "thigh_depth", label: "Thigh depth", labelFr: "Profondeur de cuisse", group: "Legs", profiles: PRE, fitToleranceMm: 8, tshirt: false, plausibleMm: [90, 260], compute: (c) => depth(c, "thigh_front_r", "thigh_back_r") },
  { id: "thigh_circumference", label: "Thigh circumference", labelFr: "Tour de cuisse", group: "Legs", profiles: PRE, fitToleranceMm: 15, tshirt: false, plausibleMm: [350, 900], compute: (c) => girth(c, "thigh", "thigh_width", "thigh_depth") },
  { id: "calf_width", label: "Calf breadth", labelFr: "Largeur du mollet", group: "Legs", profiles: PRE, fitToleranceMm: 6, tshirt: false, plausibleMm: [60, 180], compute: (c) => breadth(c, "calf_in_r", "calf_out_r") },
  { id: "calf_depth", label: "Calf depth", labelFr: "Profondeur du mollet", group: "Legs", profiles: PRE, fitToleranceMm: 6, tshirt: false, plausibleMm: [60, 180], compute: (c) => depth(c, "calf_front_r", "calf_back_r") },
  { id: "calf_circumference", label: "Calf circumference", labelFr: "Tour de mollet", group: "Legs", profiles: PRE, fitToleranceMm: 10, tshirt: false, plausibleMm: [220, 600], compute: (c) => girth(c, "calf", "calf_width", "calf_depth") },
  // Not measurable alone with two controllers (the measured arm holds one) → tape / manual entry only.
  { id: "upper_arm_circumference", label: "Upper arm circumference (tape)", labelFr: "Tour de bras", group: "Arms", profiles: PRE, fitToleranceMm: 10, tshirt: true, plausibleMm: [180, 600], compute: () => null },
  { id: "forearm_circumference", label: "Forearm circumference (tape)", labelFr: "Tour d'avant-bras", group: "Arms", profiles: PRE, fitToleranceMm: 8, tshirt: false, plausibleMm: [160, 450], compute: () => null },
  { id: "wrist_circumference", label: "Wrist circumference (tape)", labelFr: "Tour de poignet", group: "Arms", profiles: PRE, fitToleranceMm: 5, tshirt: false, plausibleMm: [120, 260], compute: () => null },
);

const midY = (c: ComputeCtx, a: string, b: string) => (c.lm[a].position.y + c.lm[b].position.y) / 2;
MEASUREMENTS.push(
  // ── tailor's set (Intermediate) ──
  { id: "shoulder_length_r", label: "Shoulder length, right (HPS → shoulder point)", labelFr: "Longueur d'épaule droite", group: "Torso", profiles: PRE, fitToleranceMm: 8, tshirt: true, plausibleMm: [80, 220],
    compute: (c) => between(c, "hps_r", "acromion_r", "Straight line from the neck-shoulder point to the acromion (separate captures)") },
  { id: "shoulder_length_l", label: "Shoulder length, left", labelFr: "Longueur d'épaule gauche", group: "Torso", profiles: PRE, fitToleranceMm: 8, tshirt: true, plausibleMm: [80, 220],
    compute: (c) => between(c, "hps_l", "acromion_l", "Straight line from the neck-shoulder point to the acromion (separate captures)") },
  { id: "shoulder_slope_r", label: "Shoulder drop, right (HPS − acromion height)", labelFr: "Pente d'épaule droite", group: "Torso", profiles: PRE, fitToleranceMm: 8, tshirt: true, plausibleMm: [5, 110],
    compute: (c) => vertical(c, "hps_r", "acromion_r", "Vertical drop from neck-shoulder point to acromion") },
  { id: "shoulder_slope_l", label: "Shoulder drop, left", labelFr: "Pente d'épaule gauche", group: "Torso", profiles: PRE, fitToleranceMm: 8, tshirt: true, plausibleMm: [5, 110],
    compute: (c) => vertical(c, "hps_l", "acromion_l", "Vertical drop from neck-shoulder point to acromion") },
  { id: "neck_base_width", label: "Neck base breadth (HPS ↔ HPS)", labelFr: "Largeur base du cou", group: "Head/neck", profiles: PRE, fitToleranceMm: 8, tshirt: true, plausibleMm: [80, 220], compute: (c) => breadth(c, "hps_l", "hps_r") },
  { id: "across_front", label: "Across front (straight)", labelFr: "Carrure devant", group: "Torso", profiles: PRE, fitToleranceMm: 10, tshirt: true, plausibleMm: [220, 480], compute: (c) => breadth(c, "front_armpit_l", "front_armpit_r") },
  { id: "across_back", label: "Across back (straight)", labelFr: "Carrure dos", group: "Torso", profiles: PRE, fitToleranceMm: 10, tshirt: true, plausibleMm: [240, 520], compute: (c) => breadth(c, "back_armpit_l", "back_armpit_r") },
  { id: "armhole_depth", label: "Armhole depth (nape → armpit)", labelFr: "Profondeur d'emmanchure", group: "Torso", profiles: PRE, fitToleranceMm: 10, tshirt: true, plausibleMm: [130, 320],
    compute: (c) => vertical(c, "nape", "axilla_r", "Vertical: C7 to armpit (scye depth)") },
  { id: "front_length_hps", label: "Front length (HPS → waist, vertical)", labelFr: "Longueur devant", group: "Torso", profiles: PRE, fitToleranceMm: 12, tshirt: true, plausibleMm: [300, 650],
    compute: (c) => vertical(c, "hps_r", "waist_front", "Vertical: neck-shoulder point to front waist (tape over the bust reads longer)") },
  { id: "nape_to_floor", label: "Nape to floor", labelFr: "Nuque au sol", group: "Global", profiles: PRE, fitToleranceMm: 15, tshirt: false, plausibleMm: [1000, 1950], compute: (c) => heightAboveFloor(c, "nape", "C7 height above floor") },
  { id: "waist_to_hip", label: "Waist to hip (vertical)", labelFr: "Hauteur taille-hanches", group: "Torso", profiles: PRE, fitToleranceMm: 10, tshirt: false, plausibleMm: [80, 320],
    compute: (c) => (has(c, "waist_side_l", "waist_side_r", "hip_side_l", "hip_side_r") ? { valueMm: mToMm(midY(c, "waist_side_l", "waist_side_r") - midY(c, "hip_side_l", "hip_side_r")), uncertaintyMm: rss(pointUnc(c, "waist_side_l") / 1.4, pointUnc(c, "hip_side_l") / 1.4, SEQUENTIAL_MOTION_MM), method: "direct", sources: ["waist_side_l", "waist_side_r", "hip_side_l", "hip_side_r"], procedure: "Waist height minus hip height" } : null) },
  { id: "waist_to_knee", label: "Waist to knee", labelFr: "Taille au genou", group: "Legs", profiles: PRE, fitToleranceMm: 12, tshirt: false, plausibleMm: [380, 800],
    compute: (c) => (hasM(c, "waist_height", "knee_height") ? { valueMm: c.m.waist_height.value - c.m.knee_height.value, uncertaintyMm: rss(c.m.waist_height.uncertaintyMm, c.m.knee_height.uncertaintyMm), method: "derived", sources: ["waist_height", "knee_height"], procedure: "Waist height minus knee height" } : null) },
  { id: "high_hip_width", label: "High hip breadth", labelFr: "Largeur haute des hanches", group: "Torso", profiles: PRE, fitToleranceMm: 10, tshirt: false, plausibleMm: [220, 520], compute: (c) => breadth(c, "high_hip_side_l", "high_hip_side_r") },
  { id: "high_hip_depth", label: "High hip depth", labelFr: "Profondeur haute des hanches", group: "Torso", profiles: ULT, fitToleranceMm: 10, tshirt: false, plausibleMm: [140, 420], compute: (c) => depth(c, "high_hip_front", "high_hip_back") },
  { id: "high_hip_circumference", label: "High hip circumference", labelFr: "Tour haut des hanches", group: "Torso", profiles: PRE, fitToleranceMm: 20, tshirt: false, plausibleMm: [600, 1600], compute: (c) => girth(c, "high_hip", "high_hip_width", "high_hip_depth") },
  // ── ultra ──
  { id: "neck_base_depth", label: "Neck base depth (notch → C7)", labelFr: "Profondeur base du cou", group: "Head/neck", profiles: ULT, fitToleranceMm: 8, tshirt: true, plausibleMm: [70, 220], compute: (c) => depth(c, "neck_base_front", "nape_base") },
  { id: "neck_base_circumference", label: "Neck base circumference", labelFr: "Tour de base du cou", group: "Head/neck", profiles: PRE, fitToleranceMm: 15, tshirt: true, plausibleMm: [280, 650], compute: (c) => girth(c, "neck", "neck_base_width", "neck_base_depth") },
  { id: "apex_to_apex", label: "Bust point to bust point", labelFr: "Écart des pointes", group: "Torso", profiles: ULT, fitToleranceMm: 8, tshirt: false, plausibleMm: [120, 320], compute: (c) => between(c, "bust_point_l", "bust_point_r", "Simultaneous two-tip capture, straight line", false) },
  { id: "hps_to_apex", label: "Neck-shoulder point to bust point", labelFr: "Encolure à la pointe", group: "Torso", profiles: ULT, fitToleranceMm: 10, tshirt: false, plausibleMm: [150, 400], compute: (c) => between(c, "hps_r", "bust_point_r", "Straight line, separate captures") },
  { id: "underbust_width", label: "Underbust breadth", labelFr: "Largeur sous-poitrine", group: "Torso", profiles: ULT, fitToleranceMm: 10, tshirt: false, plausibleMm: [200, 480], compute: (c) => breadth(c, "underbust_side_l", "underbust_side_r") },
  { id: "underbust_depth", label: "Underbust depth", labelFr: "Profondeur sous-poitrine", group: "Torso", profiles: ULT, fitToleranceMm: 10, tshirt: false, plausibleMm: [140, 380], compute: (c) => depth(c, "underbust_front", "underbust_back") },
  { id: "underbust_circumference", label: "Underbust circumference", labelFr: "Tour sous-poitrine", group: "Torso", profiles: ULT, fitToleranceMm: 15, tshirt: false, plausibleMm: [550, 1400], compute: (c) => girth(c, "underbust", "underbust_width", "underbust_depth") },
  { id: "arm_length_left", label: "Arm length, left", labelFr: "Longueur de bras gauche", group: "Arms", profiles: ULT, fitToleranceMm: 15, tshirt: true, plausibleMm: [420, 750], compute: (c) => between(c, "arm_acromion_l", "wrist_l", "Sequential tip capture, left arm hanging, acromion to ulnar styloid") },
  { id: "upper_arm_length_left", label: "Upper arm, left", labelFr: "Bras supérieur gauche", group: "Arms", profiles: ULT, fitToleranceMm: 12, tshirt: true, plausibleMm: [230, 450], compute: (c) => between(c, "arm_acromion_l", "elbow_l", "Sequential tip capture, left arm hanging") },
  { id: "forearm_length_left", label: "Forearm, left", labelFr: "Avant-bras gauche", group: "Arms", profiles: ULT, fitToleranceMm: 12, tshirt: false, plausibleMm: [180, 360], compute: (c) => between(c, "elbow_l", "wrist_l", "Sequential tip capture, left arm hanging") },
  { id: "knee_height_left", label: "Knee height, left", labelFr: "Hauteur du genou gauche", group: "Legs", profiles: ULT, fitToleranceMm: 15, tshirt: false, plausibleMm: [350, 700], compute: (c) => heightAboveFloor(c, "knee_l", "Left knee joint line height above floor") },
  { id: "ankle_height_left", label: "Ankle height, left", labelFr: "Hauteur de cheville gauche", group: "Legs", profiles: ULT, fitToleranceMm: 10, tshirt: false, plausibleMm: [40, 140], compute: (c) => heightAboveFloor(c, "ankle_l", "Left lateral malleolus height above floor") },
  { id: "knee_width", label: "Knee breadth", labelFr: "Largeur du genou", group: "Legs", profiles: ULT, fitToleranceMm: 6, tshirt: false, plausibleMm: [70, 170], compute: (c) => breadth(c, "knee_in_r", "knee_out_r") },
  { id: "knee_depth", label: "Knee depth", labelFr: "Profondeur du genou", group: "Legs", profiles: ULT, fitToleranceMm: 6, tshirt: false, plausibleMm: [70, 170], compute: (c) => depth(c, "knee_front_r", "knee_back_r") },
  { id: "knee_circumference", label: "Knee circumference", labelFr: "Tour de genou", group: "Legs", profiles: ULT, fitToleranceMm: 10, tshirt: false, plausibleMm: [250, 600], compute: (c) => girth(c, "knee", "knee_width", "knee_depth") },
);

export const MEASUREMENT_BY_ID: Record<string, MeasurementDef> = Object.fromEntries(MEASUREMENTS.map((d) => [d.id, d]));
export const PROFILE_PRIMARY: Record<ProfileKind, string[]> = {
  simple: ["height", "shoulder_width", "chest_circumference", "waist_circumference", "hip_circumference", "arm_length"],
  intermediate: MEASUREMENTS.filter((m) => m.profiles.includes("intermediate")).map((m) => m.id),
  ultra: MEASUREMENTS.filter((m) => m.profiles.includes("ultra")).map((m) => m.id),
};

/** Confidence from uncertainty relative to the fit tolerance: tol²/(tol²+u²). */
export const confidenceFrom = (uMm: number, tolMm: number) => (tolMm * tolMm) / (tolMm * tolMm + uMm * uMm);
