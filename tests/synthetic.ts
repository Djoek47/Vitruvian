// Synthetic test subject: known ground-truth landmarks placed in a rotated,
// offset world frame with a non-zero floor, to prove the engine recovers the
// true dimensions regardless of where the user stands or faces. TEST-ONLY.
import { add, cross, dot, length, normalize, rotate, scale, v3, type Quat, type Vec3 } from "../src/core/math";
import type { CaptureStep } from "../src/measurement/procedures";
import type { ControllerState, TrackingFrame } from "../src/tracking/types";

export function quatFromTo(from: Vec3, to: Vec3): Quat {
  const f = normalize(from);
  const t = normalize(to);
  const d = dot(f, t);
  if (d < -0.999999) return { x: 0, y: 1, z: 0, w: 0 };
  const c = cross(f, t);
  const q = { x: c.x, y: c.y, z: c.z, w: 1 + d };
  const l = Math.hypot(q.x, q.y, q.z, q.w);
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
}
const yawQ = (deg: number): Quat => ({ x: 0, y: Math.sin((deg * Math.PI) / 360), z: 0, w: Math.cos((deg * Math.PI) / 360) });

export class SyntheticBody {
  height = 1.78; shoulder = 0.4; chestB = 0.32; chestD = 0.24; arm = 0.58; inseam = 0.82;
  tipOffset = 0.035; floorY = 0.012; yawDeg = 35; origin = v3(0.6, 0, -0.3);
  /** Per-landmark body-frame offsets (m) to simulate a changed body in later snapshots. */
  offsets: Record<string, [number, number, number]> = {};
  get q() { return yawQ(this.yawDeg); }
  get forward() { return rotate(this.q, v3(0, 0, -1)); }
  get lateral() { return normalize(cross(this.forward, v3(0, 1, 0))); }
  /** body coords (x right, y up from floor, z forward) → world */
  w(x: number, y: number, z: number): Vec3 {
    return add(add(add(v3(this.origin.x, this.floorY, this.origin.z), scale(this.lateral, x)), v3(0, y, 0)), scale(this.forward, z));
  }
  landmark(id: string): Vec3 {
    const b = this;
    const armDir = v3(Math.sin((5 * Math.PI) / 180), -Math.cos((5 * Math.PI) / 180), 0);
    const tbl: Record<string, [number, number, number]> = {
      floor: [0.25, 0, 0.1],
      top_of_head: [0, b.height, 0],
      acromion_l: [-b.shoulder / 2, 1.46, 0], acromion_r: [b.shoulder / 2, 1.46, 0],
      chest_side_l: [-b.chestB / 2, 1.28, 0], chest_side_r: [b.chestB / 2, 1.28, 0.004],
      chest_front: [0.01, 1.28, b.chestD / 2], chest_back: [0, 1.29, -b.chestD / 2],
      waist_side_l: [-0.145, 1.08, 0], waist_side_r: [0.145, 1.08, 0],
      waist_front: [0, 1.08, 0.11], waist_back: [0, 1.08, -0.11],
      hip_side_l: [-0.175, 0.92, 0], hip_side_r: [0.175, 0.92, 0],
      hip_front: [0, 0.92, 0.12], hip_back: [0, 0.92, -0.13],
      arm_acromion_r: [b.shoulder / 2, 1.46, 0],
      wrist_r: [b.shoulder / 2 + armDir.x * b.arm, 1.46 + armDir.y * b.arm, 0],
      neck_side_l: [-0.055, 1.56, 0], neck_side_r: [0.055, 1.56, 0],
      neck_front: [0, 1.53, 0.06], nape: [0, 1.52, -0.06],
      crotch: [0, b.inseam, 0], knee_r: [0.1, 0.5, 0],
      hand_l: [-0.79, 1.45, 0], hand_r: [0.79, 1.45, 0],
      elbow_r: [b.shoulder / 2 + armDir.x * 0.33, 1.46 + armDir.y * 0.33, 0],
      ankle_r: [0.1, 0.075, 0], heel_r: [0.1, 0, -0.05], toe_r: [0.1, 0, 0.215],
      thigh_out_r: [0.2, 0.75, 0], thigh_in_r: [0.04, 0.75, 0], thigh_front_r: [0.12, 0.75, 0.085], thigh_back_r: [0.12, 0.75, -0.085],
      calf_out_r: [0.15, 0.33, 0], calf_in_r: [0.05, 0.33, 0], calf_front_r: [0.1, 0.33, 0.05], calf_back_r: [0.1, 0.33, -0.06],
      // tailor's set
      hps_l: [-0.075, 1.5, -0.01], hps_r: [0.075, 1.5, -0.01],
      front_armpit_l: [-0.155, 1.33, 0.08], front_armpit_r: [0.155, 1.33, 0.08],
      back_armpit_l: [-0.17, 1.33, -0.09], back_armpit_r: [0.17, 1.33, -0.09],
      axilla_r: [0.15, 1.3, 0],
      bust_point_l: [-0.095, 1.27, 0.125], bust_point_r: [0.095, 1.27, 0.125],
      underbust_side_l: [-0.15, 1.2, 0], underbust_side_r: [0.15, 1.2, 0], underbust_front: [0, 1.2, 0.11], underbust_back: [0, 1.2, -0.11],
      high_hip_side_l: [-0.16, 1.0, 0], high_hip_side_r: [0.16, 1.0, 0], high_hip_front: [0, 1.0, 0.115], high_hip_back: [0, 1.0, -0.12],
      neck_base_front: [0, 1.47, 0.07], nape_base: [0, 1.51, -0.065],
      arm_acromion_l: [-b.shoulder / 2, 1.46, 0],
      elbow_l: [-(b.shoulder / 2 + armDir.x * 0.33), 1.46 + armDir.y * 0.33, 0],
      wrist_l: [-(b.shoulder / 2 + armDir.x * b.arm), 1.46 + armDir.y * b.arm, 0],
      knee_l: [-0.1, 0.5, 0], ankle_l: [-0.1, 0.075, 0],
      knee_out_r: [0.155, 0.5, 0], knee_in_r: [0.045, 0.5, 0], knee_front_r: [0.1, 0.5, 0.055], knee_back_r: [0.1, 0.5, -0.055],
    };
    const o = this.offsets[id];
    if (o && tbl[id]) tbl[id] = [tbl[id][0] + o[0], tbl[id][1] + o[1], tbl[id][2] + o[2]];
    const p = tbl[id];
    if (!p) throw new Error("no synthetic landmark " + id);
    return this.w(p[0], p[1], p[2]);
  }
}

function controller(handedness: "left" | "right", tip: Vec3, dir: Vec3, tipOffset: number, noise: number): ControllerState {
  const d = normalize(dir);
  const origin = add(tip, scale(d, -tipOffset));
  const n = v3(noise * Math.sin(noise * 1e5), noise * Math.cos(noise * 7e4), 0);
  const pose = { position: add(origin, n), orientation: quatFromTo(v3(0, 0, -1), d), tracked: true };
  return { handedness, aim: pose, grip: { ...pose, position: add(tip, n) }, trigger: 0, squeeze: 0, primary: false, secondary: false, thumbstick: { x: 0, y: 0, pressed: false } };
}

const TOUCH_DIRS: [Vec3, Vec3][] = [
  [v3(1, 0, 0), v3(-1, 0, 0)],
  [v3(0, 0, -1), v3(0.7071, 0, 0.7071)],
  [v3(0, 1, 0), v3(0, -0.6, -0.8)],
  [v3(0.6, 0, -0.8), v3(-0.6, 0.8, 0)],
  [v3(0, -1, 0), v3(1, 0, 0)],
  [v3(0.5, 0.5, 0.7071), v3(0, 0, 1)],
];

export function frameFor(b: SyntheticBody, step: CaptureStep, t: number, touch: number): TrackingFrame {
  const noise = 0.0002 * Math.sin(t * 0.37);
  const head = { position: b.w(0, b.height - 0.11, 0.08), orientation: b.q, tracked: true };
  let left = controller("left", b.w(-0.3, 1.0, 0.3), b.forward, b.tipOffset, noise);
  let right = controller("right", b.w(0.3, 1.0, 0.3), b.forward, b.tipOffset, noise);
  if (step.kind === "tip-calibration") {
    const meet = b.w(0, 1.2, 0.35);
    const [dl, dr] = TOUCH_DIRS[touch % TOUCH_DIRS.length];
    left = controller("left", meet, dl, b.tipOffset, noise);
    right = controller("right", meet, dr, b.tipOffset, noise);
  } else if (step.kind === "floor") {
    right = controller("right", b.landmark("floor"), v3(0, -1, 0), b.tipOffset, noise);
  } else if (step.kind === "landmarks") {
    for (const p of step.points) {
      const target = b.landmark(p.landmark);
      const c = controller(p.controller, target, p.controller === "left" ? v3(0.3, -0.2, -1) : v3(-0.3, 0.1, -1), b.tipOffset, noise);
      if (p.use === "grip") c.grip = { ...c.grip!, position: target };
      if (p.controller === "left") left = c;
      else right = c;
    }
  }
  void length;
  return { t, source: "simulator", head, left, right, device: "synthetic" };
}

import { CaptureSession } from "../src/measurement/session";
import { buildPassport, type BodyPassport } from "../src/passport/passport";

/** Run a full guided session on a synthetic body (every step captured, accepted). */
export function runSession(profile: "simple" | "intermediate" | "ultra", body = new SyntheticBody(), startMs = 1767225600000) {
  let now = 0;
  const s = new CaptureSession(profile, () => new Date(startMs + now).toISOString());
  while (s.phase !== "done") {
    const step = s.step!;
    const touch = step.kind === "tip-calibration" ? s.tipSamples.length : 0;
    for (let i = 0; i < 200 && s.phase !== "review"; i++) {
      now += 14;
      s.update(frameFor(body, step, now, touch), true);
    }
    if (s.phase !== "review") throw new Error("capture did not commit at " + step.id);
    s.accept();
  }
  return s;
}

export function passportFrom(s: CaptureSession, at: string, extra: Partial<Parameters<typeof buildPassport>[0]> = {}): BodyPassport {
  return buildPassport({ profileId: "p-test", displayName: "Synthetic", profile: s.profile, device: "test", simulated: true, calibration: s.calibration, measurements: s.measurements, landmarks: s.landmarks, captures: s.captures, consentTimestamp: at, now: at, createdAt: "2026-01-01T09:00:00.000Z", ...extra });
}
