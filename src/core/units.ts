export type LengthUnit = "mm" | "cm" | "m" | "in";

const PER_M: Record<LengthUnit, number> = { mm: 1000, cm: 100, m: 1, in: 1000 / 25.4 };

export const mToMm = (m: number) => m * 1000;
export const mmToM = (mm: number) => mm / 1000;

export function convert(value: number, from: LengthUnit, to: LengthUnit): number {
  return (value / PER_M[from]) * PER_M[to];
}

/** Format a millimetre value for display. mm shows 0 decimals, cm 1, m 3, in 2. */
export function formatMm(mm: number, unit: LengthUnit = "cm"): string {
  if (!Number.isFinite(mm)) return "—";
  const v = convert(mm, "mm", unit);
  const dp = unit === "mm" ? 0 : unit === "cm" ? 1 : unit === "m" ? 3 : 2;
  return `${v.toFixed(dp)} ${unit}`;
}
