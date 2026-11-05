import type { Vec3 } from "../core/math";

export type MeasurementMethod = "direct" | "derived" | "estimated" | "manual";
/** "conflicted" is a STATUS layered on top of any method, per the design system. */
export type MeasurementStatus = "validated" | "unvalidated" | "conflicted";

export type Landmark = {
  id: string;
  /** World position in metres, XR "local-floor" space. */
  position: Vec3;
  /** Position in body frame (metres): x right, y up from calibrated floor, z forward. */
  body: Vec3;
  confidence: number;
  captureMethod: "controller-tip" | "controller-grip" | "headset";
  controller?: "left" | "right";
  timestamp: string;
  coordinateSpace: "xr-local-floor";
  spreadMm: number;
  validation: "confirmed" | "rejected";
  stepId: string;
  /** Raw aim pose(s) for tip captures, so positions can be recomputed if the tip is (re)calibrated later. */
  raw?: { origin: Vec3; dir: Vec3 }[];
  /** Number of independent placements averaged into `position` ("more points = more established"). */
  samples?: number;
  /** RMS distance between repeated placements (mm), when samples ≥ 2. */
  repeatSdMm?: number;
};

export type MeasurementHistoryEntry = {
  value: number;
  method: MeasurementMethod;
  timestamp: string;
  note?: string;
};

export type Measurement = {
  id: string;
  value: number; // mm
  unit: "mm";
  method: MeasurementMethod;
  confidence: number; // 0..1
  uncertaintyMm: number;
  /** Random (non-systematic) part of the uncertainty. Systematic model error cancels in changes between snapshots. */
  randomUncertaintyMm?: number;
  status: MeasurementStatus;
  timestamp: string;
  /** Landmark ids or measurement ids this value depends on. */
  sources: string[];
  procedure: string;
  conflicts?: string[];
  locked?: boolean;
  history: MeasurementHistoryEntry[];
};

export type Calibration = {
  floorY: number | null; // metres
  floorCalibrated: boolean;
  bodyFrame: { origin: Vec3; forward: Vec3; lateral: Vec3; up: Vec3 } | null;
  bodyOriginEstablished: boolean;
  tipOffsetM: number;
  tipResidualMm: number | null;
  tipCalibrated: boolean;
  timestamp: string | null;
};

export type ProfileKind = "quick" | "precision";
