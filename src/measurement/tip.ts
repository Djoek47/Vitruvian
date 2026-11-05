import { add, dot, forwardOf, scale, sub, type Vec3 } from "../core/math";
import type { ControllerState } from "../tracking/types";

/**
 * The "measuring tip" of a controller: a point on the controller's aim ray,
 * `offsetM` metres in front of the aim-pose origin. The user touches the body
 * with this physical point. `offsetM` is solved by tip calibration (below).
 */
export function tipPoint(c: ControllerState | null, offsetM: number): Vec3 | null {
  if (!c?.aim || !c.aim.tracked) return null;
  return add(c.aim.position, scale(forwardOf(c.aim.orientation), offsetM));
}

export type TipSample = { leftOrigin: Vec3; leftDir: Vec3; rightOrigin: Vec3; rightDir: Vec3 };

export function tipSampleFrom(l: ControllerState | null, r: ControllerState | null): TipSample | null {
  if (!l?.aim?.tracked || !r?.aim?.tracked) return null;
  return {
    leftOrigin: l.aim.position,
    leftDir: forwardOf(l.aim.orientation),
    rightOrigin: r.aim.position,
    rightDir: forwardOf(r.aim.orientation),
  };
}

export type TipCalibration = { offsetM: number; residualRmsM: number; samples: number };

/**
 * Tip-to-tip calibration. The user touches the two controller tips together in
 * several different orientations. With the same physical tip on both controllers
 * (offset d along each aim ray), each touch satisfies
 *     (oL + d·rL) − (oR + d·rR) = 0  ⇒  Δo + d·Δr = 0
 * Least squares over all samples gives the closed form
 *     d = −Σ(Δo·Δr) / Σ|Δr|²
 * The RMS of the remaining gaps is the tip-placement + tracking error, which is
 * reported and fed into every measurement's uncertainty.
 *
 * Needs ≥3 samples with varied relative orientation; otherwise Σ|Δr|² ≈ 0 and
 * the offset is unobservable (we return null rather than a made-up value).
 */
export function solveTipOffset(samples: TipSample[]): TipCalibration | null {
  if (samples.length < 3) return null;
  let num = 0;
  let den = 0;
  for (const s of samples) {
    const dO = sub(s.leftOrigin, s.rightOrigin);
    const dR = sub(s.leftDir, s.rightDir);
    num += dot(dO, dR);
    den += dot(dR, dR);
  }
  if (den < 0.05 * samples.length) return null; // orientations too similar
  const d = -num / den;
  let sq = 0;
  for (const s of samples) {
    const gap = add(sub(s.leftOrigin, s.rightOrigin), scale(sub(s.leftDir, s.rightDir), d));
    sq += dot(gap, gap);
  }
  return { offsetM: d, residualRmsM: Math.sqrt(sq / samples.length), samples: samples.length };
}
