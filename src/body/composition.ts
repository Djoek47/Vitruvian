import type { Mesh } from "./mannequin";

/**
 * Body composition ESTIMATES from measurements + user-entered weight.
 * None of these are medical measurements. All outputs are classified
 * `estimated`, with literature or model uncertainty. Used to shape the avatar
 * (fat / muscle sliders) when the user prefers not to provide a photo.
 *
 *  - BMI (WHO): kg / m².
 *  - Body fat %: U.S. Navy circumference method (Hodgdon & Beckett, 1984), SEE ≈ 3.5 %BF.
 *      male:   495 / (1.0324 − 0.19077·log10(waist − neck) + 0.15456·log10(height)) − 450
 *      female: 495 / (1.29579 − 0.35004·log10(waist + hip − neck) + 0.22100·log10(height)) − 450   (cm)
 *    Caveat: the Navy protocol takes male waist at the navel; Vitruvian measures the narrowest waist.
 *  - Lean (fat-free) mass, FFMI = lean / h², normalised FFMI = FFMI + 6.1·(1.8 − h)  (muscularity index).
 *  - Body volume from the measured mannequin mesh → mean body density = mass / volume.
 *    The mesh limbs are estimated, so density is indicative only (±8 % volume).
 */
export type Sex = "female" | "male" | "unspecified";

export type CompositionInput = { weightKg?: number; heightMm?: number; sex?: Sex; neckMm?: number; waistMm?: number; hipMm?: number; volumeL?: number };

export type EstimatedValue = { value: number; unit: string; uncertainty: number; method: "estimated" | "derived"; procedure: string };

export type Composition = Partial<Record<"bmi" | "bodyFatPct" | "fatMassKg" | "leanMassKg" | "ffmi" | "ffmiNormalized" | "bodyVolumeL" | "bodyDensityKgL", EstimatedValue>> & {
  bmiCategory?: string;
  notes: string[];
};

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

export function navyBodyFat(sex: Sex, heightCm: number, neckCm: number, waistCm: number, hipCm?: number): number | null {
  if (sex === "male") {
    if (waistCm - neckCm <= 0) return null;
    return 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
  }
  if (sex === "female") {
    if (hipCm === undefined || waistCm + hipCm - neckCm <= 0) return null;
    return 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
  }
  return null;
}

export function computeComposition(i: CompositionInput): Composition {
  const c: Composition = { notes: [] };
  const h = i.heightMm ? i.heightMm / 1000 : undefined;
  if (i.weightKg && h) {
    const bmi = i.weightKg / (h * h);
    c.bmi = { value: bmi, unit: "kg/m²", uncertainty: bmi * 0.02, method: "derived", procedure: "WHO BMI = weight / height² (entered weight, measured height)" };
    c.bmiCategory = bmiCategory(bmi);
  }
  if (h && i.sex && i.sex !== "unspecified" && i.neckMm && i.waistMm) {
    const bf = navyBodyFat(i.sex, h * 100, i.neckMm / 10, i.waistMm / 10, i.hipMm ? i.hipMm / 10 : undefined);
    if (bf !== null && bf > 2 && bf < 70) {
      c.bodyFatPct = { value: bf, unit: "%", uncertainty: 3.5, method: "estimated", procedure: "U.S. Navy circumference equation (Hodgdon & Beckett 1984); SEE ≈ 3.5 %BF" };
      c.notes.push("Navy method: male waist protocol is at the navel; Vitruvian waist is the narrowest point.");
      if (i.weightKg) {
        const fat = (i.weightKg * bf) / 100;
        const lean = i.weightKg - fat;
        c.fatMassKg = { value: fat, unit: "kg", uncertainty: i.weightKg * 0.035, method: "estimated", procedure: "weight × body fat %" };
        c.leanMassKg = { value: lean, unit: "kg", uncertainty: i.weightKg * 0.035, method: "estimated", procedure: "weight − fat mass" };
        const ffmi = lean / (h * h);
        c.ffmi = { value: ffmi, unit: "kg/m²", uncertainty: (i.weightKg * 0.035) / (h * h), method: "estimated", procedure: "Fat-free mass index = lean mass / height²" };
        c.ffmiNormalized = { value: ffmi + 6.1 * (1.8 - h), unit: "kg/m²", uncertainty: c.ffmi.uncertainty, method: "estimated", procedure: "FFMI normalised to 1.8 m (Kouri et al. 1995) — muscularity indicator" };
      }
    }
  } else if (i.weightKg && h) c.notes.push("Enter sex (for the equation only) and complete neck + waist (+ hip) to estimate body fat and muscle (FFMI).");
  if (i.volumeL) {
    c.bodyVolumeL = { value: i.volumeL, unit: "L", uncertainty: i.volumeL * 0.08, method: "estimated", procedure: "Volume of the measured mannequin mesh (limbs estimated)" };
    if (i.weightKg) {
      const d = i.weightKg / i.volumeL;
      c.bodyDensityKgL = { value: d, unit: "kg/L", uncertainty: d * 0.08, method: "estimated", procedure: "mass / mannequin volume — indicative only" };
      if (d < 0.9 || d > 1.2) c.notes.push("Density outside the human range: the mannequin volume is too coarse for this body. Ignore density.");
    }
  }
  return c;
}

/** Enclosed volume of a mesh of closed parts (divergence theorem), litres. Units in: mm. */
export function meshVolumeL(mesh: Mesh): number {
  let total = 0;
  const groups = [...mesh.groups, { name: "_end", start: mesh.faces.length }];
  for (let g = 0; g < groups.length - 1; g++) {
    let v = 0;
    for (let fi = groups[g].start; fi < groups[g + 1].start; fi++) {
      const f = mesh.faces[fi];
      const p0 = mesh.vertices[f[0]];
      for (let k = 1; k < f.length - 1; k++) {
        const p1 = mesh.vertices[f[k]];
        const p2 = mesh.vertices[f[k + 1]];
        v += (p0[0] * (p1[1] * p2[2] - p1[2] * p2[1]) - p0[1] * (p1[0] * p2[2] - p1[2] * p2[0]) + p0[2] * (p1[0] * p2[1] - p1[1] * p2[0])) / 6;
      }
    }
    total += Math.abs(v);
  }
  return total / 1e6; // mm³ → L
}
