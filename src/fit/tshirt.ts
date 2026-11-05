import type { BodyPassport } from "../passport/passport";

/**
 * T-shirt fit engine. Three datasets stay separate:
 *   BODY    — the person (Body Passport)
 *   GARMENT — the finished garment's own measurements (from the pattern / MD / supplier chart)
 *   EASE    — garment − body
 * Ease targets are per fit style and are configuration, not measurement. The
 * defaults below are common knit T-shirt ranges and MUST be tuned with the
 * physical validation sessions (docs/VALIDATION.md).
 */
export type GarmentSpec = {
  name: string;
  size: string;
  /** Full chest circumference of the garment (2 × flat chest width), mm. */
  chestMm: number;
  /** Full waist/hem circumference, mm (optional). */
  waistMm?: number;
  /** Shoulder seam to shoulder seam, mm. */
  shoulderMm: number;
  /** HPS (high point shoulder) to hem, mm. */
  bodyLengthMm: number;
  /** Shoulder seam to cuff, mm. */
  sleeveLengthMm: number;
};

export type FitStyle = "slim" | "regular" | "relaxed";

/** [min, max] ease in mm. Shoulder ease is garment shoulder − biacromial body width. */
export const EASE_TARGETS: Record<FitStyle, Record<"chest" | "waist" | "shoulder", [number, number]>> = {
  slim: { chest: [20, 60], waist: [20, 80], shoulder: [-10, 25] },
  regular: { chest: [60, 120], waist: [60, 160], shoulder: [0, 40] },
  relaxed: { chest: [120, 220], waist: [120, 260], shoulder: [20, 80] },
};

export type FitVerdict = "too-tight" | "good" | "too-loose" | "unknown";
export type FitLine = { area: string; bodyMm: number | null; garmentMm: number; easeMm: number | null; targetMm: [number, number] | null; verdict: FitVerdict; note?: string };

export function evaluateTshirt(p: BodyPassport, g: GarmentSpec, style: FitStyle = "regular"): { lines: FitLine[]; overall: FitVerdict; simulated: boolean } {
  const m = Object.fromEntries(p.measurements.map((x) => [x.id, x]));
  const t = EASE_TARGETS[style];
  const line = (area: string, bodyId: string, garmentMm: number, target: [number, number] | null): FitLine => {
    const b = m[bodyId];
    if (!b) return { area, bodyMm: null, garmentMm, easeMm: null, targetMm: target, verdict: "unknown", note: `${bodyId} not measured` };
    const ease = garmentMm - b.value;
    let verdict: FitVerdict = "good";
    if (target) {
      // Use the measurement uncertainty: only call a mismatch when it's outside target even at the favourable end.
      if (ease + b.uncertaintyMm < target[0]) verdict = "too-tight";
      else if (ease - b.uncertaintyMm > target[1]) verdict = "too-loose";
    }
    return { area, bodyMm: b.value, garmentMm, easeMm: ease, targetMm: target, verdict, note: b.status === "conflicted" ? "body value conflicted" : undefined };
  };
  const lines: FitLine[] = [
    line("Chest", "chest_circumference", g.chestMm, t.chest),
    ...(g.waistMm ? [line("Waist", "waist_circumference", g.waistMm, t.waist)] : []),
    line("Shoulder", "shoulder_width", g.shoulderMm, t.shoulder),
  ];
  // Length checks: body length should end near the high hip (≈ 50–150 mm below waist height).
  if (m.height && m.waist_height && m.shoulder_height) {
    const hpsY = m.shoulder_height.value + 30; // HPS sits ~30 mm above acromion (estimate)
    const hemY = hpsY - g.bodyLengthMm;
    const belowWaist = m.waist_height.value - hemY;
    lines.push({ area: "Length", bodyMm: m.waist_height.value, garmentMm: g.bodyLengthMm, easeMm: belowWaist, targetMm: [80, 220], verdict: belowWaist < 80 ? "too-tight" : belowWaist > 220 ? "too-loose" : "good", note: "hem distance below waist (too-tight = too short)" });
  }
  if (m.arm_length) {
    // Short sleeve: expect sleeve to end 35–55 % down the arm.
    const frac = g.sleeveLengthMm / m.arm_length.value;
    lines.push({ area: "Sleeve", bodyMm: m.arm_length.value, garmentMm: g.sleeveLengthMm, easeMm: null, targetMm: null, verdict: frac < 0.25 ? "too-tight" : frac > 0.6 ? "too-loose" : "good", note: `ends ${(frac * 100).toFixed(0)}% down the arm` });
  }
  const verdicts = lines.map((l) => l.verdict);
  const overall: FitVerdict = verdicts.includes("too-tight") ? "too-tight" : verdicts.includes("too-loose") ? "too-loose" : verdicts.every((v) => v === "unknown") ? "unknown" : "good";
  return { lines, overall, simulated: p.hardware.simulated };
}

/** Pick the best size from a size chart (garment specs). */
export function recommendSize(p: BodyPassport, chart: GarmentSpec[], style: FitStyle = "regular") {
  const scored = chart.map((g) => {
    const r = evaluateTshirt(p, g, style);
    const target = EASE_TARGETS[style].chest;
    const chest = r.lines.find((l) => l.area === "Chest");
    const mid = (target[0] + target[1]) / 2;
    const score = chest?.easeMm == null ? Infinity : Math.abs(chest.easeMm - mid) + r.lines.filter((l) => l.verdict !== "good" && l.verdict !== "unknown").length * 50;
    return { size: g.size, score, result: r };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored;
}

/** EXAMPLE chart for the UI demo only — replace with the supplier's real chart (e.g. the Printify product's size table). */
export const EXAMPLE_CHART_LABEL = "Example chart — replace with your supplier's garment measurements";
export const EXAMPLE_TSHIRT_CHART: GarmentSpec[] = [
  { name: "Example tee", size: "S", chestMm: 920, shoulderMm: 430, bodyLengthMm: 690, sleeveLengthMm: 200 },
  { name: "Example tee", size: "M", chestMm: 1020, shoulderMm: 460, bodyLengthMm: 720, sleeveLengthMm: 210 },
  { name: "Example tee", size: "L", chestMm: 1120, shoulderMm: 490, bodyLengthMm: 740, sleeveLengthMm: 220 },
  { name: "Example tee", size: "XL", chestMm: 1220, shoulderMm: 520, bodyLengthMm: 760, sleeveLengthMm: 230 },
];
