import type { BodyPassport } from "../passport/passport";

/**
 * METAHUMAN BRIDGE (Unreal Engine) — avatar target for the Faberland store.
 *
 * Pipeline: Body Passport → MetaHuman body targets → MetaHuman (UE) → store garment
 * in pre-made sizes → cloth simulation on the person's MetaHuman → fit verdict.
 *
 * MetaHuman Creator (in-editor since UE 5.6) fits its parametric body to target
 * body measurements. Its internal parameter/constraint names are NOT published
 * as a stable API, so this file emits a neutral, versioned target set using
 * ISO 8559-1-style measurement names, in centimetres (what the Creator UI shows),
 * with method/uncertainty so the Unreal side can weight or reject values.
 * The UE-side importer (docs/METAHUMAN.md) maps these to the Creator's body
 * measurement fields for the installed engine version.
 */
export const METAHUMAN_TARGETS_VERSION = "mh-targets-1.0";

const MAP: { id: string; target: string; kind: "circumference" | "length" | "height" | "width" }[] = [
  { id: "height", target: "stature", kind: "height" },
  { id: "chest_circumference", target: "chest_girth", kind: "circumference" },
  { id: "waist_circumference", target: "waist_girth", kind: "circumference" },
  { id: "hip_circumference", target: "hip_girth", kind: "circumference" },
  { id: "neck_circumference", target: "neck_girth", kind: "circumference" },
  { id: "shoulder_width", target: "biacromial_breadth", kind: "width" },
  { id: "arm_length", target: "arm_length_shoulder_to_wrist", kind: "length" },
  { id: "inseam", target: "inside_leg_height", kind: "height" },
  { id: "waist_height", target: "waist_height", kind: "height" },
  { id: "shoulder_height", target: "acromial_height", kind: "height" },
  { id: "knee_height", target: "knee_height", kind: "height" },
  { id: "back_length", target: "back_length_c7_to_waist", kind: "length" },
  { id: "arm_span", target: "arm_span", kind: "length" },
];

export function metahumanTargets(p: BodyPassport) {
  const byId = Object.fromEntries(p.measurements.map((m) => [m.id, m]));
  return {
    format: METAHUMAN_TARGETS_VERSION,
    profileId: p.profileId,
    passportVersion: p.schemaVersion,
    simulated: p.hardware.simulated,
    units: "cm",
    generatedAt: p.updatedAt,
    targets: MAP.filter((x) => byId[x.id]).map((x) => {
      const m = byId[x.id];
      return {
        target: x.target,
        kind: x.kind,
        valueCm: +(m.value / 10).toFixed(2),
        uncertaintyCm: +(m.uncertaintyMm / 10).toFixed(2),
        method: m.method,
        status: m.status,
        /** Suggested solver weight: confident direct/manual values dominate. */
        weight: m.status === "conflicted" ? 0 : +(m.confidence * (m.method === "estimated" ? 0.3 : 1)).toFixed(3),
        source: x.id,
      };
    }),
  };
}
