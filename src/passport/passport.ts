import { MEASUREMENTS, MEASUREMENT_BY_ID } from "../measurement/registry";
import type { CaptureRecord } from "../measurement/session";
import type { Calibration, Landmark, Measurement, ProfileKind } from "../measurement/types";
import type { Composition, Sex } from "../body/composition";
import type { SkinTone } from "../appearance/skinTone";
import type { ShoeSystem } from "../body/shoe";

/** User-entered facts about the subject (all MANUAL, all optional). */
export type Subject = {
  weightKg?: number;
  ageYears?: number;
  /** Used only by body-composition equations and avatar base selection. */
  sex?: Sex;
  shoe?: { system: ShoeSystem; size: number; footLengthMm: number; converted: true };
  dominantHand?: "left" | "right";
};

/** 1.1 adds optional subject, composition, appearance, bodyModel.generator (all additive). */
export const SCHEMA_VERSION = "1.1";
export const SUPPORTED_SCHEMAS = ["1.0", "1.1"];

/**
 * Body Passport v1.0 — the canonical, versioned record of one person's body.
 * Every downstream consumer (Marvelous Designer bridge, Unreal avatar, fit
 * engine, Faberland store) reads this, never the raw tracking stream.
 * JSON Schema: schemas/body-passport.schema.json
 */
export type BodyPassport = {
  schemaVersion: string;
  profileId: string;
  displayName: string;
  units: "mm";
  createdAt: string;
  updatedAt: string;
  profile: ProfileKind;
  hardware: { device: string; tracking: "WebXR/OpenXR" | "simulator"; userAgent?: string; simulated: boolean };
  calibration: {
    floorCalibrated: boolean;
    bodyOriginEstablished: boolean;
    tipCalibrated: boolean;
    tipOffsetMm: number;
    tipResidualMm: number | null;
    timestamp: string | null;
    floorY: number | null;
    /** Body coordinate frame (XR local-floor, metres): the anatomical reference for avatars. */
    bodyFrame: Calibration["bodyFrame"];
  };
  measurements: Measurement[];
  landmarks: Landmark[];
  captures: CaptureRecord[];
  bodyModel: { format: "OBJ"; kind: "parametric-measurement-mannequin"; reference: string | null; note: string; generator?: string };
  avatar: { reference: string | null };
  validation: { referenceMeasurements: { id: string; tapeMm: number; method: string; timestamp: string }[] };
  consent: { measurementStorage: boolean; faceCapture: false; timestamp: string; appearanceCapture?: boolean };
  subject?: Subject;
  /** ESTIMATES only (BMI, body fat, lean mass, FFMI, volume, density). */
  composition?: Composition;
  /** Optional appearance data, separate consent. Derived colour only; no image unless opted in. */
  appearance?: { skinTone?: SkinTone; photoStored: boolean };
};

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

export function buildPassport(args: {
  profileId?: string;
  displayName: string;
  createdAt?: string;
  profile: ProfileKind;
  device: string;
  simulated: boolean;
  calibration: Calibration;
  measurements: Record<string, Measurement>;
  landmarks: Record<string, Landmark>;
  captures: CaptureRecord[];
  references?: BodyPassport["validation"]["referenceMeasurements"];
  consentTimestamp: string;
  now?: string;
  subject?: Subject;
  composition?: Composition;
  appearance?: BodyPassport["appearance"];
}): BodyPassport {
  const now = args.now ?? new Date().toISOString();
  const order = MEASUREMENTS.map((m) => m.id);
  return {
    schemaVersion: SCHEMA_VERSION,
    profileId: args.profileId ?? uuid(),
    displayName: args.displayName,
    units: "mm",
    createdAt: args.createdAt ?? now,
    updatedAt: now,
    profile: args.profile,
    hardware: {
      device: args.device,
      tracking: args.simulated ? "simulator" : "WebXR/OpenXR",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      simulated: args.simulated,
    },
    calibration: {
      floorCalibrated: args.calibration.floorCalibrated,
      bodyOriginEstablished: args.calibration.bodyOriginEstablished,
      tipCalibrated: args.calibration.tipCalibrated,
      tipOffsetMm: args.calibration.tipOffsetM * 1000,
      tipResidualMm: args.calibration.tipResidualMm,
      timestamp: args.calibration.timestamp,
      floorY: args.calibration.floorY,
      bodyFrame: args.calibration.bodyFrame,
    },
    measurements: Object.values(args.measurements).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
    landmarks: Object.values(args.landmarks),
    captures: args.captures,
    bodyModel: { format: "OBJ", kind: "parametric-measurement-mannequin", reference: null, note: "Generated deterministically from this snapshot's measurements; not a photographic body scan.", generator: "vitruvian-mannequin@1" },
    avatar: { reference: null },
    validation: { referenceMeasurements: args.references ?? [] },
    consent: { measurementStorage: true, faceCapture: false, timestamp: args.consentTimestamp, appearanceCapture: !!args.appearance?.skinTone },
    subject: args.subject,
    composition: args.composition,
    appearance: args.appearance,
  };
}

// ── validation (mirrors schemas/body-passport.schema.json, dependency-free) ──
export function validatePassport(p: unknown): { ok: boolean; errors: string[] } {
  const e: string[] = [];
  const o = p as Record<string, unknown>;
  if (!o || typeof o !== "object") return { ok: false, errors: ["not an object"] };
  if (!SUPPORTED_SCHEMAS.includes(o.schemaVersion as string)) e.push(`schemaVersion must be one of ${SUPPORTED_SCHEMAS.join(", ")}`);
  for (const k of ["profileId", "createdAt", "updatedAt", "displayName"]) if (typeof o[k] !== "string") e.push(`${k} must be a string`);
  if (o.units !== "mm") e.push('units must be "mm"');
  if (!["quick", "precision"].includes(o.profile as string)) e.push("profile must be quick|precision");
  if (!Array.isArray(o.measurements)) e.push("measurements must be an array");
  else
    (o.measurements as Measurement[]).forEach((m, i) => {
      const at = `measurements[${i}]`;
      if (typeof m.id !== "string") e.push(`${at}.id missing`);
      else if (!MEASUREMENT_BY_ID[m.id]) e.push(`${at}.id "${m.id}" is not in the registry`);
      if (typeof m.value !== "number" || !Number.isFinite(m.value) || m.value <= 0) e.push(`${at}.value must be a positive number`);
      if (m.unit !== "mm") e.push(`${at}.unit must be mm`);
      if (!["direct", "derived", "estimated", "manual"].includes(m.method)) e.push(`${at}.method invalid`);
      if (!["validated", "unvalidated", "conflicted"].includes(m.status)) e.push(`${at}.status invalid`);
      if (typeof m.confidence !== "number" || m.confidence < 0 || m.confidence > 1) e.push(`${at}.confidence must be 0..1`);
      if (typeof m.uncertaintyMm !== "number" || m.uncertaintyMm < 0) e.push(`${at}.uncertaintyMm must be ≥ 0`);
      if (!Array.isArray(m.sources)) e.push(`${at}.sources must be an array`);
    });
  if (!Array.isArray(o.landmarks)) e.push("landmarks must be an array");
  const sub = o.subject as Subject | undefined;
  if (sub) {
    if (sub.weightKg !== undefined && !(sub.weightKg > 20 && sub.weightKg < 400)) e.push("subject.weightKg out of range");
    if (sub.sex !== undefined && !["female", "male", "unspecified"].includes(sub.sex)) e.push("subject.sex invalid");
  }
  const hw = o.hardware as BodyPassport["hardware"] | undefined;
  if (!hw || typeof hw.simulated !== "boolean") e.push("hardware.simulated must be boolean");
  return { ok: e.length === 0, errors: e };
}

/** Upgrade older passports in memory (the stored original snapshot is never modified). */
export function migratePassport(p: BodyPassport): BodyPassport {
  if (p.schemaVersion === "1.0") return { ...p, schemaVersion: "1.1", bodyModel: { ...p.bodyModel, generator: p.bodyModel.generator ?? "vitruvian-mannequin@1" } };
  return p;
}

export function parsePassport(json: string): BodyPassport {
  const p = JSON.parse(json);
  const v = validatePassport(p);
  if (!v.ok) throw new Error("Invalid Body Passport: " + v.errors.join("; "));
  return migratePassport(p as BodyPassport);
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function passportToCsv(p: BodyPassport): string {
  const head = ["id", "label", "value_mm", "value_cm", "method", "status", "confidence", "uncertainty_mm", "timestamp", "sources", "procedure", "conflicts"];
  const rows = p.measurements.map((m) => [
    m.id, MEASUREMENT_BY_ID[m.id]?.label ?? m.id, m.value.toFixed(1), (m.value / 10).toFixed(2), m.method, m.status,
    m.confidence.toFixed(3), m.uncertaintyMm.toFixed(1), m.timestamp, m.sources.join(" "), m.procedure, (m.conflicts ?? []).join(" | "),
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/** Delta table between two passports (profile comparison). */
export function comparePassports(a: BodyPassport, b: BodyPassport) {
  const bm = Object.fromEntries(b.measurements.map((m) => [m.id, m]));
  return a.measurements
    .filter((m) => bm[m.id])
    .map((m) => ({ id: m.id, a: m.value, b: bm[m.id].value, deltaMm: bm[m.id].value - m.value }));
}

/** Rebuild engine calibration from a stored passport (to edit / re-measure an existing profile). */
export function calibrationFromPassport(p: BodyPassport): Calibration {
  return {
    floorY: p.calibration.floorY ?? null,
    floorCalibrated: p.calibration.floorCalibrated,
    bodyFrame: p.calibration.bodyFrame ?? null,
    bodyOriginEstablished: p.calibration.bodyOriginEstablished,
    tipOffsetM: p.calibration.tipOffsetMm / 1000,
    tipResidualMm: p.calibration.tipResidualMm,
    tipCalibrated: p.calibration.tipCalibrated,
    timestamp: p.calibration.timestamp,
  };
}
