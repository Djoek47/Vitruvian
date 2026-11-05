/**
 * Shoe size ⇄ foot length (APPROXIMATE: brands and lasts vary).
 * Mondopoint (ISO 9407) is the foot length in mm by definition, which is why
 * the passport stores foot length. Other systems convert via last length
 * ≈ foot length + 15 mm allowance:
 *   EU (Paris point, 2/3 cm):   EU = (L + 15) / 6.667
 *   UK (barleycorn, 1/3 inch):  UK = 3·(L + 15)/25.4 − 25
 *   US men ≈ UK + 1,  US women ≈ UK + 2.5
 */
export type ShoeSystem = "EU" | "UK" | "US-M" | "US-W" | "Mondopoint";

export function footLengthFromSize(system: ShoeSystem, size: number): number {
  switch (system) {
    case "Mondopoint": return size;
    case "EU": return size * 6.667 - 15;
    case "UK": return ((size + 25) * 25.4) / 3 - 15;
    case "US-M": return ((size - 1 + 25) * 25.4) / 3 - 15;
    case "US-W": return ((size - 2.5 + 25) * 25.4) / 3 - 15;
  }
}

export function sizeFromFootLength(system: ShoeSystem, mm: number): number {
  const half = (x: number) => Math.round(x * 2) / 2;
  switch (system) {
    case "Mondopoint": return Math.round(mm);
    case "EU": return half((mm + 15) / 6.667);
    case "UK": return half((3 * (mm + 15)) / 25.4 - 25);
    case "US-M": return half((3 * (mm + 15)) / 25.4 - 25 + 1);
    case "US-W": return half((3 * (mm + 15)) / 25.4 - 25 + 2.5);
  }
}

export const SHOE_SYSTEMS: ShoeSystem[] = ["EU", "UK", "US-M", "US-W", "Mondopoint"];
