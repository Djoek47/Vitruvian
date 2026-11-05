import { distance, dot, forwardOf, median, sub, type Vec3 } from "../core/math";
import { formatMm, mToMm, type LengthUnit } from "../core/units";
import { LANDMARKS } from "../anatomy/landmarks";
import { MEASUREMENTS, MEASUREMENT_BY_ID, PROFILE_PRIMARY } from "../measurement/registry";
import { CaptureSession, CAPTURE_CONFIG, type SessionSnapshot } from "../measurement/session";
import { Stabilizer, DEFAULT_STABILIZER } from "../measurement/stabilizer";
import { STEPS, POINT_CAP, PROFILE_INFO, bodyPointsFor, type CaptureStep } from "../measurement/procedures";
import { tipPoint } from "../measurement/tip";
import type { ProfileKind } from "../measurement/types";
import { buildPassport, calibrationFromPassport, type BodyPassport, type Subject } from "../passport/passport";
import { evaluateTshirt, recommendSize, EXAMPLE_TSHIRT_CHART, EXAMPLE_CHART_LABEL } from "../fit/tshirt";
import { computeComposition, meshVolumeL, type Sex } from "../body/composition";
import { buildMannequin } from "../body/mannequin";
import { footLengthFromSize, sizeFromFootLength, SHOE_SYSTEMS, type ShoeSystem } from "../body/shoe";
import type { RulerReading } from "../validation/stats";
import type { TrackingFrame } from "../tracking/types";
import type { TwinMode } from "../scene/twin";
import { CanvasPanel, glyph, poly } from "../ui/canvasPanel";
import { drawControllers } from "../ui/questController";
import type { HintSpec } from "../scene/controllerHints";
import { T } from "../ui/theme";

export type Screen = "boot" | "tutorial" | "home" | "about" | "settings" | "steps" | "capture" | "studio" | "editor" | "results" | "fit";

export type Settings = {
  units: LengthUnit;
  holdMs: number;
  relaxed: boolean;
  haptics: boolean;
  twin: TwinMode;
  panelDistance: "near" | "normal" | "far" | "large";
  showAxes: boolean;
  controllerHints: boolean;
  tutorialDone: boolean;
};
export const DEFAULT_SETTINGS: Settings = { units: "cm", holdMs: 900, relaxed: false, haptics: true, twin: "hologram", panelDistance: "normal", showAxes: true, controllerHints: true, tutorialDone: false };

export type TrackingEvent = { t: string; device: "left" | "right" | "head"; event: "lost" | "recovered" | "connected" };

export type AppHooks = {
  exitXR: () => void;
  savePassport: (p: BodyPassport) => Promise<void>;
  saveDraft: (s: SessionSnapshot | null) => void;
  saveStudio: (r: RulerReading[]) => void;
  saveSettings: (s: Settings) => void;
  saveSubject: (s: Subject) => void;
  replacePanels: () => void;
  haptic: (hand: "left" | "right", intensity: number, ms: number) => void;
  images: { star?: HTMLImageElement; wordmark?: HTMLImageElement };
};

const W = 1600;
const H = 1040;

/** First capture step needed for a measurement that has never been taken. */
const FIRST_STEP_FOR: Record<string, string> = {
  height: "crown", eye_height: "cal_stance", shoulder_width: "acromions", chest_width: "chest_sides", chest_depth: "chest_fb", chest_circumference: "chest_sides",
  waist_width: "waist_sides", waist_depth: "waist_fb", waist_circumference: "waist_sides", hip_width: "hip_sides", hip_depth: "hip_fb",
  hip_circumference: "hip_sides", arm_length: "arm_top", upper_arm_length: "arm_top", forearm_length: "arm_elbow", shoulder_height: "arm_top", waist_height: "waist_sides",
  back_length: "neck_fb", front_waist_length: "neck_fb", neck_width: "neck_sides", neck_depth: "neck_fb", neck_circumference: "neck_sides", inseam: "crotch", rise: "crotch",
  outseam: "waist_sides", knee_height: "knee", ankle_height: "ankle", foot_length: "foot", arm_span: "span",
  thigh_width: "thigh_sides", thigh_depth: "thigh_fb", thigh_circumference: "thigh_sides", calf_width: "calf_sides", calf_depth: "calf_fb", calf_circumference: "calf_sides",
  shoulder_length_r: "hps", shoulder_length_l: "hps", shoulder_slope_r: "hps", shoulder_slope_l: "hps", neck_base_width: "hps", neck_base_depth: "neck_base_fb", neck_base_circumference: "hps",
  across_front: "across_front", across_back: "across_back", armhole_depth: "axilla", front_length_hps: "hps", nape_to_floor: "neck_fb", waist_to_hip: "waist_sides", waist_to_knee: "knee",
  high_hip_width: "high_hip_sides", high_hip_depth: "high_hip_fb", high_hip_circumference: "high_hip_sides", apex_to_apex: "bust_points", hps_to_apex: "bust_points",
  underbust_width: "underbust_sides", underbust_depth: "underbust_fb", underbust_circumference: "underbust_sides", arm_length_left: "arm_top_l", upper_arm_length_left: "arm_top_l",
  forearm_length_left: "arm_elbow_l", knee_height_left: "knee_l", ankle_height_left: "ankle_l", knee_width: "knee_sides", knee_depth: "knee_fb", knee_circumference: "knee_sides",
};


const TUTORIAL = [
  { title: "HOW VITRUVIAN MEASURES", lines: ["Your two controllers become a measuring instrument.", "You touch points on your body with the controller TIPS.", "Each point is recorded in 3D — X left–right, Y up–down, Z front–back.", "The more points you capture, the more established your body model becomes."] },
  { title: "HOLD THE CONTROLLERS", lines: ["Hold each controller normally, strap on your wrist.", "The measuring point is the FRONT TIP — shown as a gold dot in the headset.", "Touch the body lightly. Don't press into soft tissue.", "Keep both controllers where the headset can see them."] },
  { title: "BUTTONS", lines: [] },
  { title: "BEFORE YOU START", lines: ["Clear 1.5 m around you. Mixed Reality lets you see your body and the room.", "Wear light, close-fitting clothing; remove belts, jackets and pocket items.", "Pick ONE spot on the floor and stay on it for the whole session.", "About 4 minutes for Quick Fit, 8 for Precision Fit. Progress is saved after every point."] },
];

/**
 * VR application controller: owns screens and input. Measurement logic lives
 * in CaptureSession (pure engine); this class only routes input and draws.
 */
export class VitruvianApp {
  screen: Screen = "boot";
  session: CaptureSession | null = null;
  /** 1.5 m wide at 1.35 m ≈ 1110 dmm (design spec: 1200 dmm primary panel); "Large" scales it ×1.25. */
  readonly panel = new CanvasPanel(W, H, 1.5);
  settings: Settings = { ...DEFAULT_SETTINGS };
  subject: Subject = {};
  appearance: BodyPassport["appearance"] = undefined;
  simulated = false;
  frame: TrackingFrame | null = null;
  identity = { profileId: null as string | null, createdAt: null as string | null, displayName: "My Body Passport", consentTimestamp: new Date().toISOString() };
  latest: BodyPassport | null = null;
  trackingLog: TrackingEvent[] = [];
  modal: null | "exit" | "reset" = null;
  tutorialPage = 0;
  bootT = 0;
  private lastTracked: Record<string, boolean | undefined> = {};
  studio = { stab: new Stabilizer(2, DEFAULT_STABILIZER), progress: 0, readings: [] as RulerReading[], keypad: "", flash: 0 };
  editor = { sel: null as string | null, page: 0 };
  private prevButtons: Record<string, boolean> = {};
  private t = 0;
  toast = "";
  private toastT = 0;
  private passportCache: { key: string; p: BodyPassport | null } = { key: "", p: null };

  constructor(private hooks: AppHooks) {}

  get units() {
    return this.settings.units;
  }

  applySettings(s: Partial<Settings>) {
    const prevDist = this.settings.panelDistance;
    this.settings = { ...this.settings, ...s };
    CAPTURE_CONFIG.holdMs = this.settings.holdMs;
    if (!this.simulated) DEFAULT_STABILIZER.maxSpreadM = this.settings.relaxed ? 0.003 : 0.002;
    this.hooks.saveSettings(this.settings);
    if (prevDist !== this.settings.panelDistance) this.hooks.replacePanels();
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────
  /** Called when the immersive session starts. */
  onEnterXR() {
    this.bootT = 0;
    this.screen = "boot";
    this.modal = null;
  }

  startProfile(kind: ProfileKind) {
    const keep = this.session;
    this.session = new CaptureSession(kind);
    if (keep) Object.assign(this.session.manual, keep.manual);
    this.screen = "capture";
  }

  loadSnapshot(s: SessionSnapshot) {
    this.session = CaptureSession.restore(s);
  }

  loadPassport(p: BodyPassport) {
    this.latest = p;
    this.identity = { profileId: p.profileId, createdAt: p.createdAt, displayName: p.displayName, consentTimestamp: p.consent.timestamp };
    if (p.subject) this.subject = p.subject;
    if (p.appearance) this.appearance = p.appearance;
    const s = new CaptureSession(p.profile);
    s.calibration = calibrationFromPassport(p);
    s.landmarks = Object.fromEntries(p.landmarks.map((l) => [l.id, l]));
    s.captures = p.captures;
    for (const m of p.measurements) {
      if (m.method === "manual") s.manual[m.id] = { value: m.value, timestamp: m.timestamp, note: m.procedure };
      if (m.locked) s.locked[m.id] = m;
    }
    s.measurements = Object.fromEntries(p.measurements.map((m) => [m.id, m]));
    s.recompute();
    s.goTo(s.steps.length);
    this.session = s;
  }

  /** Current passport (memoised on measurements + subject + appearance). */
  passport(): BodyPassport | null {
    const s = this.session;
    if (!s) return null;
    const key = Object.values(s.measurements).map((m) => m.id + m.value.toFixed(1) + m.method + m.status).join() + JSON.stringify(this.subject) + (this.appearance?.skinTone?.hex ?? "") + Object.keys(s.landmarks).length;
    if (key === this.passportCache.key) return this.passportCache.p;
    const base = {
      profileId: this.identity.profileId ?? undefined,
      createdAt: this.identity.createdAt ?? undefined,
      displayName: this.identity.displayName,
      profile: s.profile,
      device: this.frame?.device ?? s.device,
      simulated: this.simulated,
      calibration: s.calibration,
      measurements: s.measurements,
      landmarks: s.landmarks,
      captures: s.captures,
      references: this.latest?.validation.referenceMeasurements,
      consentTimestamp: this.identity.consentTimestamp,
      subject: this.subject,
      appearance: this.appearance,
    };
    let p = buildPassport(base);
    if (p.measurements.length) {
      const m = s.measurements;
      const volumeL = m.height ? meshVolumeL(buildMannequin(p)) : undefined;
      const composition = computeComposition({ weightKg: this.subject.weightKg, heightMm: m.height?.value, sex: this.subject.sex, neckMm: m.neck_circumference?.value, waistMm: m.waist_circumference?.value, hipMm: m.hip_circumference?.value, volumeL });
      p = { ...p, composition };
    }
    if (!this.identity.profileId) this.identity.profileId = p.profileId;
    if (!this.identity.createdAt) this.identity.createdAt = p.createdAt;
    this.passportCache = { key, p };
    return p;
  }

  /** Fresh (non-memoised) passport. */
  buildPassport() {
    this.passportCache.key = "";
    return this.passport();
  }

  async save() {
    const p = this.buildPassport();
    if (!p || !p.measurements.length) return;
    // Snapshots are immutable history: don't append an identical copy of the latest one.
    const sig = (x: BodyPassport) => JSON.stringify([x.profileId, x.measurements.map((m) => [m.id, m.value, m.method, m.status]), x.landmarks.length, x.subject ?? null, x.appearance?.skinTone?.hex ?? null]);
    if (this.latest && sig(this.latest) === sig(p)) {
      this.say("Body Passport already saved");
      return;
    }
    this.latest = p;
    await this.hooks.savePassport(p);
    this.say("Body Passport saved on this headset");
  }

  say(msg: string) {
    this.toast = msg;
    this.toastT = 3;
  }

  private buzz(hand: "left" | "right", i: number, ms: number) {
    if (this.settings.haptics) this.hooks.haptic(hand, i, ms);
  }

  /** "More points = more established": coverage of the current profile's landmarks. */
  pointsInfo() {
    const s = this.session;
    if (!s) return { captured: 0, total: 0, samples: 0, established: 0 };
    const ids = new Set<string>(["floor", "head_device"]);
    for (const st of s.steps) for (const p of st.points) ids.add(p.landmark);
    const captured = [...ids].filter((i) => s.landmarks[i]).length;
    const samples = [...ids].reduce((a, i) => a + (s.landmarks[i]?.samples ?? (s.landmarks[i] ? 1 : 0)), 0);
    const prim = PROFILE_PRIMARY[s.profile];
    const conf = prim.reduce((a, id) => a + (s.measurements[id]?.status === "conflicted" ? 0 : s.measurements[id]?.confidence ?? 0), 0) / prim.length;
    return { captured, total: ids.size, samples, established: conf };
  }

  // ── per-frame ──────────────────────────────────────────────────────────────
  update(dt: number, f: TrackingFrame, uiHover: { left: boolean; right: boolean }) {
    this.t += dt;
    this.frame = f;
    this.toastT = Math.max(0, this.toastT - dt);
    this.logTracking(f);
    if (this.screen === "boot") {
      this.bootT += dt;
      if (this.bootT > 2.6) this.screen = this.settings.tutorialDone ? "home" : "tutorial";
    }
    const edge = (k: string, v: boolean) => {
      const was = this.prevButtons[k];
      this.prevButtons[k] = v;
      return v && !was;
    };
    const A = edge("A", !!f.right?.primary);
    const X = edge("X", !!f.left?.primary);
    const B = edge("B", !!f.right?.secondary);
    const Y = edge("Y", !!f.left?.secondary);
    const heldThumb = !!f.right?.primary || !!f.left?.primary;
    const heldTrigger = ((f.right?.trigger ?? 0) > 0.6 && !uiHover.right) || ((f.left?.trigger ?? 0) > 0.6 && !uiHover.left);
    const held = heldThumb || heldTrigger;

    if (this.modal) {
      if (B || Y) this.modal = null;
      return;
    }
    if (this.screen === "capture" && this.session) {
      const s = this.session;
      const before = s.phase;
      if (s.phase === "review") {
        if (A) this.acceptCapture(false);
        else if (X) this.acceptCapture(true);
        else if (B || Y) s.retake();
      } else s.update(f, held && !this.prevButtons.blockHold);
      if (before !== "review" && s.phase === "review") {
        this.buzz("right", 0.8, 60);
        this.buzz("left", 0.8, 60);
        this.prevButtons.blockHold = true;
      }
      if (!held) this.prevButtons.blockHold = false;
      if (s.phase === "holding") this.buzz("right", 0.08 + 0.3 * s.progress, 16);
      return;
    }
    if (this.screen === "studio") {
      this.updateStudio(dt, f, held && !this.prevButtons.blockHold);
      if (!held) this.prevButtons.blockHold = false;
    }
    if (this.screen === "tutorial" && (A || X)) this.nextTutorial();
    if (B || Y) {
      if (this.screen === "tutorial") this.tutorialPage = Math.max(0, this.tutorialPage - 1);
      else if (this.screen !== "home" && this.screen !== "boot") this.screen = "home";
      else if (this.screen === "home") this.modal = "exit";
    }
  }

  private nextTutorial() {
    if (this.tutorialPage < TUTORIAL.length - 1) this.tutorialPage++;
    else {
      this.applySettings({ tutorialDone: true });
      this.tutorialPage = 0;
      this.screen = "home";
    }
  }

  private logTracking(f: TrackingFrame) {
    for (const [k, tracked] of [["left", f.left?.aim?.tracked], ["right", f.right?.aim?.tracked], ["head", f.head?.tracked]] as const) {
      const prev = this.lastTracked[k];
      const now = !!tracked;
      if (prev === undefined && now) this.trackingLog.push({ t: new Date().toISOString(), device: k, event: "connected" });
      else if (prev !== undefined && prev !== now) this.trackingLog.push({ t: new Date().toISOString(), device: k, event: now ? "recovered" : "lost" });
      this.lastTracked[k] = now;
    }
    if (this.trackingLog.length > 500) this.trackingLog.splice(0, 100);
  }

  private acceptCapture(refine: boolean) {
    const s = this.session!;
    if (refine) s.acceptAndRefine();
    else s.accept();
    this.hooks.saveDraft(s.snapshot());
    if (s.phase === "done") this.finish();
  }

  private finish() {
    void this.save();
    this.hooks.saveDraft(null);
    this.screen = "results";
  }

  private updateStudio(dt: number, f: TrackingFrame, held: boolean) {
    const off = this.session?.calibration.tipOffsetM ?? 0;
    const a = tipPoint(f.left, off);
    const b = tipPoint(f.right, off);
    const st = this.studio;
    st.stab.push(f.t, [a, b]);
    st.flash = Math.max(0, st.flash - dt);
    const r = st.stab.report();
    if (held && r.stable) {
      st.progress = Math.min(1, st.progress + (dt * 1000) / CAPTURE_CONFIG.holdMs);
      if (st.progress >= 1) {
        const vr = mToMm(distance(r.median[0]!, r.median[1]!));
        const la = f.left?.aim ? forwardOf(f.left.aim.orientation) : null;
        const ra = f.right?.aim ? forwardOf(f.right.aim.orientation) : null;
        const ang = la && ra ? Math.round((Math.acos(Math.max(-1, Math.min(1, dot(la, ra)))) * 180) / Math.PI) : 0;
        st.readings.push({ timestamp: new Date().toISOString(), vrMm: vr, refMm: null, orientation: `tips ${ang}° apart`, spreadMm: mToMm(Math.max(...r.spreadM)), tipCalibrated: !!this.session?.calibration.tipCalibrated });
        this.hooks.saveStudio(st.readings);
        this.buzz("right", 0.8, 60);
        st.progress = 0;
        st.flash = 0.6;
        this.prevButtons.blockHold = true;
      }
    } else st.progress = 0;
  }

  /** X/Y/Z components of a→b in the body frame (or world if not yet set). */
  axes(a: Vec3, b: Vec3): { x: number; y: number; z: number } {
    const d = sub(b, a);
    const f = this.session?.calibration.bodyFrame;
    if (!f) return { x: Math.abs(mToMm(d.x)), y: Math.abs(mToMm(d.y)), z: Math.abs(mToMm(d.z)) };
    return { x: Math.abs(mToMm(dot(d, f.lateral))), y: Math.abs(mToMm(dot(d, f.up))), z: Math.abs(mToMm(dot(d, f.forward))) };
  }
  private axesText(a: Vec3, b: Vec3) {
    const x = this.axes(a, b);
    const u = this.units;
    const n = (mm: number) => formatMm(mm, u).replace(` ${u}`, "");
    return `X ${n(x.x)}  Y ${n(x.y)}  Z ${n(x.z)} ${u.toUpperCase()}`;
  }

  // ── beam data for the scene ────────────────────────────────────────────────
  beamInfo(): { a: Vec3 | null; b: Vec3 | null; state: "idle" | "live" | "stable" | "holding" | "captured" | "lost"; progress: number; readout: string; sub: string; axes: string } | null {
    const f = this.frame;
    if (!f || this.modal) return null;
    const s = this.session;
    const off = s?.calibration.tipOffsetM ?? 0;
    const fmt = (mm: number) => formatMm(mm, this.units);
    if (this.screen === "studio") {
      const a = tipPoint(f.left, off);
      const b = tipPoint(f.right, off);
      const r = this.studio.stab.report();
      const lost = !a || !b;
      const d = a && b ? mToMm(distance(a, b)) : NaN;
      return {
        a, b, progress: this.studio.progress,
        state: this.studio.flash > 0 ? "captured" : lost ? "lost" : this.studio.progress > 0 ? "holding" : r.stable ? "stable" : "live",
        readout: lost ? "NO TRACK" : fmt(d),
        sub: lost ? "KEEP CONTROLLERS IN VIEW" : r.stable ? `STABLE · ±${mToMm(Math.max(...r.spreadM)).toFixed(1)} MM` : "HOLD STILL",
        axes: a && b && this.settings.showAxes ? this.axesText(a, b) : "",
      };
    }
    if (this.screen !== "capture" || !s?.step) return null;
    const step = s.step;
    const pts = s.currentPoints(f);
    const rep = s.lastReport;
    const lost = pts.some((p) => !p);
    const state = s.phase === "review" ? "captured" : lost ? "lost" : s.phase === "holding" ? "holding" : rep?.stable ? "stable" : "live";
    const spread = rep ? Math.max(...rep.spreadM.filter(Number.isFinite), 0) : 0;
    const sub = lost ? "TRACKING LOST" : s.phase === "review" ? "CAPTURED · A ACCEPT · X +SAMPLE · B RETAKE" : rep?.stable ? `STABLE · ±${mToMm(spread).toFixed(1)} MM` : rep?.reason === "filling" ? "ACQUIRING" : "HOLD STILL";
    if (step.kind === "stance") return null;
    let readout = "—";
    let axes = "";
    let a = pts[0] ?? null;
    let b = pts[1] ?? null;
    if (step.kind === "tip-calibration") {
      if (a && b) readout = fmt(mToMm(distance(a, b)));
    } else if (pts.length === 2 && a && b) {
      const frame = s.calibration.bodyFrame;
      const both = step.points.map((p) => p.landmark).join(" ");
      const lateral = /side|acromion_l/.test(both) && frame;
      const forward = /front|back|nape/.test(both) && frame;
      const ax = this.axes(a, b);
      readout = fmt(lateral ? ax.x : forward ? ax.z : step.id === "foot" ? Math.hypot(ax.x, ax.z) : mToMm(distance(a, b)));
      if (this.settings.showAxes) axes = this.axesText(a, b);
    } else if (pts.length === 1 && a) {
      const prevId = step.sequentialWith ? STEPS.find((x) => x.id === step.sequentialWith)?.points[0]?.landmark : undefined;
      if (prevId && s.landmarks[prevId]) {
        b = a;
        a = s.landmarks[prevId].position;
        readout = fmt(mToMm(distance(a, b)));
        if (this.settings.showAxes) axes = this.axesText(a, b);
      } else {
        readout = s.calibration.floorY !== null ? fmt(mToMm(a.y - s.calibration.floorY)) : fmt(mToMm(a.y));
        if (this.settings.showAxes) axes = step.kind === "floor" ? "GROUND PLANE" : "Y HEIGHT ABOVE GROUND";
      }
    }
    return { a, b, state, progress: s.progress, readout: lost ? "NO TRACK" : readout, sub, axes };
  }

  /** What the floating controller hint card should show (Figma controller art + lit button). */
  hintSpec(side: "left" | "right"): HintSpec {
    if (!this.settings.controllerHints || this.modal) return null;
    const s = this.session;
    if (this.screen === "capture" && s?.step) {
      if (s.phase === "review") {
        return side === "right"
          ? { states: { r_a: "press", r_b: "hover" }, labels: { r_a: "ACCEPT", r_b: "RETAKE" }, caption: "A accept · B retake" }
          : { states: { l_x: "press", l_y: "hover" }, labels: { l_x: "+ SAMPLE", l_y: "RETAKE" }, caption: "X add a sample" };
      }
      const holding = s.phase === "holding";
      const stable = s.lastReport?.stable;
      return side === "right"
        ? { states: { r_a: holding ? "hold" : stable ? "hover" : "idle" }, labels: { r_a: holding ? "HOLD…" : "HOLD A" }, caption: holding ? "Keep still…" : stable ? "Hold A to capture" : "Place the tip" }
        : { states: { l_x: holding ? "hold" : stable ? "hover" : "idle" }, labels: { l_x: holding ? "HOLD…" : "HOLD X" }, caption: holding ? "Keep still…" : stable ? "or hold X" : "Place the tip" };
    }
    if (this.screen === "studio") return side === "right" ? { states: { r_a: this.studio.progress > 0 ? "hold" : "hover" }, labels: { r_a: "HOLD A" }, caption: "Hold A to log a reading" } : null;
    if (this.screen === "tutorial") return side === "right" ? { states: { r_a: "hover", r_trigger: "hover" }, labels: { r_a: "NEXT", r_trigger: "SELECT" }, caption: "A next · trigger select" } : { states: { l_y: "hover" }, labels: { l_y: "BACK" }, caption: "Y back" };
    return null;
  }

  highlightLandmarks(): string[] {
    const s = this.session;
    if (this.screen === "capture" && s?.step) return s.step.points.map((p) => p.landmark);
    if (this.screen === "editor" && this.editor.sel) return this.session?.measurements[this.editor.sel]?.sources ?? [];
    return [];
  }

  // ── drawing ────────────────────────────────────────────────────────────────
  draw() {
    const s = this.session;
    const f = this.frame;
    const trk = `${!!f?.left?.aim?.tracked}${!!f?.right?.aim?.tracked}${!!f?.head?.tracked}`;
    const sig = [this.screen, this.modal, this.tutorialPage, this.screen === "boot" ? Math.floor(this.bootT * 24) : this.screen === "tutorial" && this.tutorialPage === 2 ? Math.floor(this.t * 6) : 0, trk, JSON.stringify(this.settings), JSON.stringify(this.subject),
      this.toastT > 0 ? this.toast : "", s?.index, s?.phase, s?.message, s?.refining, s?.lastReport?.reason, Math.round((s?.progress ?? 0) * 20),
      Object.values(s?.measurements ?? {}).map((m) => m.id + m.value.toFixed(1) + m.status + m.method).join(), Object.keys(s?.landmarks ?? {}).length,
      this.editor.sel, this.editor.page, this.studio.readings.length, this.studio.keypad, this.studio.readings.at(-1)?.refMm, this.latest?.updatedAt].join("|");
    this.panel.draw(sig, (g) => {
      g.chrome(true);
      if (this.screen !== "boot") this.drawStatus(g);
      const scr: Record<Screen, () => void> = {
        boot: () => this.drawBoot(g), tutorial: () => this.drawTutorial(g), home: () => this.drawHome(g), about: () => this.drawAbout(g), settings: () => this.drawSettings(g),
        steps: () => this.drawSteps(g), capture: () => this.drawCapture(g), studio: () => this.drawStudio(g), editor: () => this.drawEditor(g), results: () => this.drawResults(g), fit: () => this.drawFit(g),
      };
      scr[this.screen]();
      if (this.toastT > 0) {
        const c = g.ctx;
        // toast lives in the header strip (between the wordmark and the tracking pills) so it never covers content
        c.fillStyle = "rgba(13,11,8,0.95)";
        c.beginPath();
        c.roundRect(W / 2 - 330, 28, 660, 64, 32);
        c.fill();
        c.strokeStyle = T.success;
        c.lineWidth = 3;
        c.stroke();
        g.text("✓  " + this.toast, W / 2, 71, { size: 28, weight: 600, color: T.success, align: "center", maxW: 620 });
      }
      if (this.modal) this.drawModal(g);
    });
  }

  private drawStatus(g: CanvasPanel) {
    const f = this.frame;
    g.image(this.hooks.images.star, 48, 36, 52, 52);
    g.text("VITRUVIAN", 116, 76, { size: 34, weight: 700, font: "display", italic: true, color: T.gold, spacing: 3 });
    const items: [string, boolean | undefined][] = [["L", f?.left?.aim?.tracked], ["R", f?.right?.aim?.tracked], ["HMD", f?.head?.tracked]];
    let x = W - 60;
    for (const [lbl, ok] of [...items].reverse()) {
      const color = ok ? T.success : T.ember;
      g.text(lbl, x, 74, { size: 26, weight: 700, color, align: "right", spacing: 2 });
      const w = g.ctx.measureText(lbl).width;
      g.ctx.fillStyle = color;
      g.ctx.beginPath();
      g.ctx.arc(x - w - 18, 65, 7, 0, Math.PI * 2);
      g.ctx.fill();
      x -= w + 56;
    }
    if (this.simulated) g.text("SIMULATOR — NOT REAL TRACKING", x - 10, 74, { size: 24, weight: 700, color: T.ember, align: "right", spacing: 2 });
    g.divider(40, 108, W - 80);
  }

  private drawBoot(g: CanvasPanel) {
    const t = this.bootT;
    const c = g.ctx;
    const k = Math.min(1, t / 1.2);
    const ease = 1 - (1 - k) ** 3;
    const size = 140 + 80 * ease;
    c.save();
    c.shadowColor = "rgba(255,120,0,0.6)";
    c.shadowBlur = 50 * ease;
    g.image(this.hooks.images.star, W / 2 - size / 2, 300 - size / 2, size, size, Math.min(1, t / 0.5));
    c.restore();
    const wk = Math.max(0, Math.min(1, (t - 0.8) / 0.8));
    g.image(this.hooks.images.wordmark, W / 2 - 330, 470, 660, 173, wk);
    const word = "VITRUVIAN";
    const n = Math.floor(Math.max(0, Math.min(1, (t - 1.4) / 0.8)) * word.length);
    g.text(word.slice(0, n), W / 2, 760, { size: 72, weight: 700, font: "display", italic: true, color: T.gold, align: "center", spacing: 18 });
    // corner reticles converge (HUD target-lock motif)
    const r = 1 - Math.min(1, t / 2);
    c.strokeStyle = `rgba(255,198,26,${0.25 + 0.5 * (1 - r)})`;
    c.lineWidth = 4;
    const m = 120 + 200 * r;
    const L = 70;
    poly(c, [[m, 200 + L], [m, 200], [m + L, 200]]);
    poly(c, [[W - m - L, 200], [W - m, 200], [W - m, 200 + L]]);
    poly(c, [[m, 840 - L], [m, 840], [m + L, 840]]);
    poly(c, [[W - m - L, 840], [W - m, 840], [W - m, 840 - L]]);
    g.progressBar(W / 2 - 300, 880, 600, Math.min(1, t / 2.5));
    g.text("Calibrating spatial instrument…", W / 2, 950, { size: 28, color: T.text3, align: "center" });
  }

  private drawTutorial(g: CanvasPanel) {
    const p = this.tutorialPage;
    const page = TUTORIAL[p];
    g.label(`Tutorial · ${p + 1} / ${TUTORIAL.length}`, 64, 168, T.gold);
    for (let i = 0; i < TUTORIAL.length; i++) {
      g.ctx.fillStyle = i <= p ? T.gold : "rgba(255,246,230,0.15)";
      g.ctx.fillRect(64 + i * 120, 186, 110, 6);
    }
    g.text(page.title, 64, 280, { size: 60, weight: 700, font: "display", italic: true, color: T.gold });
    let y = 350;
    for (const l of page.lines) {
      g.text("◆", 64, y + 2, { size: 24, color: T.gold });
      y = g.para(l, 104, y, 760, { size: 32, color: T.text, lh: 44 }) + 10;
    }
    const c = g.ctx;
    const ox = 1060;
    if (p === 0) {
      // two tips + beam + XYZ gizmo (axis colours from the design system: X ember, Y gold, Z info)
      c.strokeStyle = T.gold;
      c.lineWidth = 5;
      c.shadowColor = T.gold;
      c.shadowBlur = 16;
      c.beginPath();
      c.moveTo(ox, 520);
      c.lineTo(ox + 420, 430);
      c.stroke();
      c.shadowBlur = 0;
      for (const [x, y2] of [[ox, 520], [ox + 420, 430]]) {
        c.fillStyle = "#FFF6E6";
        c.beginPath();
        c.arc(x, y2, 10, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = T.gold;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(x, y2, 24, 0, Math.PI * 2);
        c.stroke();
      }
      g.text("43.0 cm", ox + 150, 440, { size: 48, weight: 600, font: "display", color: T.gold });
      const gx = ox + 120;
      const gy = 800;
      const axis = (dx: number, dy: number, col: string, lbl: string) => {
        c.strokeStyle = col;
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(gx, gy);
        c.lineTo(gx + dx, gy + dy);
        c.stroke();
        g.text(lbl, gx + dx * 1.18, gy + dy * 1.18 + 12, { size: 32, weight: 700, color: col, align: "center" });
      };
      axis(180, 0, T.ember, "X");
      axis(0, -180, T.gold, "Y");
      axis(-110, 90, T.info, "Z");
      g.text("left–right · up–down · front–back", gx + 40, gy + 150, { size: 24, color: T.text3, align: "center" });
    } else if (p === 1) {
      // the Figma design's Touch Plus artwork (QuestController.tsx), measuring tips marked
      drawControllers(c, 900, 300, 640, { side: "both", showAllLabels: true, tip: true, states: { l_trigger: "hover", r_trigger: "hover" }, time: this.t });
      g.text("◆ MEASURING TIPS — the gold dots in the headset", 1220, 740, { size: 26, weight: 700, color: T.gold, align: "center" });
      g.text("Left hand", 1030, 284, { size: 24, color: T.text3, align: "center" });
      g.text("Right hand", 1410, 284, { size: 24, color: T.text3, align: "center" });
    } else if (p === 2) {
      const rows: [string, string, string][] = [
        ["A", "Hold A (or X)", "Capture — fills only while you hold still"],
        ["A", "Press A after a capture", "Accept and go on"],
        ["X", "Press X after a capture", "Add a sample of the same point"],
        ["B", "B (or Y)", "Retake · back · close"],
        ["trigger", "Trigger at a panel", "Select a button"],
        ["stick", "Click a thumbstick", "Bring the panels in front of you"],
      ];
      rows.forEach(([gl, a, b2], i) => {
        const yy = 350 + i * 86;
        glyph(c, gl, 90, yy - 12, T.gold);
        g.text(a, 140, yy, { size: 30, weight: 600, color: T.text });
        g.text(b2, 140, yy + 34, { size: 24, color: T.text2, maxW: 760 });
      });
      drawControllers(c, 920, 330, 620, { side: "both", time: this.t, states: { r_a: "hold", l_x: "press", r_b: "hover", l_y: "hover", r_trigger: "hover", l_trigger: "hover", r_stick: "hover", l_stick: "hover" }, labels: { r_a: "A · CAPTURE", l_x: "X · +SAMPLE", r_b: "B · BACK", l_y: "Y · BACK", r_trigger: "SELECT", l_trigger: "SELECT" } });
      g.text("The Meta and Menu buttons are reserved by the system.", 64, 900, { size: 24, color: T.text3 });
    } else if (p === 3) {
      c.strokeStyle = T.gold;
      c.lineWidth = 3;
      c.setLineDash([14, 10]);
      c.beginPath();
      c.ellipse(ox + 220, 640, 260, 90, 0, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      g.text("1.5 m clear", ox + 220, 780, { size: 30, weight: 600, color: T.gold, align: "center" });
      c.fillStyle = T.gold;
      c.beginPath();
      c.arc(ox + 220, 640, 12, 0, Math.PI * 2);
      c.fill();
      g.text("stay on this spot", ox + 220, 610, { size: 24, color: T.text2, align: "center" });
    }
    g.button("tback", { x: 64, y: 920, w: 240, h: 80 }, "Back", () => (this.tutorialPage = Math.max(0, p - 1)), { variant: "ghost", disabled: p === 0 });
    g.button("tskip", { x: 320, y: 920, w: 300, h: 80 }, "Skip tutorial", () => {
      this.applySettings({ tutorialDone: true });
      this.screen = "home";
    }, { variant: "ghost" });
    g.button("tnext", { x: 1140, y: 920, w: 400, h: 80 }, p === TUTORIAL.length - 1 ? "Start measuring" : "Next", () => this.nextTutorial(), { variant: "primary", glyph: "A", size: 32 });
  }

  private pointsMeter(g: CanvasPanel, x: number, y: number, w: number) {
    const pi = this.pointsInfo();
    g.label("Body model", x, y);
    const narrow = w < 560;
    g.text(`${pi.captured} / ${pi.total} points`, x, y + 46, { size: narrow ? 30 : 34, weight: 600, color: T.text });
    g.text(`${Math.round(pi.established * 100)}% established`, x + w, y + (narrow ? 14 : 46), { size: narrow ? 24 : 28, weight: 600, color: T.gold, align: "right" });
    g.progressBar(x, y + 64, w, pi.total ? pi.captured / pi.total : 0, T.amber);
    g.progressBar(x, y + 84, w, pi.established, T.gold);
    if (pi.samples > pi.captured) g.text(`${pi.samples} samples averaged`, x, y + 126, { size: 22, color: T.text3 });
  }

  private drawHome(g: CanvasPanel) {
    g.image(this.hooks.images.wordmark, 60, 140, 400, 105);
    g.text("Body Measurement Instrument", 64, 296, { size: 38, weight: 500, color: T.text2 });
    g.para("Measure once. Your Body Passport powers your avatar, virtual try-on and clothing made for your proportions.", 64, 350, 740, { size: 30, color: T.text3 });
    const card = (id: string, x: number, y: number, title: string, sub: string, onClick: () => void, primary = false) => {
      g.button(id, { x, y, w: 680, h: 116 }, "", onClick, { variant: primary ? "primary" : "secondary" });
      g.text(title, x + 32, y + 52, { size: 40, weight: 700, color: primary ? T.panel : T.text, font: "display", italic: true });
      g.text(sub, x + 32, y + 92, { size: 24, weight: 600, color: primary ? "#3a2c08" : T.text3, maxW: 620 });
    };
    const s = this.session;
    const resumable = !!s && s.phase !== "done" && s.index > 0;
    const modes: ProfileKind[] = ["simple", "intermediate", "ultra"];
    modes.forEach((k, i) => {
      const resume = resumable && s!.profile === k;
      const info = PROFILE_INFO[k];
      card(k, 860, 140 + i * 128, (resume ? "RESUME " : "") + info.title.toUpperCase(), resume ? `Continue at step ${s!.index + 1} / ${s!.steps.length}` : `${bodyPointsFor(k)} body points · ${info.blurb.split(" · ").slice(1).join(" · ")} · ~${info.minutes} min`, () => (resume ? (this.screen = "capture") : this.startProfile(k)), i === 0);
    });
    card("studio", 860, 524, "MEASUREMENT STUDIO", "Live tip-to-tip · ruler validation", () => {
      this.studio.stab.reset();
      this.screen = "studio";
    });
    card("editor", 860, 652, "BODY PASSPORT", this.latest ? `Saved ${this.latest.updatedAt.slice(0, 10)} · ${this.latest.measurements.length} values` : s ? "Current session" : "No passport yet", () => (this.screen = s ? "editor" : "home"));
    if (s) this.pointsMeter(g, 64, 470, 740);
    else g.para("Start with Simple (10 points). Upgrade to Intermediate or Ultra later — your points are kept, and every extra point makes your model more established.", 64, 500, 740, { size: 28, color: T.text2 });
    const small: [string, string, () => void][] = [
      ["about", "About you", () => (this.screen = "about")],
      ["settings", "Settings", () => (this.screen = "settings")],
      ["tutorial", "Tutorial", () => {
        this.tutorialPage = 0;
        this.screen = "tutorial";
      }],
      ["exit", "Exit", () => (this.modal = "exit")],
    ];
    small.forEach(([id, l, fn], i) => g.button(id, { x: 64 + i * 192, y: 800, w: 180, h: 80 }, l, fn, { variant: id === "exit" ? "ghost" : "secondary", size: 28 }));
    g.button("steps", { x: 860, y: 790, w: 680, h: 72 }, "Step map", () => (this.screen = s ? "steps" : "home"), { variant: "ghost", disabled: !s, size: 30 });
    this.hint(g, 64, 960, [["trigger", "Select"], ["A", "Capture / next"], ["X", "+Sample"], ["B", "Back"], ["stick", "Recenter"]]);
  }

  private segmented(g: CanvasPanel, id: string, x: number, y: number, w: number, opts: string[], sel: number, on: (i: number) => void, h = 72) {
    const bw = w / opts.length;
    opts.forEach((o, i) => g.button(`${id}${i}`, { x: x + i * bw + 4, y, w: bw - 8, h }, o, () => on(i), { variant: i === sel ? "primary" : "secondary", size: 26 }));
  }

  private stepper(g: CanvasPanel, id: string, x: number, y: number, value: string, steps: [string, () => void][]) {
    const left = steps.slice(0, steps.length / 2);
    const right = steps.slice(steps.length / 2);
    left.forEach(([l, fn], i) => g.button(`${id}m${i}`, { x: x + i * 110, y, w: 100, h: 72 }, l, fn, { size: 26 }));
    const vx = x + left.length * 110 + 10;
    g.ctx.fillStyle = T.surface;
    g.ctx.beginPath();
    g.ctx.roundRect(vx, y, 240, 72, 16);
    g.ctx.fill();
    g.text(value, vx + 120, y + 50, { size: 36, weight: 600, font: "display", color: T.gold, align: "center" });
    right.forEach(([l, fn], i) => g.button(`${id}p${i}`, { x: vx + 250 + i * 110, y, w: 100, h: 72 }, l, fn, { size: 26 }));
  }

  private drawAbout(g: CanvasPanel) {
    const sj = this.subject;
    const set = (p: Partial<Subject>) => {
      this.subject = { ...this.subject, ...p };
      this.hooks.saveSubject(this.subject);
    };
    g.text("ABOUT YOU", 64, 200, { size: 60, weight: 700, font: "display", italic: true, color: T.gold });
    g.text("All optional · used for body composition, avatar and shoes · stays on this headset", 64, 246, { size: 26, color: T.text3 });
    const w = sj.weightKg ?? 70;
    g.label("Weight", 64, 318);
    this.stepper(g, "wt", 64, 334, sj.weightKg ? `${w.toFixed(1)} kg` : "— kg", [
      ["−1", () => set({ weightKg: Math.max(25, w - 1) })], ["−0.1", () => set({ weightKg: Math.max(25, +(w - 0.1).toFixed(1)) })],
      ["+0.1", () => set({ weightKg: Math.min(350, +(w + 0.1).toFixed(1)) })], ["+1", () => set({ weightKg: Math.min(350, w + 1) })],
    ]);
    const age = sj.ageYears ?? 30;
    g.label("Age", 64, 450);
    this.stepper(g, "age", 64, 466, sj.ageYears ? `${age} y` : "—", [["−1", () => set({ ageYears: Math.max(13, age - 1) })], ["+1", () => set({ ageYears: Math.min(110, age + 1) })]]);
    g.label("Sex (only for the body-fat equation)", 64, 582);
    const sexes: Sex[] = ["female", "male", "unspecified"];
    this.segmented(g, "sex", 64, 598, 700, ["Female", "Male", "Prefer not to say"], sexes.indexOf(sj.sex ?? "unspecified"), (i) => set({ sex: sexes[i] }));
    const sys: ShoeSystem = sj.shoe?.system ?? "EU";
    const measuredFoot = this.session?.measurements.foot_length?.value;
    const size = sj.shoe?.size ?? (measuredFoot ? sizeFromFootLength(sys, measuredFoot) : sys === "EU" ? 42 : sys === "Mondopoint" ? 265 : 9);
    const setShoe = (system: ShoeSystem, sz: number) => set({ shoe: { system, size: sz, footLengthMm: footLengthFromSize(system, sz), converted: true } });
    g.label("Shoe size", 860, 318);
    this.segmented(g, "shoesys", 860, 334, 680, ["EU", "UK", "US M", "US W", "mm"], SHOE_SYSTEMS.indexOf(sys), (i) => setShoe(SHOE_SYSTEMS[i], sizeFromFootLength(SHOE_SYSTEMS[i], sj.shoe?.footLengthMm ?? measuredFoot ?? 265)));
    const stepSz = sys === "Mondopoint" ? 5 : 0.5;
    this.stepper(g, "shoe", 860, 430, sj.shoe ? `${size}` : "—", [["−", () => setShoe(sys, +(size - stepSz).toFixed(1))], ["+", () => setShoe(sys, +(size + stepSz).toFixed(1))]]);
    g.text(sj.shoe ? `≈ foot length ${(sj.shoe.footLengthMm / 10).toFixed(1)} cm (approximate conversion)` : "Or measure your foot in Precision Fit", 860, 548, { size: 24, color: T.text3 });
    if (measuredFoot) g.text(`Measured foot ${(measuredFoot / 10).toFixed(1)} cm → EU ${sizeFromFootLength("EU", measuredFoot)} · UK ${sizeFromFootLength("UK", measuredFoot)} · US M ${sizeFromFootLength("US-M", measuredFoot)}`, 860, 584, { size: 24, color: T.gold });
    const comp = this.passport()?.composition;
    g.label("Body composition (estimates)", 860, 660);
    if (comp?.bmi) {
      g.text(`BMI ${comp.bmi.value.toFixed(1)} · ${comp.bmiCategory}`, 860, 706, { size: 32, weight: 600, color: T.text });
      if (comp.bodyFatPct) g.text(`Body fat ${comp.bodyFatPct.value.toFixed(1)} % ±${comp.bodyFatPct.uncertainty}`, 860, 750, { size: 28, color: T.text2 });
      if (comp.ffmiNormalized) g.text(`Muscle index FFMI ${comp.ffmiNormalized.value.toFixed(1)} · lean ${comp.leanMassKg!.value.toFixed(1)} kg`, 860, 790, { size: 28, color: T.text2 });
    } else g.para("Enter your weight and measure your height to see BMI. Add sex + neck/waist/hip for body-fat and muscle estimates.", 860, 706, 680, { size: 26, color: T.text3 });
    g.button("aboutdone", { x: 64, y: 900, w: 360, h: 84 }, "Done", () => (this.screen = "home"), { variant: "primary" });
    g.button("aboutclear", { x: 444, y: 900, w: 320, h: 84 }, "Clear all", () => {
      this.subject = {};
      this.hooks.saveSubject(this.subject);
    }, { variant: "ghost" });
  }

  private drawSettings(g: CanvasPanel) {
    const st = this.settings;
    g.text("SETTINGS", 64, 200, { size: 60, weight: 700, font: "display", italic: true, color: T.gold });
    const row = (y: number, label: string, help: string, opts: string[], sel: number, on: (i: number) => void) => {
      g.text(label, 64, y + 44, { size: 32, weight: 600, color: T.text });
      g.text(help, 64, y + 78, { size: 22, color: T.text3, maxW: 560 });
      this.segmented(g, label, 640, y + 6, 900, opts, sel, on, 68);
    };
    const units: LengthUnit[] = ["cm", "mm", "in"];
    row(230, "Units", "Display only — the passport is always mm", ["cm", "mm", "in"], units.indexOf(st.units), (i) => this.applySettings({ units: units[i] }));
    const holds = [600, 900, 1500];
    row(330, "Capture hold", "How long to hold still before a point is taken", ["0.6 s", "0.9 s", "1.5 s"], holds.indexOf(st.holdMs), (i) => this.applySettings({ holdMs: holds[i] }));
    row(430, "Stability", "Allowed jitter while holding (relaxed for shaky hands)", ["Standard 2 mm", "Relaxed 3 mm"], st.relaxed ? 1 : 0, (i) => this.applySettings({ relaxed: i === 1 }));
    const twins: TwinMode[] = ["lines", "hologram", "skin"];
    row(530, "Your twin", "How your measured body is shown", ["Gold lines", "Hologram", "Skin tone"], twins.indexOf(st.twin), (i) => this.applySettings({ twin: twins[i] }));
    const dists: Settings["panelDistance"][] = ["near", "normal", "far", "large"];
    row(630, "Panel", "Distance, or Large for bigger text", ["Near", "Normal", "Far", "Large"], dists.indexOf(st.panelDistance), (i) => this.applySettings({ panelDistance: dists[i] }));
    row(730, "Haptics · XYZ · hints", "Vibration · axis readout · button hints above the controllers", ["Haptics on", "Haptics off", st.showAxes ? "XYZ on" : "XYZ off", st.controllerHints ? "Hints on" : "Hints off"], st.haptics ? 0 : 1, (i) => (i === 2 ? this.applySettings({ showAxes: !st.showAxes }) : i === 3 ? this.applySettings({ controllerHints: !st.controllerHints }) : this.applySettings({ haptics: i === 0 })));
    g.button("setdone", { x: 64, y: 900, w: 300, h: 84 }, "Done", () => (this.screen = "home"), { variant: "primary" });
    g.button("tut", { x: 384, y: 900, w: 340, h: 84 }, "Replay tutorial", () => {
      this.tutorialPage = 0;
      this.screen = "tutorial";
    });
    g.button("reset", { x: 744, y: 900, w: 380, h: 84 }, "Start a new session", () => (this.modal = "reset"), { variant: "destructive" });
  }

  private drawSteps(g: CanvasPanel) {
    const s = this.session!;
    g.text("STEP MAP", 64, 200, { size: 56, weight: 700, font: "display", italic: true, color: T.gold });
    g.text(`${PROFILE_INFO[s.profile].title} · tap any step to (re)capture it · ✓ = captured · points ${s.totalSamples()} / ${POINT_CAP[s.profile]}`, 64, 246, { size: 26, color: T.text3 });
    const cols = s.steps.length > 22 ? 3 : 2;
    const per = Math.ceil(s.steps.length / cols);
    const colW = cols === 3 ? 500 : 760;
    const rowH = s.steps.length > 33 ? 40 : 54;
    let lastSec = "";
    const y = [290, 290, 290];
    s.steps.forEach((st, i) => {
      const c = Math.floor(i / per);
      const x = 64 + c * colW;
      if (st.section !== lastSec) {
        lastSec = st.section;
        g.label(st.section, x, y[c] + 12, T.gold);
        y[c] += rowH < 50 ? 18 : 24;
      }
      const done = this.stepDone(st);
      const cur = i === s.index;
      g.button("st" + st.id, { x, y: y[c], w: colW - 40, h: rowH - 2 }, "", () => {
        s.goTo(i);
        this.screen = "capture";
      }, { variant: cur ? "secondary" : "ghost" });
      const fs = rowH < 50 ? 22 : 27;
      g.text(done ? "✓" : cur ? "▶" : "○", x + 22, y[c] + rowH * 0.68, { size: fs, weight: 700, color: done ? T.success : cur ? T.gold : T.text3 });
      g.text(`${i + 1}. ${st.title}`, x + 54, y[c] + rowH * 0.68, { size: fs, color: done ? T.text : T.text2, maxW: colW - 150 });
      const n = st.points.reduce((a, p) => a + (s.landmarks[p.landmark]?.samples ?? 0), 0);
      if (n > st.points.length) g.text(`${n}×`, x + colW - 50, y[c] + rowH * 0.68, { size: 20, color: T.text3, align: "right" });
      y[c] += rowH;
    });
    g.button("stback", { x: 64, y: 950, w: 300, h: 70 }, "Back", () => (this.screen = s.phase === "done" ? "results" : "capture"), { variant: "ghost" });
    const next: ProfileKind | null = s.profile === "simple" ? "intermediate" : s.profile === "intermediate" ? "ultra" : null;
    g.button("stprec", { x: 384, y: 950, w: 520, h: 70 }, next ? `Upgrade to ${PROFILE_INFO[next].title} (keeps your points)` : "Ultra — the full tailoring set", () => {
      if (!next) return;
      const keep = s;
      const ns = new CaptureSession(next);
      Object.assign(ns, { calibration: keep.calibration, landmarks: keep.landmarks, manual: keep.manual, locked: keep.locked, captures: keep.captures, tipSamples: keep.tipSamples });
      ns.recompute();
      ns.goTo(Math.max(0, ns.steps.findIndex((x) => !this.stepDoneFor(ns, x))));
      this.session = ns;
    }, { variant: "ghost", disabled: !next, size: 26 });
  }

  private stepDoneFor(s: CaptureSession, st: CaptureStep): boolean {
    if (st.kind === "floor") return s.calibration.floorCalibrated;
    if (st.kind === "stance") return s.calibration.bodyOriginEstablished;
    if (st.kind === "tip-calibration") return s.calibration.tipCalibrated;
    return st.points.every((p) => s.landmarks[p.landmark]);
  }
  private stepDone(st: CaptureStep): boolean {
    return this.stepDoneFor(this.session!, st);
  }

  private drawCapture(g: CanvasPanel) {
    const s = this.session!;
    const step = s.step;
    if (!step) {
      this.screen = "results";
      return;
    }
    const n = s.steps.length;
    g.label(`Step ${s.index + 1} / ${n} · ${step.section} · ${PROFILE_INFO[s.profile].title}`, 64, 168, T.gold);
    for (let i = 0; i < n; i++) {
      g.ctx.fillStyle = i < s.index ? T.gold : i === s.index ? T.text : "rgba(255,246,230,0.15)";
      g.ctx.fillRect(64 + i * (880 / n), 186, 880 / n - 6, 6);
    }
    g.text(step.title.toUpperCase(), 64, 268, { size: 64, weight: 700, font: "display", italic: true, color: T.gold });
    g.text(step.titleFr, 66, 306, { size: 26, color: T.text3 });
    let y = g.para(step.instruction, 64, 360, 880, { size: 32, color: T.text, lh: 42 });
    if (step.kind === "tip-calibration") y = g.para(`Touch ${Math.min(s.tipSamples.length + 1, 6)} of 3 — change the angle every time.`, 64, y, 880, { size: 28, color: T.gold, lh: 38 });
    const rep = s.lastReport;
    if (s.phase !== "review") {
      for (const [lbl, txt, col] of [["STAND", step.stand, T.text2], ["HOLD", step.hold, T.text2], ["WHY", step.why, T.amber]] as const) {
        g.text(lbl, 64, y + 4, { size: 20, weight: 700, color: T.text3, spacing: 3 });
        y = g.para(txt, 170, y + 4, 774, { size: 26, color: col, lh: 33 }) + 2;
      }
      g.ctx.fillStyle = "rgba(255,198,26,0.1)";
      g.ctx.beginPath();
      g.ctx.roundRect(64, y - 8, 880, 54, 27);
      g.ctx.fill();
      g.text("◆  " + step.cue.toUpperCase(), 92, y + 28, { size: 25, weight: 600, color: T.gold, spacing: 2 });
      y += 62;
      const reason = rep?.reason ?? "filling";
      const label = { ok: "Stable — hold A (or trigger) to capture", "tracking-lost": "Tracking lost — keep controllers in view of the headset", filling: "Acquiring…", moving: "Hold still…" }[reason];
      const color = reason === "ok" ? T.gold : reason === "tracking-lost" ? T.ember : T.text2;
      g.text(s.phase === "holding" ? "Capturing — keep still" : label, 64, y + 22, { size: 30, weight: 600, color, maxW: 520 });
      const spreads = (rep?.spreadM ?? []).filter(Number.isFinite).map((v) => `${(v * 1000).toFixed(1)} mm`);
      if (spreads.length) g.text(`jitter ${spreads.join(" · ")} · limit ${(DEFAULT_STABILIZER.maxSpreadM * 1000).toFixed(1)} mm`, 944, y + 22, { size: 22, color: T.text3, maxW: 400, align: "right" });
      g.progressBar(64, y + 38, 880, s.progress, T.gold);
      if (s.message) g.text(s.message, 64, y + 84, { size: 24, color: T.amber, maxW: 880 });
    } else {
      y += 6;
      g.ctx.fillStyle = "rgba(61,214,140,0.10)";
      g.ctx.beginPath();
      g.ctx.roundRect(64, y, 880, 300, 24);
      g.ctx.fill();
      g.ctx.fillStyle = T.success;
      g.ctx.fillRect(64, y, 8, 300);
      g.label("Captured — review", 100, y + 46, T.success);
      g.text(s.pendingSummary(), 100, y + 110, { size: 50, weight: 600, font: "display", color: T.text });
      const pl = s.pending?.landmarks ?? [];
      if (pl.length === 2 && this.settings.showAxes) g.text(this.axesText(pl[0].position, pl[1].position), 100, y + 156, { size: 28, weight: 600, color: T.gold, spacing: 2 });
      else if (pl.length === 1) g.text(`X ${(pl[0].body.x * 100).toFixed(1)}  Y ${(pl[0].body.y * 100).toFixed(1)}  Z ${(pl[0].body.z * 100).toFixed(1)} CM (body frame)`, 100, y + 156, { size: 26, color: T.gold });
      const prev = pl[0] ? s.landmarks[pl[0].id] : undefined;
      if (s.refining && prev) g.text(`Will average with ${prev.samples ?? 1} earlier sample${(prev.samples ?? 1) > 1 ? "s" : ""}`, 100, y + 196, { size: 24, color: T.text3 });
      g.button("accept", { x: 100, y: y + 214, w: 260, h: 68 }, "Accept", () => this.acceptCapture(false), { variant: "primary", glyph: "A", size: 28 });
      g.button("refine", { x: 376, y: y + 214, w: 300, h: 68 }, "+ Sample", () => this.acceptCapture(true), { variant: "secondary", glyph: "X", size: 28, disabled: step.kind !== "landmarks" });
      g.button("retake", { x: 692, y: y + 214, w: 230, h: 68 }, "Retake", () => s.retake(), { variant: "ghost", glyph: "B", size: 28 });
    }
    this.pointsMeter(g, 1010, 168, 530);
    const ids = PROFILE_PRIMARY[s.profile];
    let ry = 330;
    for (const id of ids.slice(0, 12)) {
      const m = s.measurements[id];
      const def = MEASUREMENT_BY_ID[id];
      g.text(def.label.replace(/\s*\(.*\)/, ""), 1010, ry, { size: 25, color: m ? T.text : T.text2, maxW: 320 });
      if (m) {
        g.badge(m.method, m.status === "conflicted", 1360, ry - 9);
        g.text(formatMm(m.value, this.units), 1540, ry, { size: 27, weight: 600, color: T.gold, align: "right" });
      } else g.text("—", 1540, ry, { size: 27, color: T.text3, align: "right" });
      ry += 44;
    }
    g.button("back", { x: 64, y: 950, w: 200, h: 70 }, "Menu", () => (this.screen = "home"), { variant: "ghost", size: 28 });
    g.button("map", { x: 276, y: 950, w: 200, h: 70 }, "Steps", () => (this.screen = "steps"), { variant: "ghost", size: 28 });
    g.button("prev", { x: 488, y: 950, w: 220, h: 70 }, "Previous", () => s.goTo(s.index - 1), { variant: "ghost", disabled: s.index === 0, size: 28 });
    g.button("skip", { x: 720, y: 950, w: 220, h: 70 }, "Skip", () => {
      s.skip();
      if (s.phase === "done") this.finish();
    }, { variant: "ghost", size: 28 });
    g.button("editor", { x: 1010, y: 950, w: 530, h: 70 }, "Body Editor", () => (this.screen = "editor"), { variant: "secondary", size: 28 });
  }

  private drawStudio(g: CanvasPanel) {
    const st = this.studio;
    const info = this.beamInfo();
    g.text("MEASUREMENT STUDIO", 64, 200, { size: 64, weight: 700, font: "display", italic: true, color: T.gold });
    g.para("Ruler test — hold both tips on a ruler or known object, hold A, then key in the true value to log the error.", 64, 256, 860, { size: 28, color: T.text2 });
    g.label("Live tip-to-tip", 64, 380);
    g.text(info?.readout ?? "—", 64, 480, { size: 104, weight: 600, font: "display", color: info?.state === "lost" ? T.ember : T.gold });
    g.text(info?.axes ?? "", 66, 526, { size: 26, weight: 600, color: T.text2, spacing: 2 });
    g.text(info?.sub ?? "", 66, 562, { size: 24, color: T.text3, spacing: 2 });
    if (!this.session?.calibration.tipCalibrated) g.text("Tip not calibrated — do the Instrument step of a fit profile first", 64, 604, { size: 24, color: T.amber });
    g.progressBar(64, 626, 860, st.progress);
    g.label("Readings", 64, 696);
    st.readings.slice(-4).reverse().forEach((r, i) => {
      const y = 744 + i * 44;
      g.text(formatMm(r.vrMm, this.units === "in" ? "in" : "cm"), 64, y, { size: 30, weight: 600, color: T.text });
      g.text(r.refMm == null ? "ref —" : `ref ${(r.refMm / 10).toFixed(2)} cm · error ${(r.vrMm - r.refMm).toFixed(1)} mm`, 300, y, { size: 26, color: r.refMm == null ? T.text3 : Math.abs(r.vrMm - r.refMm) <= 5 ? T.success : T.amber });
    });
    const withRef = st.readings.filter((r) => r.refMm != null);
    if (withRef.length) {
      const errs = withRef.map((r) => r.vrMm - r.refMm!);
      const mae = errs.reduce((a, e) => a + Math.abs(e), 0) / errs.length;
      g.text(`n=${withRef.length} · MAE ${mae.toFixed(1)} mm · median ${median(errs).toFixed(1)} mm`, 64, 940, { size: 26, weight: 600, color: T.gold });
    }
    const kx = 1010;
    g.label("Reference (mm) for last reading", kx, 168);
    g.ctx.fillStyle = T.surface;
    g.ctx.beginPath();
    g.ctx.roundRect(kx, 190, 530, 90, 18);
    g.ctx.fill();
    g.text(st.keypad || "0", kx + 500, 254, { size: 54, weight: 600, font: "display", align: "right", color: st.keypad ? T.text : T.text3 });
    ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"].forEach((k, i) => {
      g.button("k" + k, { x: kx + (i % 3) * 180, y: 300 + Math.floor(i / 3) * 112, w: 170, h: 100 }, k, () => {
        if (k === "⌫") st.keypad = st.keypad.slice(0, -1);
        else if (st.keypad.length < 7 && !(k === "." && st.keypad.includes("."))) st.keypad += k;
      }, { size: 44 });
    });
    g.button("setref", { x: kx, y: 760, w: 530, h: 90 }, "Log reference", () => {
      const last = st.readings.at(-1);
      const v = parseFloat(st.keypad);
      if (last && Number.isFinite(v) && v > 0) {
        last.refMm = v;
        st.keypad = "";
        this.hooks.saveStudio(st.readings);
      }
    }, { variant: "primary", disabled: !st.readings.length || !st.keypad });
    g.button("home", { x: kx, y: 880, w: 530, h: 80 }, "Menu", () => (this.screen = "home"), { variant: "ghost" });
  }

  private editorRows(): string[] {
    const s = this.session!;
    return MEASUREMENTS.filter((d) => s.measurements[d.id] || d.profiles.includes(s.profile)).map((d) => d.id);
  }

  private drawEditor(g: CanvasPanel) {
    const s = this.session;
    if (!s) {
      this.screen = "home";
      return;
    }
    g.text("VITRUVIAN BODY EDITOR", 64, 190, { size: 50, weight: 700, font: "display", italic: true, color: T.gold });
    const rows = this.editorRows();
    const per = 11;
    const pages = Math.max(1, Math.ceil(rows.length / per));
    this.editor.page = Math.min(this.editor.page, pages - 1);
    let y = 230;
    for (const id of rows.slice(this.editor.page * per, this.editor.page * per + per)) {
      const def = MEASUREMENT_BY_ID[id];
      const m = s.measurements[id];
      const sel = this.editor.sel === id;
      g.button("row" + id, { x: 56, y, w: 820, h: 56 }, "", () => (this.editor.sel = id), { variant: sel ? "secondary" : "ghost" });
      if (sel) {
        g.ctx.fillStyle = T.gold;
        g.ctx.fillRect(56, y + 8, 5, 40);
      }
      g.text(def.label, 80, y + 39, { size: 27, color: m ? T.text : T.text2, maxW: 470 });
      if (m) {
        g.badge(m.method, m.status === "conflicted", 590, y + 29);
        g.text(formatMm(m.value, this.units), 820, y + 39, { size: 29, weight: 600, color: sel ? T.gold : T.text, align: "right" });
        if (m.locked) g.text("🔒", 860, y + 38, { size: 22, align: "right" });
      } else g.text("not measured", 820, y + 39, { size: 24, color: T.text3, align: "right" });
      y += 60;
    }
    g.button("pgup", { x: 56, y: 900, w: 190, h: 76 }, "▲", () => (this.editor.page = Math.max(0, this.editor.page - 1)), { disabled: this.editor.page === 0 });
    g.text(`${this.editor.page + 1}/${pages}`, 300, 950, { size: 28, color: T.text3, align: "center" });
    g.button("pgdn", { x: 356, y: 900, w: 190, h: 76 }, "▼", () => (this.editor.page = Math.min(pages - 1, this.editor.page + 1)), { disabled: this.editor.page >= pages - 1 });
    g.button("save", { x: 566, y: 900, w: 310, h: 76 }, "Save Passport", () => void this.save(), { variant: "primary" });
    ([["direct", "measured"], ["derived", "derived"], ["estimated", "estimated"], ["manual", "manual"]] as const).forEach(([m, l], i) => {
      g.badge(m, false, 76 + i * 190, 1001);
      g.text(l, 96 + i * 190, 1010, { size: 22, color: T.text3 });
    });
    g.badge("x", true, 76 + 4 * 190, 1001);
    g.text("conflicted", 96 + 4 * 190, 1010, { size: 22, color: T.text3 });
    const dx = 930;
    const id = this.editor.sel;
    if (!id) {
      g.para("Select a measurement to see where it comes from, adjust it, lock it or re-measure it.", dx, 260, 610, { size: 32, color: T.text3 });
      g.button("home", { x: dx, y: 900, w: 300, h: 76 }, "Menu", () => (this.screen = "home"), { variant: "ghost" });
      g.button("fit", { x: dx + 320, y: 900, w: 290, h: 76 }, "T-shirt fit", () => (this.screen = "fit"));
      return;
    }
    const def = MEASUREMENT_BY_ID[id];
    const m = s.measurements[id];
    g.label(def.group, dx, 240);
    g.text(def.label, dx, 290, { size: 34, weight: 600, maxW: 610 });
    g.text(m ? formatMm(m.value, this.units) : "—", dx, 390, { size: 88, weight: 600, font: "display", color: T.gold });
    if (m) {
      const st = m.status === "conflicted" ? "CONFLICTED" : m.method === "direct" ? "MEASURED" : m.method.toUpperCase();
      g.text(`${st} · ±${(m.uncertaintyMm / 10).toFixed(1)} cm · confidence ${(m.confidence * 100).toFixed(0)}%`, dx, 436, { size: 26, weight: 600, color: m.status === "conflicted" ? T.ember : T.text2 });
      ([["−10", -10], ["−1", -1], ["+1", 1], ["+10", 10]] as [string, number][]).forEach(([l, d], i) => g.button("st" + l, { x: dx + i * 152, y: 462, w: 140, h: 70 }, l + " mm", () => s.setManual(id, Math.round((m.value + d) * 10) / 10, "Adjusted by user in Body Editor"), { size: 28 }));
      g.label("Where this comes from", dx, 584);
      const srcs = m.sources.map((x) => {
        const lm = s.landmarks[x];
        return (LANDMARKS[x]?.label ?? MEASUREMENT_BY_ID[x]?.label ?? x) + (lm?.samples && lm.samples > 1 ? ` (${lm.samples}×)` : "");
      }).join(" · ");
      let yy = g.para(m.procedure, dx, 626, 610, { size: 25, color: T.text2, lh: 33 });
      yy = g.para("From: " + srcs, dx, yy, 610, { size: 23, color: T.text3, lh: 31 });
      for (const c of m.conflicts ?? []) yy = g.para("▲ " + c, dx, yy, 610, { size: 23, color: T.ember, lh: 31 });
      g.button("lock", { x: dx, y: 806, w: 195, h: 76 }, m.locked ? "Unlock" : "Lock", () => s.toggleLock(id), { size: 28 });
      g.button("remeasure", { x: dx + 207, y: 806, w: 195, h: 76 }, "Re-measure", () => {
        s.remeasure(id);
        this.screen = "capture";
      }, { size: 28 });
      if (m.method === "manual") g.button("clear", { x: dx + 414, y: 806, w: 196, h: 76 }, "Revert", () => s.clearManual(id), { size: 28 });
      else g.button("delete", { x: dx + 414, y: 806, w: 196, h: 76 }, "Delete", () => {
        s.deleteMeasurement(id);
        this.hooks.saveDraft(s.snapshot());
      }, { variant: "destructive", size: 28 });
    } else {
      g.button("remeasure", { x: dx, y: 470, w: 300, h: 76 }, "Measure", () => {
        const idx = s.steps.findIndex((st) => st.id === FIRST_STEP_FOR[id]);
        s.goTo(idx >= 0 ? idx : 0);
        this.screen = "capture";
      });
    }
    g.button("home", { x: dx, y: 900, w: 300, h: 76 }, "Menu", () => (this.screen = "home"), { variant: "ghost" });
    g.button("fit", { x: dx + 320, y: 900, w: 290, h: 76 }, "T-shirt fit", () => (this.screen = "fit"));
  }

  private drawResults(g: CanvasPanel) {
    const s = this.session!;
    g.text("BODY PASSPORT READY", 64, 200, { size: 60, weight: 700, font: "display", italic: true, color: T.gold });
    const ms = Object.values(s.measurements);
    const by = (k: string) => ms.filter((m) => m.method === k).length;
    g.text(`${ms.length} measurements · ${by("direct")} measured · ${by("derived")} derived · ${by("manual")} manual · ${ms.filter((m) => m.status === "conflicted").length} conflicted`, 64, 254, { size: 28, color: T.text2 });
    let y = 324;
    for (const id of PROFILE_PRIMARY.simple) {
      const m = s.measurements[id];
      g.text(MEASUREMENT_BY_ID[id].label, 64, y, { size: 32, color: T.text });
      if (m) {
        g.badge(m.method, m.status === "conflicted", 720, y - 11);
        g.text(formatMm(m.value, this.units), 960, y, { size: 38, weight: 600, font: "display", color: T.gold, align: "right" });
        g.text(`±${(m.uncertaintyMm / 10).toFixed(1)}`, 990, y, { size: 24, color: T.text3 });
      } else g.text("skipped", 960, y, { size: 28, color: T.text3, align: "right" });
      y += 66;
    }
    this.pointsMeter(g, 1110, 300, 430);
    const comp = this.passport()?.composition;
    g.label("Composition (estimates)", 1110, 490);
    if (comp?.bmi) {
      g.text(`BMI ${comp.bmi.value.toFixed(1)}`, 1110, 534, { size: 32, weight: 600, color: T.text });
      if (comp.bodyFatPct) g.text(`Body fat ${comp.bodyFatPct.value.toFixed(1)} %`, 1110, 574, { size: 28, color: T.text2 });
      if (comp.ffmiNormalized) g.text(`FFMI ${comp.ffmiNormalized.value.toFixed(1)}`, 1110, 612, { size: 28, color: T.text2 });
    } else g.para("Add your weight in About you for BMI and body composition.", 1110, 534, 430, { size: 24, color: T.text3 });
    g.para("Saved encrypted on this headset. Exit to export the passport, Marvelous Designer, MetaHuman and Unreal files.", 1110, 690, 430, { size: 24, color: T.text3 });
    g.button("editor", { x: 64, y: 880, w: 330, h: 90 }, "Review in Editor", () => (this.screen = "editor"), { variant: "primary" });
    g.button("more", { x: 410, y: 880, w: 300, h: 90 }, "Add points", () => (this.screen = "steps"));
    g.button("fit", { x: 726, y: 880, w: 260, h: 90 }, "T-shirt fit", () => (this.screen = "fit"));
    g.button("exit", { x: 1002, y: 880, w: 260, h: 90 }, "Exit", () => (this.modal = "exit"));
    g.button("home", { x: 1278, y: 880, w: 262, h: 90 }, "Menu", () => (this.screen = "home"), { variant: "ghost" });
  }

  private drawFit(g: CanvasPanel) {
    const p = this.passport();
    g.text("T-SHIRT FIT", 64, 200, { size: 64, weight: 700, font: "display", italic: true, color: T.gold });
    g.text(EXAMPLE_CHART_LABEL, 64, 250, { size: 26, color: T.amber });
    g.button("fhome", { x: 64, y: 900, w: 300, h: 80 }, "Menu", () => (this.screen = "home"), { variant: "ghost" });
    g.button("feditor", { x: 384, y: 900, w: 300, h: 80 }, "Body Editor", () => (this.screen = "editor"));
    if (!p) return;
    const best = recommendSize(p, EXAMPLE_TSHIRT_CHART)[0];
    g.label("Body · garment · ease (regular fit)", 64, 320);
    let y = 380;
    const r = evaluateTshirt(p, EXAMPLE_TSHIRT_CHART.find((c) => c.size === best.size)!);
    g.text(`Best example size: ${best.size}`, 64, y, { size: 44, weight: 700, color: T.text, font: "display" });
    y += 70;
    for (const l of r.lines) {
      const col = l.verdict === "good" ? T.success : l.verdict === "unknown" ? T.text3 : T.ember;
      g.text(l.area, 64, y, { size: 32, color: T.text });
      g.text(l.bodyMm == null ? "body —" : `body ${(l.bodyMm / 10).toFixed(1)}`, 300, y, { size: 30, color: T.text2 });
      g.text(`garment ${(l.garmentMm / 10).toFixed(1)}`, 580, y, { size: 30, color: T.text2 });
      g.text(l.easeMm == null ? "" : `ease ${(l.easeMm / 10).toFixed(1)} cm`, 900, y, { size: 30, color: T.text2 });
      g.text(l.verdict.toUpperCase(), 1540, y, { size: 30, weight: 700, color: col, align: "right" });
      y += 60;
    }
    g.para("Final fit is confirmed by cloth simulation on your avatar (Marvelous Designer / MetaHuman). This table compares body vs garment measurements.", 64, y + 30, 1400, { size: 26, color: T.text3 });
  }

  private drawModal(g: CanvasPanel) {
    const c = g.ctx;
    c.fillStyle = "rgba(13,11,8,0.78)";
    c.fillRect(0, 0, W, H);
    g.button("modal-bg", { x: 0, y: 0, w: W, h: H }, "", () => undefined, { variant: "ghost" });
    c.fillStyle = T.surface;
    c.beginPath();
    c.roundRect(360, 300, 880, 440, 28);
    c.fill();
    c.fillStyle = "rgba(255,198,26,0.6)";
    c.fillRect(388, 300, 824, 3);
    if (this.modal === "exit") {
      g.text("LEAVE VITRUVIAN?", W / 2, 400, { size: 52, weight: 700, font: "display", italic: true, color: T.gold, align: "center" });
      g.para("Your measurements are saved on this headset. You can export your Body Passport from the page that opens next.", 420, 470, 760, { size: 30, color: T.text2 });
      g.button("mstay", { x: 420, y: 620, w: 360, h: 88 }, "Stay", () => (this.modal = null), { variant: "secondary", glyph: "B" });
      g.button("mexit", { x: 820, y: 620, w: 360, h: 88 }, "Exit VR", () => {
        this.modal = null;
        void this.save();
        this.hooks.exitXR();
      }, { variant: "primary" });
    } else {
      g.text("START A NEW SESSION?", W / 2, 400, { size: 48, weight: 700, font: "display", italic: true, color: T.gold, align: "center" });
      g.para("The current unfinished session is cleared. Saved passports and their history are kept.", 420, 470, 760, { size: 30, color: T.text2 });
      g.button("mcancel", { x: 420, y: 620, w: 360, h: 88 }, "Cancel", () => (this.modal = null), { variant: "secondary", glyph: "B" });
      g.button("mreset", { x: 820, y: 620, w: 360, h: 88 }, "New session", () => {
        this.modal = null;
        this.session = null;
        this.hooks.saveDraft(null);
        this.screen = "home";
      }, { variant: "destructive" });
    }
  }

  private hint(g: CanvasPanel, x: number, y: number, items: [string, string][]) {
    for (const [gl, l] of items) {
      glyph(g.ctx, gl, x + 6, y - 9, T.text3);
      g.text(l, x + 30, y, { size: 24, color: T.text3 });
      x += 60 + g.ctx.measureText(l).width + 24;
    }
  }
}
