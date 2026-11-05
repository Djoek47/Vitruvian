import { mean, stddev } from "../core/math";

/** Error statistics for VR readings vs. a physical reference (tape / ruler). */
export type ErrorStats = { n: number; meanErrorMm: number; maeMm: number; rmseMm: number; sdMm: number; ci95Mm: [number, number] | null };

export function errorStats(pairs: { vrMm: number; refMm: number }[]): ErrorStats {
  const e = pairs.map((p) => p.vrMm - p.refMm);
  const n = e.length;
  const me = mean(e);
  const sd = stddev(e);
  // 95 % CI of the mean error (bias) — t-approximation, only when n ≥ 3.
  const t = n >= 30 ? 1.96 : [0, 0, 12.71, 4.3, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26][n] ?? 2.2;
  return {
    n,
    meanErrorMm: me,
    maeMm: mean(e.map(Math.abs)),
    rmseMm: Math.sqrt(mean(e.map((x) => x * x))),
    sdMm: sd,
    ci95Mm: n >= 3 ? [me - (t * sd) / Math.sqrt(n), me + (t * sd) / Math.sqrt(n)] : null,
  };
}

/** Repeatability: SD of repeated readings of the same quantity. */
export const repeatabilitySd = (readingsMm: number[]) => stddev(readingsMm);

/** Ruler test log (Test 001) — one row per captured reading. */
export type RulerReading = { timestamp: string; vrMm: number; refMm: number | null; orientation: string; spreadMm: number; tipCalibrated: boolean };

export function rulerLogCsv(rows: RulerReading[]): string {
  const head = "timestamp,vr_mm,reference_mm,error_mm,orientation,spread_mm,tip_calibrated";
  return [head, ...rows.map((r) => [r.timestamp, r.vrMm.toFixed(1), r.refMm ?? "", r.refMm == null ? "" : (r.vrMm - r.refMm).toFixed(1), r.orientation, r.spreadMm.toFixed(2), r.tipCalibrated].join(","))].join("\n") + "\n";
}
