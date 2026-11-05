import { add, bodyFrameFromHead, distance, dot, forwardOf, forwardSeparation, lateralSeparation, mean, scale, sub, toBody, v3, verticalSeparation, type Vec3 } from "../core/math";
import { mToMm } from "../core/units";
import type { ControllerState, TrackingFrame } from "../tracking/types";
import { computeAll, type ManualEntry } from "./engine";
import { POINT_CAP, stepsFor, type CaptureStep } from "./procedures";
import { Stabilizer, DEFAULT_STABILIZER, type StabilityReport } from "./stabilizer";
import { solveTipOffset, tipPoint, tipSampleFrom, type TipSample } from "./tip";
import type { Calibration, Landmark, Measurement, ProfileKind } from "./types";

export type Phase = "aim" | "holding" | "review" | "done";

export type CaptureRecord = {
  stepId: string;
  timestamp: string;
  points: { landmark: string; position: Vec3; spreadMm: number }[];
  accepted: boolean;
};

/** Capture hold duration (Settings ▸ Capture hold). */
export const CAPTURE_CONFIG = {
  holdMs: 900,
  /** Max progress credited per frame (guards against stalls). Raised only for the low-fps emulator. */
  maxFrameMs: 100,
};
export const HOLD_MS = 900;

export function emptyCalibration(): Calibration {
  return { floorY: null, floorCalibrated: false, bodyFrame: null, bodyOriginEstablished: false, tipOffsetM: 0, tipResidualMm: null, tipCalibrated: false, timestamp: null };
}

/**
 * Guided capture state machine. Pure logic: feed it TrackingFrames and a
 * "capture held" boolean every frame; read `phase`, `progress`, `live` for UI.
 *
 * A capture only commits when tracking is valid AND the stabiliser reports the
 * points steady for the whole hold. Losing stability during the hold resets the
 * progress — a measurement is never locked just because an animation finished.
 * After commit the user must explicitly Accept (A) or Retake (B).
 */
export class CaptureSession {
  profile: ProfileKind;
  steps: CaptureStep[];
  index = 0;
  phase: Phase = "aim";
  progress = 0;
  calibration: Calibration = emptyCalibration();
  landmarks: Record<string, Landmark> = {};
  manual: Record<string, ManualEntry> = {};
  locked: Record<string, Measurement> = {};
  measurements: Record<string, Measurement> = {};
  shape: Record<string, number> = {};
  captures: CaptureRecord[] = [];
  tipSamples: TipSample[] = [];
  device = "unknown";
  source: TrackingFrame["source"] = "webxr";
  lastReport: StabilityReport | null = null;
  /** Pending (not yet accepted) capture. */
  pending: { landmarks: Landmark[]; tip?: TipSample; head?: { pos: Vec3; quat: TrackingFrame["head"] } } | null = null;
  message = "";
  /** True after "Add sample": the next accepted capture is averaged into the same landmarks. */
  refining = false;
  private stab: Stabilizer;
  private lastT = 0;
  private lastFrame: TrackingFrame | null = null;

  constructor(profile: ProfileKind, private nowIso: () => string = () => new Date().toISOString()) {
    this.profile = profile;
    this.steps = stepsFor(profile);
    this.stab = new Stabilizer(this.pointCount(), DEFAULT_STABILIZER);
  }

  get step(): CaptureStep | null {
    return this.steps[this.index] ?? null;
  }

  private pointCount(): number {
    const s = this.step;
    if (!s) return 1;
    if (s.kind === "tip-calibration") return 2;
    if (s.kind === "stance") return 1;
    return Math.max(1, s.points.length);
  }

  /** Points tracked for the current step (null where tracking is lost). */
  currentPoints(f: TrackingFrame): (Vec3 | null)[] {
    const s = this.step;
    if (!s) return [];
    if (s.kind === "tip-calibration") return [tipPoint(f.left, 0), tipPoint(f.right, 0)];
    if (s.kind === "stance") return [f.head?.tracked ? f.head.position : null];
    return s.points.map((p) => {
      const c: ControllerState | null = p.controller === "left" ? f.left : f.right;
      if (p.use === "grip") return c?.grip?.tracked ? c.grip.position : null;
      return tipPoint(c, this.calibration.tipOffsetM);
    });
  }

  /** Live readout between the two measuring tips (free of any step). */
  static live(f: TrackingFrame, offsetM: number, frame: Calibration["bodyFrame"]) {
    const a = tipPoint(f.left, offsetM);
    const b = tipPoint(f.right, offsetM);
    if (!a || !b) return null;
    return {
      a, b,
      euclidMm: mToMm(distance(a, b)),
      lateralMm: frame ? mToMm(lateralSeparation(frame, a, b)) : null,
      forwardMm: frame ? mToMm(forwardSeparation(frame, a, b)) : null,
      verticalMm: mToMm(verticalSeparation(a, b)),
    };
  }

  update(f: TrackingFrame, captureHeld: boolean) {
    this.lastFrame = f;
    this.source = f.source;
    this.device = f.device;
    const dt = this.lastT ? Math.min(CAPTURE_CONFIG.maxFrameMs, f.t - this.lastT) : 0;
    this.lastT = f.t;
    if (!this.step || this.phase === "review" || this.phase === "done") return;
    this.stab.push(f.t, this.currentPoints(f));
    const rep = this.stab.report();
    this.lastReport = rep;
    if (captureHeld && rep.stable) {
      this.phase = "holding";
      this.progress = Math.min(1, this.progress + dt / CAPTURE_CONFIG.holdMs);
      if (this.progress >= 1) this.commit(f, rep);
    } else {
      if (this.phase === "holding" && captureHeld && !rep.stable) this.message = rep.reason === "tracking-lost" ? "Tracking lost — keep controllers in view" : "Hold still…";
      this.phase = "aim";
      this.progress = 0;
    }
  }

  private commit(f: TrackingFrame, rep: StabilityReport) {
    const s = this.step!;
    const ts = this.nowIso();
    this.pending = { landmarks: [] };
    if (s.kind === "tip-calibration") {
      const tip = tipSampleFrom(f.left, f.right);
      if (tip) this.pending.tip = tip;
    } else if (s.kind === "stance") {
      this.pending.head = { pos: rep.median[0]!, quat: f.head };
    } else {
      const frame = this.calibration.bodyFrame;
      const pts = s.kind === "floor" ? [{ landmark: "floor", controller: "right" as const, use: "tip" as const }] : s.points;
      pts.forEach((p, i) => {
        const pos = rep.median[i]!;
        const c = p.controller === "left" ? f.left : f.right;
        const dir = p.use === "tip" && c?.aim ? forwardOf(c.aim.orientation) : v3(0, 0, 0);
        const raw = [{ origin: sub(pos, scale(dir, this.calibration.tipOffsetM)), dir }];
        const spreadMm = mToMm(rep.spreadM[i]);
        const floorY = this.calibration.floorY ?? 0;
        const body = frame ? toBody(frame, pos) : { x: pos.x, y: pos.y - floorY, z: -pos.z };
        this.pending!.landmarks.push({
          id: p.landmark,
          position: pos,
          body,
          confidence: Math.max(0, 1 - spreadMm / 5),
          captureMethod: p.use === "grip" ? "controller-grip" : "controller-tip",
          controller: p.controller,
          timestamp: ts,
          coordinateSpace: "xr-local-floor",
          spreadMm,
          validation: "confirmed",
          stepId: s.id,
          raw,
          samples: 1,
        });
      });
    }
    this.captures.push({
      stepId: s.id,
      timestamp: ts,
      points: rep.median.map((p, i) => ({ landmark: s.points[i]?.landmark ?? `${s.id}_${i}`, position: p!, spreadMm: mToMm(rep.spreadM[i]) })),
      accepted: false,
    });
    this.phase = "review";
    this.progress = 1;
    this.message = "";
  }

  /** Human-readable result of the pending capture for the review card. */
  pendingSummary(): string {
    const s = this.step;
    if (!s || !this.pending) return "";
    if (s.kind === "tip-calibration") return `Touch ${this.tipSamples.length + 1} of 3 recorded`;
    if (s.kind === "floor") return `Floor at ${(this.pending.landmarks[0]?.position.y * 100).toFixed(1)} cm in tracking space`;
    if (s.kind === "stance") return "Body axes set from your gaze";
    const lms = this.pending.landmarks;
    if (lms.length === 2) {
      const d = mToMm(distance(lms[0].position, lms[1].position));
      return `${(d / 10).toFixed(1)} cm between points`;
    }
    if (lms.length === 1 && this.calibration.floorY !== null) return `${((lms[0].position.y - this.calibration.floorY) * 100).toFixed(1)} cm above floor`;
    return "Point captured";
  }

  /** Accept and capture the same point(s) again; samples are averaged (uncertainty shrinks ~1/√n). */
  acceptAndRefine() {
    const s = this.step;
    if (!s || s.kind !== "landmarks") return this.accept();
    if (this.totalSamples() + (this.pending?.landmarks.length ?? 0) >= POINT_CAP[this.profile]) {
      this.message = `Point limit for ${this.profile} mode reached (${POINT_CAP[this.profile]}) — accepted and moving on`;
      return this.accept();
    }
    this.accept(true);
  }

  /** Landmark samples captured so far (points incl. repeats). */
  totalSamples(): number {
    return Object.values(this.landmarks).reduce((a, l) => a + (l.samples ?? 1), 0);
  }

  accept(refine = false) {
    const s = this.step;
    if (this.phase !== "review" || !s || !this.pending) return;
    this.captures[this.captures.length - 1].accepted = true;
    let advance = true;
    if (s.kind === "tip-calibration" && this.pending.tip) {
      this.tipSamples.push(this.pending.tip);
      if (this.tipSamples.length >= 3) {
        const sol = solveTipOffset(this.tipSamples);
        if (!sol) {
          this.message = "Vary the controller angles more between touches";
          advance = this.tipSamples.length >= 6; // give up after 6: keep offset 0, uncalibrated
        } else {
          this.calibration.tipOffsetM = sol.offsetM;
          this.calibration.tipResidualMm = mToMm(sol.residualRmsM);
          this.calibration.tipCalibrated = true;
          this.message = `Tip offset ${(sol.offsetM * 100).toFixed(1)} cm · residual ${mToMm(sol.residualRmsM).toFixed(1)} mm`;
          this.reprojectTipLandmarks();
        }
      } else advance = false;
    } else if (s.kind === "floor") {
      const lm = this.pending.landmarks[0];
      this.landmarks.floor = this.refining && this.landmarks.floor ? mergeLandmark(this.landmarks.floor, lm, this.calibration.tipOffsetM) : lm;
      this.calibration.floorY = this.landmarks.floor.position.y;
      this.calibration.floorCalibrated = true;
      this.refreshBodyCoords();
    } else if (s.kind === "stance" && this.pending.head?.quat) {
      const floorY = this.calibration.floorY ?? 0;
      this.calibration.bodyFrame = bodyFrameFromHead(this.pending.head.pos, this.pending.head.quat.orientation, floorY);
      this.calibration.bodyOriginEstablished = true;
      this.calibration.timestamp = this.nowIso();
      const hp = this.pending.head.pos;
      this.landmarks.head_device = {
        id: "head_device", position: hp, body: toBody(this.calibration.bodyFrame, hp), confidence: 1, captureMethod: "headset",
        timestamp: this.nowIso(), coordinateSpace: "xr-local-floor", spreadMm: mToMm(this.lastReport?.spreadM[0] ?? 0), validation: "confirmed", stepId: s.id, samples: 1,
      };
      this.refreshBodyCoords();
    } else {
      for (const lm of this.pending.landmarks) {
        const prev = this.landmarks[lm.id];
        this.landmarks[lm.id] = this.refining && prev ? mergeLandmark(prev, lm, this.calibration.tipOffsetM) : lm;
      }
      this.refreshBodyCoords();
    }
    this.pending = null;
    if (refine && s.kind === "landmarks") {
      this.refining = true;
      advance = false;
      const n = this.landmarks[s.points[0].landmark]?.samples ?? 1;
      this.message = `${n} sample${n > 1 ? "s" : ""} averaged — capture again or press A to continue`;
    }
    if (advance) this.goTo(this.index + 1);
    else this.resetCapture();
    this.recompute();
  }

  /** After tip calibration, recompute every earlier tip landmark from its raw aim pose. */
  reprojectTipLandmarks() {
    const d = this.calibration.tipOffsetM;
    for (const lm of Object.values(this.landmarks)) {
      if (!lm.raw?.length || lm.captureMethod !== "controller-tip") continue;
      lm.position = meanVec(lm.raw.map((r) => add(r.origin, scale(r.dir, d))));
    }
    if (this.landmarks.floor) this.calibration.floorY = this.landmarks.floor.position.y;
    this.refreshBodyCoords();
  }

  /** Keep the body frame on the calibrated floor and body-space coordinates in sync. */
  refreshBodyCoords() {
    const f = this.calibration.bodyFrame;
    if (f && this.calibration.floorY !== null) f.origin = { ...f.origin, y: this.calibration.floorY };
    for (const lm of Object.values(this.landmarks)) {
      lm.body = f ? toBody(f, lm.position) : { x: lm.position.x, y: lm.position.y - (this.calibration.floorY ?? 0), z: -lm.position.z };
    }
  }

  retake() {
    if (this.phase !== "review") return;
    this.pending = null;
    this.resetCapture();
  }

  skip() {
    this.pending = null;
    this.goTo(this.index + 1);
  }

  goTo(i: number) {
    this.refining = false;
    this.index = Math.max(0, Math.min(i, this.steps.length));
    this.stab = new Stabilizer(this.pointCount(), DEFAULT_STABILIZER);
    this.resetCapture();
    if (this.index >= this.steps.length) this.phase = "done";
  }

  /** Jump to the step that captures a given measurement's landmarks (targeted re-measure). */
  remeasure(measurementId: string) {
    const m = this.measurements[measurementId];
    const lmIds = new Set(m?.sources ?? []);
    // follow derived → source measurements → landmarks
    for (const src of m?.sources ?? []) for (const s2 of this.measurements[src]?.sources ?? []) lmIds.add(s2);
    const idx = this.steps.findIndex((s) => s.points.some((p) => lmIds.has(p.landmark)));
    if (idx >= 0) {
      delete this.manual[measurementId];
      delete this.locked[measurementId];
      this.goTo(idx);
    }
  }

  private resetCapture() {
    this.phase = this.index >= this.steps.length ? "done" : "aim";
    this.progress = 0;
    this.stab.reset();
  }

  setManual(id: string, valueMm: number, note?: string) {
    this.manual[id] = { value: valueMm, timestamp: this.nowIso(), note };
    this.recompute();
  }
  clearManual(id: string) {
    delete this.manual[id];
    this.recompute();
  }
  toggleLock(id: string) {
    if (this.locked[id]) delete this.locked[id];
    else if (this.measurements[id]) this.locked[id] = { ...this.measurements[id], locked: true };
    this.recompute();
  }

  recompute() {
    this.measurements = computeAll({
      landmarks: this.landmarks,
      calibration: this.calibration,
      manual: this.manual,
      locked: this.locked,
      shape: this.shape,
      previous: this.measurements,
      now: this.nowIso(),
    });
  }

  get frame() {
    return this.lastFrame;
  }

  private landmarkDeps(id: string, seen = new Set<string>()): Set<string> {
    const m = this.measurements[id];
    for (const src of m?.sources ?? []) {
      if (this.landmarks[src] && src !== "floor") seen.add(src);
      else if (this.measurements[src] && !seen.has("m:" + src)) {
        seen.add("m:" + src);
        this.landmarkDeps(src, seen);
      }
    }
    return seen;
  }

  /** Delete a measurement: drops manual/lock and the landmarks it was measured from. */
  deleteMeasurement(id: string) {
    delete this.manual[id];
    delete this.locked[id];
    for (const d of this.landmarkDeps(id)) if (!d.startsWith("m:")) delete this.landmarks[d];
    this.recompute();
  }

  snapshot(): SessionSnapshot {
    return {
      profile: this.profile, index: this.index, calibration: this.calibration, landmarks: this.landmarks, manual: this.manual,
      locked: this.locked, shape: this.shape, captures: this.captures, tipSamples: this.tipSamples, measurements: this.measurements,
    };
  }

  static restore(s: SessionSnapshot, nowIso?: () => string): CaptureSession {
    const c = new CaptureSession(s.profile, nowIso);
    Object.assign(c, { calibration: s.calibration, landmarks: s.landmarks, manual: s.manual, locked: s.locked, shape: s.shape ?? {}, captures: s.captures, tipSamples: s.tipSamples, measurements: s.measurements ?? {} });
    c.goTo(s.index);
    c.recompute();
    return c;
  }
}

export type SessionSnapshot = {
  profile: ProfileKind; index: number; calibration: Calibration; landmarks: Record<string, Landmark>; manual: Record<string, ManualEntry>;
  locked: Record<string, Measurement>; shape: Record<string, number>; captures: CaptureRecord[]; tipSamples: TipSample[]; measurements: Record<string, Measurement>;
};

function meanVec(ps: Vec3[]): Vec3 {
  return v3(mean(ps.map((p) => p.x)), mean(ps.map((p) => p.y)), mean(ps.map((p) => p.z)));
}

/** Average a new placement into an existing landmark. */
export function mergeLandmark(prev: Landmark, next: Landmark, tipOffsetM: number): Landmark {
  const raw = [...(prev.raw ?? [{ origin: prev.position, dir: v3() }]), ...(next.raw ?? [{ origin: next.position, dir: v3() }])];
  const positions = raw.map((r) => add(r.origin, scale(r.dir, tipOffsetM)));
  const m = meanVec(positions);
  const sd = Math.sqrt(positions.reduce((s, p) => s + dot(sub(p, m), sub(p, m)), 0) / Math.max(1, positions.length - 1));
  return { ...next, position: m, raw, samples: positions.length, repeatSdMm: mToMm(sd), spreadMm: Math.max(prev.spreadMm, next.spreadMm), timestamp: next.timestamp };
}
