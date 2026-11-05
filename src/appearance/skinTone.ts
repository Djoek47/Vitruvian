/**
 * Skin-tone capture (OPTIONAL, separate consent).
 *
 * Pipeline: photo/camera frame → user taps a skin patch (inner forearm
 * recommended: least sun-affected, no face needed) and optionally a white
 * paper patch in the same light → white-balance and exposure normalisation in
 * linear RGB → CIE L*a*b* (D65) → ITA° (Chardon et al. 1991) → nearest Monk
 * Skin Tone (MST, 10-point) swatch.
 *
 * Only these derived numbers are stored by default. The photo is never stored
 * unless the user explicitly opts in. Without a white reference the colour is
 * marked `uncalibrated` (camera auto-white-balance shifts it).
 */
export type RGB = [number, number, number]; // 0..255 sRGB
export type Lab = [number, number, number];

const toLin = (c: number) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (x: number) => {
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, v)) * 255);
};

export function srgbToLab(rgb: RGB): Lab {
  return linToLab(rgb.map(toLin) as RGB);
}

export function linToLab([r, g, b]: RGB): Lab {
  // sRGB D65 → XYZ
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export const hex = (rgb: RGB) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
export const fromHex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Individual Typology Angle, degrees. */
export const ita = ([L, , b]: Lab) => (Math.atan2(L - 50, b) * 180) / Math.PI;

export function itaCategory(a: number): string {
  if (a > 55) return "very light";
  if (a > 41) return "light";
  if (a > 28) return "intermediate";
  if (a > 10) return "tan";
  if (a > -30) return "brown";
  return "dark";
}

/** Monk Skin Tone scale reference swatches (Google, CC-BY 4.0). */
export const MONK: string[] = ["#f6ede4", "#f3e7db", "#f7ead0", "#eadaba", "#d7bd96", "#a07e56", "#825c43", "#604134", "#3a312a", "#292420"];

export const deltaE76 = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function nearestMonk(lab: Lab): { index: number; deltaE: number } {
  let best = { index: 1, deltaE: Infinity };
  MONK.forEach((h, i) => {
    const d = deltaE76(lab, srgbToLab(fromHex(h)));
    if (d < best.deltaE) best = { index: i + 1, deltaE: d };
  });
  return best;
}

/** Robust patch average in linear light: drops the brightest/darkest 15 % (speculars, shadows, hair). */
export function patchMeanLinear(pixels: Uint8ClampedArray): RGB {
  const px: { lin: RGB; y: number }[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const lin: RGB = [toLin(pixels[i]), toLin(pixels[i + 1]), toLin(pixels[i + 2])];
    px.push({ lin, y: 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] });
  }
  px.sort((a, b) => a.y - b.y);
  const k = Math.floor(px.length * 0.15);
  const keep = px.slice(k, px.length - k || undefined);
  const m: RGB = [0, 0, 0];
  for (const p of keep) for (let c = 0; c < 3; c++) m[c] += p.lin[c] / keep.length;
  return m;
}

export type SkinTone = {
  hex: string;
  srgb: RGB;
  linear: RGB;
  lab: Lab;
  itaDeg: number;
  itaCategory: string;
  monk: number;
  monkDeltaE: number;
  whiteBalanced: boolean;
  method: "estimated";
  source: "photo" | "camera";
  bodySite: string;
  timestamp: string;
  note: string;
};

/**
 * @param skinLin  mean linear RGB of the skin patch
 * @param whiteLin mean linear RGB of a white paper patch in the same light (optional)
 */
export function skinToneFrom(skinLin: RGB, whiteLin: RGB | null, source: SkinTone["source"], bodySite: string, now = new Date().toISOString()): SkinTone {
  // Von Kries white balance + exposure: map the paper to 0.85 linear (~matte white paper reflectance).
  const lin: RGB = whiteLin ? (skinLin.map((v, c) => Math.min(1, (v * 0.85) / Math.max(1e-4, whiteLin[c]))) as RGB) : skinLin;
  const srgb = lin.map(toSrgb) as RGB;
  const lab = linToLab(lin);
  const a = ita(lab);
  const m = nearestMonk(lab);
  return {
    hex: hex(srgb), srgb, linear: lin, lab, itaDeg: a, itaCategory: itaCategory(a), monk: m.index, monkDeltaE: m.deltaE,
    whiteBalanced: !!whiteLin, method: "estimated", source, bodySite, timestamp: now,
    note: whiteLin ? "White-balanced against a white paper reference in the same light." : "Uncalibrated: no white reference — camera auto white balance may shift the colour.",
  };
}
