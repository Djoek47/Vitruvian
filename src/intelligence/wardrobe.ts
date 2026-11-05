import type { BodyPassport } from "../passport/passport";
import { MANUAL_UNC_MM } from "./history";

/**
 * CLOTHING FIT INTELLIGENCE (engine `bi-fit@1`)
 *
 * Datasets stay separate: BODY (passport) · GARMENT (its own measurements) ·
 * EASE = garment − body (per area, in the garment's measurement direction).
 *
 * The correct ease depends on category, construction, fabric stretch and fit
 * intention, so every area has an ease RANGE per (category, fit intent), and
 * stretch fabrics extend the lower bound (usable stretch ≈ half the stated
 * stretch). The ranges below are apparel-practice starting points, NOT
 * validated: tune them with try-on feedback (FitFeedback) and Marvelous
 * Designer simulations, the preferred detailed validation method.
 */
export const FIT_ENGINE = "bi-fit@1";

export type GarmentCategory = "tshirt" | "shirt" | "hoodie" | "jacket" | "trousers" | "jeans" | "shorts" | "skirt" | "dress";
export type FitIntent = "compression" | "slim" | "regular" | "relaxed" | "oversized";
export type GarmentMeasureId = "chest" | "waist" | "hip" | "shoulder" | "sleeve" | "body_length" | "inseam" | "rise" | "thigh" | "neck" | "upper_arm";

export type GarmentMeasurement = { id: GarmentMeasureId; valueMm: number; method: "flat-x2" | "circumference" | "md-simulation" | "supplier-chart" | "tape-on-garment" };
export type Garment = {
  garmentId: string;
  brand: string;
  name: string;
  category: GarmentCategory;
  size: string;
  measurements: GarmentMeasurement[];
  fabric?: { type?: string; stretchPct?: number };
  fitIntent: FitIntent;
  mdProject?: string;
  productUrl?: string;
};
export type FitFeedback = { at: string; verdict: "too-tight" | "good" | "too-loose"; area?: string; comment?: string; snapshotId?: number | string };
export type WardrobeItem = { itemId: string; garment: Garment; addedAt: string; purchaseDate?: string; feedback: FitFeedback[]; notes?: string };

export type FitStatus = "fits-comfortably" | "becoming-tight" | "may-no-longer-fit" | "too-loose" | "may-fit-after-change" | "needs-info" | "undetermined";
export type AreaAssessment = {
  area: GarmentMeasureId;
  bodyId: string;
  bodyMm: number | null;
  bodyUncMm: number;
  garmentMm: number;
  easeMm: number | null;
  targetMm: [number, number];
  effectiveMinMm: number;
  status: FitStatus;
  /** Body change needed (mm) to move into the target range (− = body must get smaller). */
  requiredBodyChangeMm: number | null;
  explanation: string;
};
export type FitAssessment = { engine: string; itemId: string; snapshotId: number | string | null; at: string; overall: FitStatus; areas: AreaAssessment[]; explanation: string[]; requiresMore: string[] };

type Rule = { area: GarmentMeasureId; body: string; ease: Record<FitIntent, [number, number]>; critical: boolean };

const TOP_CHEST: Record<FitIntent, [number, number]> = { compression: [-120, -20], slim: [20, 60], regular: [60, 120], relaxed: [120, 220], oversized: [220, 400] };
const TOP_WAIST: Record<FitIntent, [number, number]> = { compression: [-120, -20], slim: [20, 80], regular: [60, 160], relaxed: [120, 260], oversized: [220, 450] };
const SHOULDER: Record<FitIntent, [number, number]> = { compression: [-30, 10], slim: [-10, 25], regular: [0, 40], relaxed: [20, 80], oversized: [60, 180] };
const BOT_WAIST: Record<FitIntent, [number, number]> = { compression: [-80, -10], slim: [-10, 15], regular: [0, 25], relaxed: [10, 40], oversized: [20, 80] };
const BOT_HIP: Record<FitIntent, [number, number]> = { compression: [-120, -20], slim: [10, 40], regular: [30, 70], relaxed: [60, 120], oversized: [100, 200] };
const THIGH: Record<FitIntent, [number, number]> = { compression: [-80, -10], slim: [10, 40], regular: [30, 70], relaxed: [60, 120], oversized: [100, 180] };

const TOP: Rule[] = [
  { area: "chest", body: "chest_circumference", ease: TOP_CHEST, critical: true },
  { area: "waist", body: "waist_circumference", ease: TOP_WAIST, critical: false },
  { area: "shoulder", body: "shoulder_width", ease: SHOULDER, critical: true },
];
const BOTTOM: Rule[] = [
  { area: "waist", body: "waist_circumference", ease: BOT_WAIST, critical: true },
  { area: "hip", body: "hip_circumference", ease: BOT_HIP, critical: true },
  { area: "thigh", body: "thigh_circumference", ease: THIGH, critical: false },
];
export const CATEGORY_RULES: Record<GarmentCategory, Rule[]> = {
  tshirt: TOP, shirt: TOP, hoodie: TOP, jacket: TOP, dress: [...TOP.slice(0, 2), BOTTOM[1]],
  trousers: BOTTOM, jeans: BOTTOM, shorts: BOTTOM, skirt: BOTTOM.slice(0, 2),
};
/** Measurements that matter for each category (for "requires more information"). */
export const CATEGORY_FIELDS: Record<GarmentCategory, GarmentMeasureId[]> = {
  tshirt: ["chest", "waist", "shoulder", "sleeve", "body_length"], shirt: ["chest", "waist", "shoulder", "sleeve", "body_length", "neck"], hoodie: ["chest", "waist", "shoulder", "sleeve", "body_length"],
  jacket: ["chest", "waist", "shoulder", "sleeve", "body_length"], dress: ["chest", "waist", "hip", "shoulder", "body_length"],
  trousers: ["waist", "hip", "thigh", "inseam", "rise"], jeans: ["waist", "hip", "thigh", "inseam", "rise"], shorts: ["waist", "hip", "thigh", "rise"], skirt: ["waist", "hip", "body_length"],
};

const bodyVal = (p: BodyPassport, id: string) => {
  const m = p.measurements.find((x) => x.id === id);
  return m ? { v: m.value, u: m.method === "manual" ? MANUAL_UNC_MM : m.uncertaintyMm, conflicted: m.status === "conflicted" } : null;
};
const cm = (mm: number) => `${(mm / 10).toFixed(1)} cm`;

/** Personal comfortable ease learned from "good" feedback (per area), if any. */
function learnedEase(item: WardrobeItem, area: GarmentMeasureId, history: Map<string | number, BodyPassport>): number | null {
  const good = item.feedback.filter((f) => f.verdict === "good" && f.snapshotId !== undefined && history.has(f.snapshotId!));
  if (!good.length) return null;
  const rule = CATEGORY_RULES[item.garment.category].find((r) => r.area === area);
  const g = item.garment.measurements.find((m) => m.id === area);
  if (!rule || !g) return null;
  const vals = good.map((f) => bodyVal(history.get(f.snapshotId!)!, rule.body)?.v).filter((v): v is number => v !== undefined);
  return vals.length ? g.valueMm - vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function assessGarment(item: WardrobeItem, p: BodyPassport, opts: { snapshotId?: number | string; previous?: BodyPassport; trendMmPerWeek?: Record<string, number>; history?: Map<string | number, BodyPassport> } = {}): FitAssessment {
  const g = item.garment;
  const rules = CATEGORY_RULES[g.category];
  const stretch = Math.max(0, g.fabric?.stretchPct ?? 0) / 100;
  const areas: AreaAssessment[] = [];
  const requiresMore: string[] = [];
  for (const f of CATEGORY_FIELDS[g.category]) if (!g.measurements.some((m) => m.id === f)) requiresMore.push(`garment ${f.replace("_", " ")}`);
  for (const r of rules) {
    const gm = g.measurements.find((m) => m.id === r.area);
    if (!gm) continue;
    const b = bodyVal(p, r.body);
    const target = r.ease[g.fitIntent];
    const effMin = target[0] - stretch * gm.valueMm * 0.5;
    if (!b) {
      requiresMore.push(`body ${r.body.replace(/_/g, " ")}`);
      areas.push({ area: r.area, bodyId: r.body, bodyMm: null, bodyUncMm: 0, garmentMm: gm.valueMm, easeMm: null, targetMm: target, effectiveMinMm: effMin, status: "needs-info", requiredBodyChangeMm: null, explanation: `${r.area}: body ${r.body.replace(/_/g, " ")} not measured yet.` });
      continue;
    }
    const ease = gm.valueMm - b.v;
    const u = b.u;
    let status: FitStatus;
    let req: number | null = null;
    let why: string;
    if (ease + u < effMin) {
      status = "may-no-longer-fit";
      req = ease - effMin; // negative: body must shrink by |req|
      why = `${r.area}: ease ${cm(ease)} is below the ${g.fitIntent} minimum ${cm(effMin)}${stretch ? " (incl. fabric stretch)" : ""}.`;
    } else if (ease - u > target[1]) {
      status = "too-loose";
      req = ease - target[1];
      why = `${r.area}: ease ${cm(ease)} exceeds the ${g.fitIntent} maximum ${cm(target[1])}.`;
    } else if (ease - u < effMin || ease + u > target[1]) {
      status = "undetermined";
      why = `${r.area}: ease ${cm(ease)} is within measurement uncertainty (±${cm(u)}) of the ${g.fitIntent} limits — try it on to confirm.`;
    } else {
      status = "fits-comfortably";
      why = `${r.area}: ease ${cm(ease)} is inside the ${g.fitIntent} range ${cm(effMin)} – ${cm(target[1])}.`;
    }
    // trend toward tightness
    const prev = opts.previous ? bodyVal(opts.previous, r.body) : null;
    if (prev && status === "fits-comfortably") {
      const prevEase = gm.valueMm - prev.v;
      const lowQuarter = effMin + 0.25 * (target[1] - effMin);
      if (prevEase - ease > Math.sqrt(u * u + prev.u * prev.u) * 2 && ease < lowQuarter) {
        status = "becoming-tight";
        why = `${r.area}: available ease fell from ${cm(prevEase)} to ${cm(ease)} — now in the tight end of the range. Fit should be reassessed.`;
      }
    }
    const learned = opts.history ? learnedEase(item, r.area, opts.history) : null;
    if (learned !== null && status === "fits-comfortably" && ease < learned - 2 * u) why += ` Tighter than when you rated it a good fit (ease then ${cm(learned)}).`;
    // could fit after further change, if the measured trend continues (not a prediction)
    const tr = opts.trendMmPerWeek?.[r.body];
    if ((status === "may-no-longer-fit" || status === "too-loose") && req !== null && tr && Math.sign(tr) === Math.sign(req) && Math.abs(tr) > 0) {
      const weeks = Math.abs(req / tr);
      if (weeks < 104) {
        why += ` If your current measured trend (${tr > 0 ? "+" : ""}${(tr / 10).toFixed(2)} cm/week) continued, it would reach the range in ~${Math.ceil(weeks)} weeks — this is not a prediction.`;
        status = "may-fit-after-change";
      }
    }
    if (b.conflicted) why += " Body value is flagged conflicted — re-measure first.";
    areas.push({ area: r.area, bodyId: r.body, bodyMm: b.v, bodyUncMm: u, garmentMm: gm.valueMm, easeMm: ease, targetMm: target, effectiveMinMm: effMin, status, requiredBodyChangeMm: req, explanation: why });
  }
  const order: FitStatus[] = ["may-no-longer-fit", "becoming-tight", "too-loose", "may-fit-after-change", "undetermined", "needs-info", "fits-comfortably"];
  const crit = areas.filter((a) => rules.find((r) => r.area === a.area)?.critical);
  const pick = (list: AreaAssessment[]) => order.find((o) => list.some((a) => a.status === o));
  let overall: FitStatus = (pick(crit) ?? pick(areas) ?? "needs-info") as FitStatus;
  if (!areas.some((a) => a.easeMm !== null)) overall = "needs-info";
  const explanation = areas.map((a) => a.explanation);
  if (requiresMore.length) explanation.push(`More information would improve this assessment: ${requiresMore.join(", ")}.`);
  explanation.push("Circumference ease alone cannot guarantee fit: construction, sleeve opening, pattern and fabric also matter. Marvelous Designer simulation on your avatar is the detailed check.");
  return { engine: FIT_ENGINE, itemId: item.itemId, snapshotId: opts.snapshotId ?? null, at: p.updatedAt, overall, areas, explanation, requiresMore };
}

export const STATUS_LABEL: Record<FitStatus, string> = {
  "fits-comfortably": "Fits comfortably", "becoming-tight": "Becoming tight", "may-no-longer-fit": "May no longer fit", "too-loose": "Currently too loose",
  "may-fit-after-change": "May fit after a body change", "needs-info": "Requires additional information", undetermined: "Fit cannot be determined reliably",
};

/** Rank a product's sizes for this body (garment-specific; not generic S/M/L). */
export function recommendSizes(sizes: Garment[], p: BodyPassport) {
  return sizes
    .map((g) => {
      const a = assessGarment({ itemId: g.garmentId, garment: g, addedAt: "", feedback: [] }, p);
      const score = a.areas.reduce((s, x) => {
        if (x.easeMm === null) return s + 50;
        const mid = (x.effectiveMinMm + x.targetMm[1]) / 2;
        const half = (x.targetMm[1] - x.effectiveMinMm) / 2;
        return s + Math.abs(x.easeMm - mid) / Math.max(1, half);
      }, 0) / Math.max(1, a.areas.length);
      return { size: g.size, garment: g, assessment: a, score };
    })
    .sort((a, b) => a.score - b.score);
}

/** "Which of my clothes…?" helpers. */
export const questions = {
  noLongerFit: (a: FitAssessment[]) => a.filter((x) => x.overall === "may-no-longer-fit"),
  becomingTight: (a: FitAssessment[]) => a.filter((x) => x.overall === "becoming-tight"),
  couldFitAfterChange: (a: FitAssessment[]) => a.filter((x) => x.overall === "may-fit-after-change" || x.overall === "too-loose" || x.overall === "may-no-longer-fit"),
  tryOnAgain: (a: FitAssessment[]) => a.filter((x) => x.overall === "becoming-tight" || x.overall === "undetermined" || x.overall === "may-fit-after-change"),
};
