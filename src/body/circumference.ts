/**
 * Circumference reconstruction.
 *
 * Two controller tips can only measure STRAIGHT-LINE distances. A circumference
 * is a path around the body, so it is never directly measured here. We measure
 * the cross-section's breadth (side-to-side) and depth (front-to-back) directly,
 * then model the cross-section as a superellipse
 *     |x/a|^n + |y/b|^n = 1,   a = breadth/2, b = depth/2
 * n = 2 is an ellipse (systematically too small for a human torso); n → ∞ is a
 * rectangle (too big). The exponent per body region is a calibratable model
 * parameter. The priors below are engineering starting points, NOT validated
 * values; `fitShapeExponent` re-estimates them from tape-measured participants
 * (see docs/VALIDATION.md). Results are therefore labelled DERIVED.
 */

export const SHAPE_PRIORS: Record<string, number> = {
  chest: 2.4,
  waist: 2.25,
  hip: 2.35,
  neck: 2.0,
  thigh: 2.1,
  calf: 2.0,
};

/** Perimeter of a superellipse by numeric integration over the first quadrant. */
export function superellipsePerimeter(breadth: number, depth: number, n: number, steps = 720): number {
  const a = breadth / 2;
  const b = depth / 2;
  if (a <= 0 || b <= 0) return 0;
  let per = 0;
  let px = a;
  let py = 0;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2);
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = a * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = b * Math.sign(s) * Math.abs(s) ** (2 / n);
    per += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return per * 4;
}

/** Ramanujan's approximation for an ellipse (used as an independent test oracle). */
export function ramanujanEllipse(breadth: number, depth: number): number {
  const a = breadth / 2;
  const b = depth / 2;
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

export type CircumferenceResult = { valueMm: number; uncertaintyMm: number; exponent: number };

/**
 * Circumference with propagated uncertainty: breadth and depth uncertainty via
 * numeric partial derivatives, plus a model term (relative) for the unknown true
 * cross-section shape. `modelRelUnc` should shrink once the exponent is fitted.
 */
export function circumferenceFromBreadthDepth(
  breadthMm: number,
  depthMm: number,
  uBreadthMm: number,
  uDepthMm: number,
  exponent: number,
  modelRelUnc = 0.03,
): CircumferenceResult {
  const P = superellipsePerimeter(breadthMm, depthMm, exponent);
  const h = 1;
  const dPdw = (superellipsePerimeter(breadthMm + h, depthMm, exponent) - P) / h;
  const dPdd = (superellipsePerimeter(breadthMm, depthMm + h, exponent) - P) / h;
  const u = Math.sqrt((dPdw * uBreadthMm) ** 2 + (dPdd * uDepthMm) ** 2 + (modelRelUnc * P) ** 2);
  return { valueMm: P, uncertaintyMm: u, exponent };
}

/**
 * Fit the shape exponent n that best reproduces tape-measured circumferences
 * from measured breadth/depth (least squares, golden-section search on n∈[1.6, 4]).
 */
export function fitShapeExponent(rows: { breadthMm: number; depthMm: number; tapeMm: number }[]): {
  exponent: number;
  rmseMm: number;
} {
  if (!rows.length) throw new Error("no rows");
  const err = (n: number) =>
    rows.reduce((s, r) => s + (superellipsePerimeter(r.breadthMm, r.depthMm, n, 360) - r.tapeMm) ** 2, 0);
  let lo = 1.6;
  let hi = 4;
  const g = (Math.sqrt(5) - 1) / 2;
  let c = hi - g * (hi - lo);
  let d = lo + g * (hi - lo);
  for (let i = 0; i < 60; i++) {
    if (err(c) < err(d)) hi = d;
    else lo = c;
    c = hi - g * (hi - lo);
    d = lo + g * (hi - lo);
  }
  const n = (lo + hi) / 2;
  return { exponent: n, rmseMm: Math.sqrt(err(n) / rows.length) };
}
