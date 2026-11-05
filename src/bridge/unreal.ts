import type { BodyPassport } from "../passport/passport";
import { MEASUREMENT_BY_ID } from "../measurement/registry";

/**
 * UNREAL ENGINE EXPORT (`ue-passport-1.0`)
 *
 * Converts the passport to Unreal conventions so it loads straight into
 * USTRUCTs (unreal/Source/…/VitruvianPassport.h) via FJsonObjectConverter,
 * or imports as a DataTable (CSV).
 *
 *  Units: centimetres (UE default).
 *  Axes:  UE is left-handed Z-up: X = forward, Y = right, Z = up.
 *         Body frame (x right, y up, z forward, metres) → UE (X = z, Y = x, Z = y) × 100.
 *  Origin: floor directly under the subject at the Stance step.
 *  Keys:   PascalCase = UPROPERTY names (FJsonObjectConverter matching).
 */
export const UE_EXPORT_VERSION = "ue-passport-1.0";

export const bodyToUe = (p: { x: number; y: number; z: number }) => ({ X: +(p.z * 100).toFixed(3), Y: +(p.x * 100).toFixed(3), Z: +(p.y * 100).toFixed(3) });

export function unrealPassport(p: BodyPassport) {
  const st = p.appearance?.skinTone;
  return {
    Format: UE_EXPORT_VERSION,
    SchemaVersion: p.schemaVersion,
    ProfileId: p.profileId,
    DisplayName: p.displayName,
    UpdatedAt: p.updatedAt,
    bSimulated: p.hardware.simulated,
    Units: "cm",
    CoordinateSystem: "UE left-handed: X forward, Y right, Z up; origin = floor under subject",
    Measurements: p.measurements.map((m) => ({
      Id: m.id,
      Label: MEASUREMENT_BY_ID[m.id]?.label ?? m.id,
      ValueCm: +(m.value / 10).toFixed(2),
      UncertaintyCm: +(m.uncertaintyMm / 10).toFixed(2),
      Confidence: +m.confidence.toFixed(3),
      Method: m.method,
      Status: m.status,
    })),
    Landmarks: p.landmarks.map((l) => ({ Id: l.id, Location: bodyToUe(l.body), Samples: l.samples ?? 1, SpreadMm: +l.spreadMm.toFixed(2) })),
    Subject: {
      WeightKg: p.subject?.weightKg ?? 0,
      AgeYears: p.subject?.ageYears ?? 0,
      Sex: p.subject?.sex ?? "unspecified",
      ShoeSystem: p.subject?.shoe?.system ?? "",
      ShoeSize: p.subject?.shoe?.size ?? 0,
      FootLengthCm: p.subject?.shoe ? +(p.subject.shoe.footLengthMm / 10).toFixed(1) : 0,
    },
    Composition: {
      Bmi: p.composition?.bmi?.value ?? 0,
      BodyFatPct: p.composition?.bodyFatPct?.value ?? 0,
      LeanMassKg: p.composition?.leanMassKg?.value ?? 0,
      FfmiNormalized: p.composition?.ffmiNormalized?.value ?? 0,
    },
    SkinTone: st
      ? { bPresent: true, Hex: st.hex, LinearColor: { R: st.linear[0], G: st.linear[1], B: st.linear[2], A: 1 }, ItaDeg: +st.itaDeg.toFixed(2), Monk: st.monk, bWhiteBalanced: st.whiteBalanced }
      : { bPresent: false, Hex: "", LinearColor: { R: 0, G: 0, B: 0, A: 1 }, ItaDeg: 0, Monk: 0, bWhiteBalanced: false },
  };
}

/** DataTable CSV (row struct FVitruvianMeasurementRow). First column = row name. */
export function unrealDataTableCsv(p: BodyPassport): string {
  const head = "---,ValueCm,UncertaintyCm,Confidence,Method,Status";
  return [head, ...p.measurements.map((m) => [m.id, (m.value / 10).toFixed(2), (m.uncertaintyMm / 10).toFixed(2), m.confidence.toFixed(3), m.method, m.status].join(","))].join("\n") + "\n";
}
