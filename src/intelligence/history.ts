import { MEASUREMENT_BY_ID } from "../measurement/registry";
import type { BodyPassport } from "../passport/passport";
import type { Measurement } from "../measurement/types";

/**
 * BODY HISTORY & CHANGE DETECTION ENGINE (engine `bi-change@1`)
 *
 * A BodySnapshot is an immutable saved Body Passport version. Snapshots are
 * never edited: a new session or a correction creates a new version.
 *
 * A change between two snapshots is only called MEANINGFUL when it exceeds the
 * combined uncertainty of the change:
 *     u_Δ = √(u_A² + u_B² + b²)
 * u_A, u_B: each measurement's RANDOM uncertainty (from the engine; tape/manual
 * values use 5 mm). For derived girths the shape-model error is systematic —
 * the same model is applied to both snapshots — so it cancels in Δ and is excluded. b: day-to-day BIOLOGICAL variation of that dimension
 * (posture, breathing, hydration, meals, time of day). b values are literature
 * order-of-magnitude priors, to be replaced by each user's measured repeatability.
 *   z = |Δ| / u_Δ
 *   z ≥ 3.0                  → significant (also with only two snapshots)
 *   2.0 ≤ z < 3.0            → significant only if confirmed by a third snapshot / trend, else "possible"
 *   z < 2.0                  → within noise ("stable")
 * Trends use weighted least squares (weights 1/u²) and need ≥ 3 snapshots.
 */
export const CHANGE_ENGINE = "bi-change@1";
export const MANUAL_UNC_MM = 5;

/** Day-to-day biological variation (mm; kg for weight). Priors, not validated. */
export const BIO_VARIATION: Record<string, number> = {
  height: 8, eye_height: 8, shoulder_height: 8, waist_height: 8, // spinal compression through the day
  waist_circumference: 15, waist_width: 6, waist_depth: 8, // meals, breathing
  chest_circumference: 10, chest_width: 5, chest_depth: 6, // breathing
  hip_circumference: 8, hip_width: 4, hip_depth: 5,
  neck_circumference: 5, thigh_circumference: 8, calf_circumference: 5,
  upper_arm_circumference: 5, forearm_circumference: 4, wrist_circumference: 3,
  weight: 0.8,
};
const DEFAULT_BIO = 4;

export const REGION_OF: Record<string, string> = {
  height: "overall", eye_height: "overall", arm_span: "arms",
  neck_width: "neck", neck_depth: "neck", neck_circumference: "neck",
  shoulder_width: "shoulders", shoulder_height: "shoulders",
  chest_width: "chest", chest_depth: "chest", chest_circumference: "chest",
  waist_width: "waist", waist_depth: "waist", waist_circumference: "waist", waist_height: "waist", front_waist_length: "waist", back_length: "waist",
  hip_width: "hips", hip_depth: "hips", hip_circumference: "hips", rise: "hips",
  arm_length: "arms", upper_arm_length: "upper arms", forearm_length: "forearms",
  upper_arm_circumference: "upper arms", forearm_circumference: "forearms", wrist_circumference: "forearms",
  thigh_width: "thighs", thigh_depth: "thighs", thigh_circumference: "thighs", inseam: "thighs", outseam: "thighs",
  calf_width: "calves", calf_depth: "calves", calf_circumference: "calves", knee_height: "calves", ankle_height: "calves", foot_length: "feet",
  weight: "overall",
};

export type Significance = "significant" | "possible" | "stable";

export type BodyChangeEvent = {
  measurementId: string;
  label: string;
  region: string;
  unit: "mm" | "kg";
  from: { snapshotId: number | string; at: string; value: number; uncertainty: number; method: string };
  to: { snapshotId: number | string; at: string; value: number; uncertainty: number; method: string };
  delta: number;
  pct: number;
  perWeek: number | null;
  perMonth: number | null;
  uDelta: number;
  z: number;
  /** P(change is not noise) under a normal model: 2Φ(z) − 1. */
  confidence: number;
  significance: Significance;
  direction: "increase" | "decrease" | "stable";
  confirmedByTrend: boolean;
  notes: string[];
};

export type Snapshot = { snapshotId: number | string; passport: BodyPassport };

const phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x: number) {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

/** Uncertainty relevant to a CHANGE: the random part (systematic model error is shared by both snapshots and cancels). */
const unc = (m: Measurement) => (m.method === "manual" ? MANUAL_UNC_MM : m.randomUncertaintyMm ?? m.uncertaintyMm);
const DAY = 86400000;

/** Measurements of a snapshot, plus weight (kg) as a pseudo-measurement when entered. */
export function valuesOf(p: BodyPassport): Record<string, { value: number; uncertainty: number; method: string; unit: "mm" | "kg" }> {
  const out: Record<string, { value: number; uncertainty: number; method: string; unit: "mm" | "kg" }> = {};
  for (const m of p.measurements) out[m.id] = { value: m.value, uncertainty: unc(m), method: m.method, unit: "mm" };
  if (p.subject?.weightKg) out.weight = { value: p.subject.weightKg, uncertainty: 0.2, method: "manual", unit: "kg" };
  return out;
}

/** Protocol consistency between two snapshots (posture / calibration / hardware). */
export function protocolNotes(a: BodyPassport, b: BodyPassport): string[] {
  const n: string[] = [];
  if (a.hardware.simulated || b.hardware.simulated) n.push("One of the snapshots is SIMULATED data — not a real comparison.");
  if (a.calibration.tipCalibrated !== b.calibration.tipCalibrated) n.push("Tip calibration differs between sessions; small systematic offsets are possible.");
  if (a.profile !== b.profile) n.push(`Different protocols (${a.profile} vs ${b.profile}); compare only measurements present in both.`);
  const ha = new Date(a.updatedAt).getUTCHours();
  const hb = new Date(b.updatedAt).getUTCHours();
  if (Math.abs(ha - hb) >= 5) n.push("Sessions were at different times of day: height and waist vary naturally through the day — measure at a consistent time.");
  return n;
}

export function compareSnapshots(a: Snapshot, b: Snapshot, history: Snapshot[] = []): BodyChangeEvent[] {
  const [older, newer] = new Date(a.passport.updatedAt) <= new Date(b.passport.updatedAt) ? [a, b] : [b, a];
  const va = valuesOf(older.passport);
  const vb = valuesOf(newer.passport);
  const weeks = (new Date(newer.passport.updatedAt).getTime() - new Date(older.passport.updatedAt).getTime()) / (7 * DAY);
  const events: BodyChangeEvent[] = [];
  for (const id of Object.keys(vb)) {
    const A = va[id];
    const B = vb[id];
    if (!A) continue;
    const bio = BIO_VARIATION[id] ?? DEFAULT_BIO;
    const uDelta = Math.sqrt(A.uncertainty ** 2 + B.uncertainty ** 2 + bio ** 2);
    const delta = B.value - A.value;
    const z = uDelta > 0 ? Math.abs(delta) / uDelta : 0;
    const tr = history.length >= 3 ? trend(history, id) : null;
    const confirmedByTrend = !!tr && tr.significant && Math.sign(tr.slopePerWeek) === Math.sign(delta);
    let significance: Significance = z >= 3 ? "significant" : z >= 2 ? (confirmedByTrend ? "significant" : "possible") : "stable";
    const notes: string[] = [];
    if (significance === "possible") notes.push("Possible change — confirm with another scan before acting on it.");
    if (A.method === "derived" || B.method === "derived") notes.push("Derived value (model-based); the change carries the model uncertainty.");
    if (A.method !== B.method) notes.push(`Method changed (${A.method} → ${B.method}).`);
    if (significance === "stable") notes.push("Within measurement + day-to-day variation.");
    events.push({
      measurementId: id,
      label: id === "weight" ? "Weight" : MEASUREMENT_BY_ID[id]?.label ?? id,
      region: REGION_OF[id] ?? "other",
      unit: B.unit,
      from: { snapshotId: older.snapshotId, at: older.passport.updatedAt, value: A.value, uncertainty: A.uncertainty, method: A.method },
      to: { snapshotId: newer.snapshotId, at: newer.passport.updatedAt, value: B.value, uncertainty: B.uncertainty, method: B.method },
      delta,
      pct: A.value ? (delta / A.value) * 100 : 0,
      perWeek: weeks > 0.14 ? delta / weeks : null,
      perMonth: weeks > 0.14 ? (delta / weeks) * (30.44 / 7) : null,
      uDelta,
      z,
      confidence: 2 * phi(z) - 1,
      significance,
      direction: significance === "stable" ? "stable" : delta > 0 ? "increase" : "decrease",
      confirmedByTrend,
      notes,
    });
  }
  return events.sort((x, y) => y.z - x.z);
}

export type Trend = { n: number; slopePerWeek: number; seSlope: number; significant: boolean; interceptAt0: number; t0: number };

/** Weighted least squares trend of a measurement across snapshots (≥ 3 points). */
export function trend(snaps: Snapshot[], id: string): Trend | null {
  const pts = snaps
    .map((s) => ({ t: new Date(s.passport.updatedAt).getTime(), v: valuesOf(s.passport)[id] }))
    .filter((p) => p.v)
    .map((p) => ({ x: p.t, y: p.v!.value, w: 1 / Math.max(1e-6, p.v!.uncertainty ** 2 + (BIO_VARIATION[id] ?? DEFAULT_BIO) ** 2) }));
  if (pts.length < 3) return null;
  const t0 = pts[0].x;
  const X = pts.map((p) => (p.x - t0) / (7 * DAY));
  const W = pts.reduce((a, p) => a + p.w, 0);
  const xm = pts.reduce((a, p, i) => a + p.w * X[i], 0) / W;
  const ym = pts.reduce((a, p) => a + p.w * p.y, 0) / W;
  const sxx = pts.reduce((a, p, i) => a + p.w * (X[i] - xm) ** 2, 0);
  if (sxx <= 0) return null;
  const sxy = pts.reduce((a, p, i) => a + p.w * (X[i] - xm) * (p.y - ym), 0);
  const slope = sxy / sxx;
  const se = Math.sqrt(1 / sxx);
  return { n: pts.length, slopePerWeek: slope, seSlope: se, significant: Math.abs(slope) > 2 * se, interceptAt0: ym - slope * xm, t0 };
}

/** Time series for a measurement (scans + optional check-ins). */
export function series(snaps: Snapshot[], id: string, checkins: { date: string; tape?: Record<string, number>; weightKg?: number }[] = []) {
  const pts: { at: string; value: number; uncertainty: number; kind: "scan" | "check-in"; method: string; snapshotId?: number | string }[] = [];
  for (const s of snaps) {
    const v = valuesOf(s.passport)[id];
    if (v) pts.push({ at: s.passport.updatedAt, value: v.value, uncertainty: v.uncertainty, kind: "scan", method: v.method, snapshotId: s.snapshotId });
  }
  for (const c of checkins) {
    const v = id === "weight" ? c.weightKg : c.tape?.[id];
    if (v) pts.push({ at: c.date, value: v, uncertainty: id === "weight" ? 0.2 : MANUAL_UNC_MM, kind: "check-in", method: "manual" });
  }
  return pts.sort((a, b) => a.at.localeCompare(b.at));
}

/** Geometric proportions — comparisons of shape, NOT medical or fitness diagnoses. */
export function proportions(p: BodyPassport) {
  const v = Object.fromEntries(p.measurements.map((m) => [m.id, m.value]));
  const lm = Object.fromEntries(p.landmarks.map((l) => [l.id, l]));
  const r = (a?: number, b?: number) => (a && b ? a / b : null);
  return {
    shoulderToWaistBreadth: r(v.shoulder_width, v.waist_width),
    chestToWaistCirc: r(v.chest_circumference, v.waist_circumference),
    waistToHipCirc: r(v.waist_circumference, v.hip_circumference),
    hipToWaistCirc: r(v.hip_circumference, v.waist_circumference),
    armSpanToHeight: r(v.arm_span, v.height),
    upperArmToForearm: r(v.upper_arm_length, v.forearm_length),
    legToHeight: r(v.inseam, v.height),
    /** Left − right shoulder height (mm, from the simultaneous acromion capture): + = left higher. */
    shoulderLevelMm: lm.acromion_l && lm.acromion_r ? (lm.acromion_l.body.y - lm.acromion_r.body.y) * 1000 : null,
    /** Lateral offset of the waist midpoint from the body centreline (mm): + = shifted right. */
    waistCentreOffsetMm: lm.waist_side_l && lm.waist_side_r ? ((lm.waist_side_l.body.x + lm.waist_side_r.body.x) / 2) * 1000 : null,
  };
}

export type ChangeReport = { engine: string; generatedFrom: { from: number | string; to: number | string }; protocol: string[]; events: BodyChangeEvent[]; byRegion: Record<string, { increase: number; decrease: number; stable: number }>; text: string };

/** Reproducible change report: only stored snapshot data + engine version. */
export function changeReport(a: Snapshot, b: Snapshot, history: Snapshot[] = []): ChangeReport {
  const events = compareSnapshots(a, b, history);
  const [older, newer] = new Date(a.passport.updatedAt) <= new Date(b.passport.updatedAt) ? [a, b] : [b, a];
  const byRegion: ChangeReport["byRegion"] = {};
  for (const e of events) {
    byRegion[e.region] ??= { increase: 0, decrease: 0, stable: 0 };
    byRegion[e.region][e.direction === "stable" ? "stable" : e.direction]++;
  }
  const fmt = (e: BodyChangeEvent, v: number) => (e.unit === "kg" ? `${v.toFixed(1)} kg` : `${(v / 10).toFixed(1)} cm`);
  const lines = [
    `# Body change report`,
    `From ${older.passport.updatedAt.slice(0, 10)} (snapshot ${older.snapshotId}) to ${newer.passport.updatedAt.slice(0, 10)} (snapshot ${newer.snapshotId}) · engine ${CHANGE_ENGINE}`,
    "",
    ...protocolNotes(older.passport, newer.passport).map((n) => `> ${n}`),
    "",
    "| Measurement | Previous | Current | Change | % | ± (95 %) | Assessment |",
    "|---|---|---|---|---|---|---|",
    ...events.map((e) => `| ${e.label} | ${fmt(e, e.from.value)} | ${fmt(e, e.to.value)} | ${e.delta >= 0 ? "+" : ""}${fmt(e, e.delta)} | ${e.pct >= 0 ? "+" : ""}${e.pct.toFixed(2)} % | ${fmt(e, 1.96 * e.uDelta)} | ${e.significance}${e.confirmedByTrend ? " (trend-confirmed)" : ""} |`),
    "",
    "Changes are flagged only when they exceed measurement uncertainty plus normal day-to-day variation. Proportions are geometric comparisons, not health assessments.",
  ];
  return { engine: CHANGE_ENGINE, generatedFrom: { from: older.snapshotId, to: newer.snapshotId }, protocol: protocolNotes(older.passport, newer.passport), events, byRegion, text: lines.join("\n") + "\n" };
}
