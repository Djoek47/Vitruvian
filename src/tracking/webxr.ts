import type { ControllerState, Pose, TrackingFrame } from "./types";

/**
 * WebXR → TrackingFrame adapter. Reads REAL poses from the XR runtime (on a
 * Quest: Meta's OpenXR runtime via the Quest Browser). No smoothing or
 * prediction is added here — the stabiliser in the measurement engine owns that.
 *
 * Quest "xr-standard" gamepad mapping:
 *   buttons[0] trigger · [1] squeeze · [3] thumbstick press · [4] A/X · [5] B/Y
 *   axes[2], axes[3] thumbstick
 */
function pose(p: XRPose | undefined | null, simulated = false): Pose | null {
  if (!p) return null;
  const t = p.transform;
  return {
    position: { x: t.position.x, y: t.position.y, z: t.position.z },
    orientation: { x: t.orientation.x, y: t.orientation.y, z: t.orientation.z, w: t.orientation.w },
    // emulatedPosition = runtime is guessing (controller out of camera view / IMU-only)
    // The IWER emulator marks every pose emulated; only in that (flagged) mode do we accept them.
    tracked: !p.emulatedPosition || simulated,
  };
}

export function readXRFrame(frame: XRFrame, ref: XRReferenceSpace, t: number, simulated: boolean): TrackingFrame {
  const out: TrackingFrame = { t, source: simulated ? "simulator" : "webxr", head: null, left: null, right: null, device: deviceName(simulated) };
  const vp = frame.getViewerPose(ref);
  if (vp) out.head = pose(vp as unknown as XRPose, simulated);
  for (const src of frame.session.inputSources) {
    if (src.handedness !== "left" && src.handedness !== "right") continue;
    if (src.hand && !src.gamepad) continue; // hand tracking has no measuring tip; controllers only
    const gp = src.gamepad;
    const b = (i: number) => gp?.buttons[i];
    const c: ControllerState = {
      handedness: src.handedness,
      aim: pose(frame.getPose(src.targetRaySpace, ref), simulated),
      grip: src.gripSpace ? pose(frame.getPose(src.gripSpace, ref), simulated) : null,
      trigger: b(0)?.value ?? 0,
      squeeze: b(1)?.value ?? 0,
      primary: !!b(4)?.pressed,
      secondary: !!b(5)?.pressed,
      thumbstick: { x: gp?.axes[2] ?? 0, y: gp?.axes[3] ?? 0, pressed: !!b(3)?.pressed },
    };
    out[src.handedness] = c;
  }
  return out;
}

export function deviceName(simulated: boolean): string {
  if (simulated) return "IWER emulated Meta Quest (SIMULATOR — not real tracking)";
  const ua = navigator.userAgent;
  const m = ua.match(/Quest\s?(\d\w*|Pro)?/i);
  if (/OculusBrowser/i.test(ua)) return `Meta ${m ? m[0] : "Quest"} · Oculus Browser`;
  return ua.slice(0, 80);
}
