// Generates docs/MEASUREMENT_MODES.md from the procedures + registry (single source of truth).
import { writeFileSync } from "node:fs";
import { STEPS, PROFILE_INFO, POINT_CAP, bodyPointsFor } from "../src/measurement/procedures";
import { MEASUREMENTS } from "../src/measurement/registry";
import { LANDMARKS } from "../src/anatomy/landmarks";
import type { ProfileKind } from "../src/measurement/types";

const modes: ProfileKind[] = ["simple", "intermediate", "ultra"];
const tick = (b: boolean) => (b ? "●" : "");
const out: string[] = [
  "# Measurement modes",
  "",
  "_Generated from `src/measurement/procedures.ts` and `src/measurement/registry.ts` by `scripts/gen-modes.ts`. Do not edit by hand._",
  "",
  "| Mode | Body points | Point cap (incl. repeat samples) | Time | Notes |",
  "|---|---|---|---|---|",
  ...modes.map((m) => `| **${PROFILE_INFO[m].title}** | ${bodyPointsFor(m)} (+ ground & head) | ${POINT_CAP[m]} | ~${PROFILE_INFO[m].minutes} min | ${PROFILE_INFO[m].blurb} |`),
  "",
  "Every mode starts with the same calibration: **Ground** (floor plane), **Head** (headset and body axes), **Instrument** (tip-to-tip ×3).",
  "",
  "## Capture steps",
  "| # | Step | Section | Points | Simple | Intermediate | Ultra |",
  "|---|---|---|---|---|---|---|",
  ...STEPS.map((s, i) => `| ${i + 1} | ${s.title} | ${s.section} | ${s.points.map((p) => LANDMARKS[p.landmark]?.label ?? p.landmark).join(" · ") || (s.kind === "tip-calibration" ? "3 tip touches" : "headset")} | ${tick(s.profiles.includes("simple"))} | ${tick(s.profiles.includes("intermediate"))} | ${tick(s.profiles.includes("ultra"))} |`),
  "",
  "## Measurements (tailor / designer reference)",
  "Method in each mode: **D** direct (geometric) · **De** derived (model from direct values) · **E** estimated (population prior) · *tape* = manual entry only. A girth is *estimated* when a mode has no depth points for it.",
  "",
  "| Measurement | Group | Fit tolerance | Modes | T-shirt |",
  "|---|---|---|---|---|",
  ...MEASUREMENTS.map((m) => `| ${m.label} (\`${m.id}\`) | ${m.group} | ±${m.fitToleranceMm / 10} cm | ${m.profiles.map((p) => PROFILE_INFO[p].title).join(", ")} | ${m.tshirt ? "●" : ""} |`),
  "",
];
writeFileSync(new URL("../docs/MEASUREMENT_MODES.md", import.meta.url), out.join("\n"));
console.log(`wrote ${STEPS.length} steps, ${MEASUREMENTS.length} measurements`);
