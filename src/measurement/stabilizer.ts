import { length, medianVec, sub, type Vec3 } from "../core/math";

/**
 * Sliding-window stabiliser for one or more tracked points.
 *
 * A reading is STABLE when, over the last `windowMs`:
 *  - every frame had valid tracking for every point,
 *  - the window is full (enough samples),
 *  - each point's RMS deviation from its median is below `maxSpreadM`.
 *
 * Captured values use the per-axis median of the window, which rejects the
 * occasional tracking spike that a mean would smear into the result.
 */
export type StabilizerOptions = { windowMs: number; maxSpreadM: number; minSamples: number };

// Stability is defined in TIME (the window must cover ≥ 80 % of windowMs), with a
// small sample floor, so it behaves the same at 10 fps (emulator) and 120 fps (Quest 3).
export const DEFAULT_STABILIZER: StabilizerOptions = { windowMs: 600, maxSpreadM: 0.002, minSamples: 6 };

type Entry = { t: number; points: (Vec3 | null)[] };

export type StabilityReport = {
  stable: boolean;
  tracked: boolean;
  samples: number;
  spreadM: number[]; // per point RMS spread
  median: (Vec3 | null)[];
  reason: "ok" | "tracking-lost" | "filling" | "moving";
};

export class Stabilizer {
  private buf: Entry[] = [];
  constructor(private readonly n: number, private readonly opt: StabilizerOptions = DEFAULT_STABILIZER) {}

  reset() {
    this.buf = [];
  }

  push(t: number, points: (Vec3 | null)[]) {
    if (points.length !== this.n) throw new Error(`expected ${this.n} points`);
    this.buf.push({ t, points });
    const cutoff = t - this.opt.windowMs;
    while (this.buf.length && this.buf[0].t < cutoff) this.buf.shift();
  }

  report(): StabilityReport {
    const tracked = this.buf.length > 0 && this.buf.every((e) => e.points.every((p) => p !== null));
    const median: (Vec3 | null)[] = [];
    const spreadM: number[] = [];
    for (let i = 0; i < this.n; i++) {
      const ps = this.buf.map((e) => e.points[i]).filter((p): p is Vec3 => p !== null);
      if (!ps.length) {
        median.push(null);
        spreadM.push(Infinity);
        continue;
      }
      const m = medianVec(ps);
      median.push(m);
      const ms = ps.reduce((s, p) => s + length(sub(p, m)) ** 2, 0) / ps.length;
      spreadM.push(Math.sqrt(ms));
    }
    const samples = this.buf.length;
    let reason: StabilityReport["reason"] = "ok";
    if (!tracked) reason = "tracking-lost";
    else if (samples < this.opt.minSamples || this.buf[samples - 1].t - this.buf[0].t < 0.8 * this.opt.windowMs) reason = "filling";
    else if (spreadM.some((s) => s > this.opt.maxSpreadM)) reason = "moving";
    return { stable: reason === "ok", tracked, samples, spreadM, median, reason };
  }
}
