import type { BodyFrame } from "../core/math";
import { confidenceFrom, MEASUREMENTS, MEASUREMENT_BY_ID, type ComputeCtx } from "./registry";
import type { Calibration, Landmark, Measurement } from "./types";

export type ManualEntry = { value: number; timestamp: string; note?: string };

export type EngineInput = {
  landmarks: Record<string, Landmark>;
  calibration: Calibration;
  manual: Record<string, ManualEntry>;
  locked: Record<string, Measurement>;
  shape: Record<string, number>;
  previous: Record<string, Measurement>;
  now: string;
};

/** Ratio sanity checks between measurements (broad limits to catch gross capture errors). */
export const RATIO_CHECKS: { a: string; b: string; min: number; max: number; why: string }[] = [
  { a: "arm_span", b: "height", min: 0.92, max: 1.12, why: "arm span vs height" },
  { a: "shoulder_width", b: "height", min: 0.17, max: 0.29, why: "shoulder width vs height" },
  { a: "chest_circumference", b: "chest_width", min: 2.4, max: 3.9, why: "chest circumference vs breadth" },
  { a: "arm_length", b: "height", min: 0.27, max: 0.41, why: "arm length vs height" },
  { a: "inseam", b: "height", min: 0.37, max: 0.53, why: "inseam vs height" },
  { a: "waist_height", b: "height", min: 0.50, max: 0.70, why: "waist height vs height" },
  { a: "hip_width", b: "waist_width", min: 0.85, max: 1.6, why: "hip vs waist breadth" },
];

export function computeAll(input: EngineInput): Record<string, Measurement> {
  const out: Record<string, Measurement> = {};
  const frame = input.calibration.bodyFrame as BodyFrame | null;
  if (!frame) {
    // Without a body frame only manual values exist.
    for (const [id, man] of Object.entries(input.manual)) out[id] = manualMeasurement(id, man, null, input);
    return out;
  }
  const ctx: ComputeCtx = { lm: input.landmarks, m: out, frame, cal: input.calibration, shape: input.shape };

  for (const def of MEASUREMENTS) {
    if (input.locked[def.id]) {
      out[def.id] = input.locked[def.id];
      continue;
    }
    const r = def.compute(ctx);
    const man = input.manual[def.id];
    if (man) {
      out[def.id] = manualMeasurement(def.id, man, r, input);
      continue;
    }
    if (!r || !Number.isFinite(r.valueMm)) continue;
    const prev = input.previous[def.id];
    const history = prev ? [...prev.history] : [];
    if (prev && Math.abs(prev.value - r.valueMm) > 0.05) history.push({ value: prev.value, method: prev.method, timestamp: prev.timestamp });
    out[def.id] = {
      id: def.id,
      value: r.valueMm,
      unit: "mm",
      method: r.method,
      confidence: confidenceFrom(r.uncertaintyMm, def.fitToleranceMm),
      uncertaintyMm: r.uncertaintyMm,
      ...(r.randomUncertaintyMm !== undefined ? { randomUncertaintyMm: r.randomUncertaintyMm } : {}),
      status: "unvalidated",
      timestamp: prev && Math.abs(prev.value - r.valueMm) <= 0.05 ? prev.timestamp : input.now,
      sources: r.sources,
      procedure: r.procedure,
      history,
    };
  }
  applyConflicts(out);
  return out;
}

function manualMeasurement(id: string, man: ManualEntry, computed: ReturnType<NonNullable<(typeof MEASUREMENT_BY_ID)[string]>["compute"]>, input: EngineInput): Measurement {
  const def = MEASUREMENT_BY_ID[id];
  const prev = input.previous[id];
  const history = prev ? [...prev.history] : [];
  if (prev && prev.value !== man.value) history.push({ value: prev.value, method: prev.method, timestamp: prev.timestamp });
  const m: Measurement = {
    id,
    value: man.value,
    unit: "mm",
    method: "manual",
    confidence: 1,
    uncertaintyMm: 0,
    status: "unvalidated",
    timestamp: man.timestamp,
    sources: ["user"],
    procedure: man.note ?? "Entered by user (overrides measurement)",
    history,
  };
  if (computed && def) {
    const limit = Math.max(3 * computed.uncertaintyMm, def.fitToleranceMm);
    if (Math.abs(man.value - computed.valueMm) > limit) {
      m.status = "conflicted";
      m.conflicts = [`Differs from ${computed.method} value ${(computed.valueMm / 10).toFixed(1)} cm by more than ${(limit / 10).toFixed(1)} cm`];
    }
  }
  return m;
}

function applyConflicts(out: Record<string, Measurement>) {
  for (const m of Object.values(out)) {
    const def = MEASUREMENT_BY_ID[m.id];
    if (def && (m.value < def.plausibleMm[0] || m.value > def.plausibleMm[1])) {
      flag(m, `Outside plausible range ${def.plausibleMm[0] / 10}–${def.plausibleMm[1] / 10} cm — re-measure`);
    }
  }
  for (const chk of RATIO_CHECKS) {
    const a = out[chk.a];
    const b = out[chk.b];
    if (!a || !b || !b.value) continue;
    const r = a.value / b.value;
    if (r < chk.min || r > chk.max) {
      const msg = `Inconsistent ${chk.why} (ratio ${r.toFixed(2)}, expected ${chk.min}–${chk.max})`;
      // Blame the lower-confidence side; manual values are trusted over measured.
      const target = a.method === "manual" ? b : b.method === "manual" ? a : a.confidence <= b.confidence ? a : b;
      flag(target, msg);
    }
  }
}

function flag(m: Measurement, msg: string) {
  m.status = "conflicted";
  m.conflicts = [...(m.conflicts ?? []), msg];
}
