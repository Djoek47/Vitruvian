import type { Quat, Vec3 } from "../core/math";

/**
 * Tracking abstraction. The measurement engine only ever sees TrackingFrame,
 * so the source (WebXR today, native OpenXR / Unreal tomorrow, a simulator in
 * development) can change without touching measurement code.
 */
export type Pose = {
  position: Vec3;
  orientation: Quat;
  /** false when the runtime reports emulatedPosition or the pose is missing. */
  tracked: boolean;
};

export type ControllerState = {
  handedness: "left" | "right";
  /** Grip pose: centre of the palm holding the controller. */
  grip: Pose | null;
  /** Aim / target-ray pose. Its origin is near the front of the controller. */
  aim: Pose | null;
  trigger: number; // 0..1
  squeeze: number; // 0..1
  /** A/X (primary) and B/Y (secondary) face buttons. */
  primary: boolean;
  secondary: boolean;
  thumbstick: { x: number; y: number; pressed: boolean };
};

export type TrackingSource = "webxr" | "simulator";

export type TrackingFrame = {
  t: number; // ms
  source: TrackingSource;
  head: Pose | null;
  left: ControllerState | null;
  right: ControllerState | null;
  /** Description of the device for provenance, e.g. "Oculus Browser / Quest 3". */
  device: string;
};
