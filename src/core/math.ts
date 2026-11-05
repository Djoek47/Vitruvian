// Pure vector math used by the measurement engine. No three.js dependency so the
// engine can be unit-tested headless and ported 1:1 to Unreal C++ (FVector).
// Units: metres in, metres out. Coordinate system: WebXR / OpenXR, right-handed,
// +Y up, -Z forward (the user's initial gaze direction in "local-floor").

export type Vec3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: Vec3): number => Math.sqrt(dot(a, a));
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));
export const mid = (a: Vec3, b: Vec3): Vec3 => lerp(a, b, 0.5);

/** Euclidean distance d = sqrt((x2-x1)^2 + (y2-y1)^2 + (z2-z1)^2). */
export const distance = (a: Vec3, b: Vec3): number => length(sub(b, a));

export const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  return l < 1e-12 ? v3(0, 0, 0) : scale(a, 1 / l);
};

/** Rotate a vector by a unit quaternion (q * v * q^-1). */
export function rotate(q: Quat, v: Vec3): Vec3 {
  const u = v3(q.x, q.y, q.z);
  const s = q.w;
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, s)), cross(u, t));
}

/** Forward (-Z) direction of an orientation. */
export const forwardOf = (q: Quat): Vec3 => rotate(q, v3(0, 0, -1));

/**
 * Body frame: origin on the floor below the user, axes derived from the headset's
 * horizontal gaze at calibration time. Widths are measured along `lateral`,
 * depths along `forward`, heights along `up`.
 */
export type BodyFrame = { origin: Vec3; forward: Vec3; lateral: Vec3; up: Vec3 };

export function bodyFrameFromHead(headPos: Vec3, headQuat: Quat, floorY: number): BodyFrame {
  const up = v3(0, 1, 0);
  const f = forwardOf(headQuat);
  let forward = normalize(v3(f.x, 0, f.z));
  if (length(forward) === 0) forward = v3(0, 0, -1); // looking straight up/down: fall back
  const lateral = normalize(cross(forward, up)); // user's right
  return { origin: v3(headPos.x, floorY, headPos.z), forward, lateral, up };
}

/** Express a world point in body-frame coordinates {x: right, y: up, z: forward}. */
export function toBody(frame: BodyFrame, p: Vec3): Vec3 {
  const d = sub(p, frame.origin);
  return v3(dot(d, frame.lateral), dot(d, frame.up), dot(d, frame.forward));
}

export const lateralSeparation = (f: BodyFrame, a: Vec3, b: Vec3) => Math.abs(dot(sub(b, a), f.lateral));
export const forwardSeparation = (f: BodyFrame, a: Vec3, b: Vec3) => Math.abs(dot(sub(b, a), f.forward));
export const verticalSeparation = (a: Vec3, b: Vec3) => Math.abs(b.y - a.y);

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;
}
export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export const medianVec = (ps: Vec3[]): Vec3 => v3(median(ps.map((p) => p.x)), median(ps.map((p) => p.y)), median(ps.map((p) => p.z)));
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
