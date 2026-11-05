import type { BodyPassport } from "../passport/passport";
import { MEASUREMENT_BY_ID } from "../measurement/registry";
import { buildMannequin, mannequinToObj } from "../body/mannequin";

/**
 * MARVELOUS DESIGNER BRIDGE (adapter v1, target: Marvelous Designer 2024–2025.x)
 *
 * What is verified (official MD docs, Avatar Editor / Avatar Settings):
 *  - The Avatar Editor accepts user-entered circumference, height and length
 *    measurements, with "linked" proportional adjustment.
 *  - Avatar sizes save as .AVS (size only), avatars as .AVT, measurements .MEA.
 *    These are proprietary, undocumented binary formats — we do NOT write them.
 *  - MD imports OBJ (and FBX) meshes as avatars (File ▸ Import ▸ OBJ, "Open as Avatar").
 *
 * So the bridge produces two artefacts:
 *  1. An Avatar Editor measurement sheet: each Faberland measurement mapped to the
 *     Avatar Editor category/row a designer types it into. The target LABELS are
 *     to be confirmed against the installed MD version (see docs/MARVELOUS_DESIGNER.md);
 *     we never claim internal field identifiers.
 *  2. A measured mannequin OBJ (millimetres) whose girths at the measured heights
 *     reproduce the passport's circumferences, for direct import as an avatar.
 *
 * The Body Passport stays the canonical source; this adapter only translates.
 */
export const ADAPTER_VERSION = "md-adapter-1.0";

export type MdMapping = { faberlandId: string; mdCategory: "Height" | "Circumference" | "Length" | "Width"; mdLabel: string; note?: string };

export const MD_MAPPING: MdMapping[] = [
  { faberlandId: "height", mdCategory: "Height", mdLabel: "Height (total)" },
  { faberlandId: "neck_circumference", mdCategory: "Circumference", mdLabel: "Neck" },
  { faberlandId: "chest_circumference", mdCategory: "Circumference", mdLabel: "Chest / Bust" },
  { faberlandId: "waist_circumference", mdCategory: "Circumference", mdLabel: "Waist" },
  { faberlandId: "hip_circumference", mdCategory: "Circumference", mdLabel: "Hip" },
  { faberlandId: "shoulder_width", mdCategory: "Width", mdLabel: "Shoulder width", note: "Straight-line acromion to acromion; MD may measure over the shoulder curve — compare on the avatar with the Tape Measure tool." },
  { faberlandId: "arm_length", mdCategory: "Length", mdLabel: "Arm length", note: "Acromion to wrist, arm straight." },
  { faberlandId: "back_length", mdCategory: "Length", mdLabel: "Back length (nape to waist)" },
  { faberlandId: "inseam", mdCategory: "Length", mdLabel: "Inseam / Crotch height" },
  { faberlandId: "waist_height", mdCategory: "Height", mdLabel: "Waist height" },
  { faberlandId: "knee_height", mdCategory: "Height", mdLabel: "Knee height" },
  { faberlandId: "shoulder_height", mdCategory: "Height", mdLabel: "Shoulder height" },
];

export function mdSheetRows(p: BodyPassport) {
  const byId = Object.fromEntries(p.measurements.map((m) => [m.id, m]));
  return MD_MAPPING.map((map) => {
    const m = byId[map.faberlandId];
    return {
      ...map,
      label: MEASUREMENT_BY_ID[map.faberlandId]?.label ?? map.faberlandId,
      valueCm: m ? +(m.value / 10).toFixed(1) : null,
      method: m?.method ?? "missing",
      uncertaintyCm: m ? +(m.uncertaintyMm / 10).toFixed(1) : null,
      status: m?.status ?? "missing",
    };
  });
}

export function mdSheetCsv(p: BodyPassport): string {
  const rows = mdSheetRows(p);
  const head = "md_category,md_label,faberland_id,value_cm,uncertainty_cm,method,status,note";
  return [head, ...rows.map((r) => [r.mdCategory, r.mdLabel, r.faberlandId, r.valueCm ?? "", r.uncertaintyCm ?? "", r.method, r.status, (r.note ?? "").replace(/,/g, ";")].join(","))].join("\n") + "\n";
}

/** Plain-text worksheet for the designer, step by step. */
export function mdWorksheet(p: BodyPassport): string {
  const rows = mdSheetRows(p);
  const lines = [
    `FABERLAND VITRUVIAN → MARVELOUS DESIGNER  (${ADAPTER_VERSION})`,
    `Profile ${p.displayName} · ${p.profileId} · passport v${p.schemaVersion} · ${p.updatedAt}`,
    p.hardware.simulated ? "!! SIMULATED DATA — NOT A REAL PERSON. DO NOT USE FOR PRODUCTION FIT !!" : `Captured on ${p.hardware.device}`,
    "",
    "A) Avatar Editor route (MD avatar, edited to these sizes)",
    "   1. Load the base avatar matching the person (Avatar ▸ Avatar Editor).",
    "   2. Unlink proportional adjustment only if you need exact individual values.",
    "   3. Enter each value below in centimetres. Save size as .AVS for re-use.",
    "",
    ...rows.map((r) => `   ${r.mdCategory.padEnd(14)} ${r.mdLabel.padEnd(30)} ${r.valueCm === null ? "—".padStart(8) : (r.valueCm.toFixed(1) + " cm").padStart(8)}  ±${r.uncertaintyCm ?? "-"}  [${r.method}${r.status === "conflicted" ? ", CONFLICTED" : ""}]${r.note ? "  — " + r.note : ""}`),
    "",
    "B) Mannequin route (exact measured girths)",
    "   File ▸ Import ▸ OBJ ▸ vitruvian-mannequin.obj, Open as Avatar, scale unit = millimetre.",
    "   Verify with the Tape Measure: chest / waist / hip girths should match the values above within 5 mm.",
    "",
    "C) Fit check: keep BODY values (above), GARMENT values (pattern) and EASE (garment − body) separate.",
  ];
  return lines.join("\n") + "\n";
}

export function mdMannequinObj(p: BodyPassport): string {
  return mannequinToObj(buildMannequin(p), `Faberland Vitruvian mannequin · ${p.profileId} · units mm · ${ADAPTER_VERSION}`);
}
