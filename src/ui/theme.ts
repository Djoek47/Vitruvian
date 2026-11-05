// Faberland XR tokens (from design/figma-make/src/imports/pasted_text/faberland-xr-design-system.md)
export const T = {
  gold: "#FFC61A",
  amber: "#F5A81C",
  ember: "#FF3D00",
  panel: "#0D0B08",
  panelGlass: "rgba(13,11,8,0.80)",
  surface: "#1A1611",
  surface2: "#231E17",
  text: "#FFF6E6",
  text2: "#C9BFB0",
  text3: "#8A8176",
  info: "#5BC8FF",
  // aligned with faberland.online's green (Tailwind green-500 used in its gradients)
  success: "#22C55E",
  error: "#FF2E88",
  /** Display face = the Faberland wordmark's typeface. Falls back to Chakra Petch until the licensed file is installed. */
  display: "'Planet Kosmos', 'Chakra Petch', 'Inter', sans-serif",
  /** Text face = faberland.online's typeface. */
  ui: "'Inter', sans-serif",
};

/**
 * FIBONACCI DESIGN SCALE — Leonardo's canon applied to the interface.
 * Type steps grow by √φ (two steps = φ), landing on Fibonacci numbers 21 · 34 · 55 · 89.
 * Spacing uses the Fibonacci sequence directly.
 */
export const PHI = (1 + Math.sqrt(5)) / 2;
export const TYPE = [21, 27, 34, 43, 55, 70, 89, 113] as const;
export const SPACE = { xs: 8, sm: 13, md: 21, lg: 34, xl: 55, xxl: 89, xxxl: 144 } as const;

/** Snap any requested size onto the scale (nearest step in log space). */
export function snapType(px: number): number {
  let best: number = TYPE[0];
  for (const t of TYPE) if (Math.abs(Math.log(t / px)) < Math.abs(Math.log(best / px))) best = t;
  return best;
}

/** True once the licensed Planet Kosmos file has loaded (it is natively slanted, so no synthetic italic then). */
export const FONT_STATE = { kosmos: false };
export function detectDisplayFont(): Promise<boolean> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve(false);
  return document.fonts.load("700 40px 'Planet Kosmos'").then(() => (FONT_STATE.kosmos = document.fonts.check("700 40px 'Planet Kosmos'")), () => false);
}
export const GOLD_HEX = 0xffc61a;
export const GREEN_HEX = 0x22c55e;
export const AMBER_HEX = 0xf5a81c;
export const EMBER_HEX = 0xff3d00;
export const SUCCESS_HEX = 0x22c55e;
export const INFO_HEX = 0x5bc8ff;
export const ERROR_HEX = 0xff2e88;

export const METHOD_STYLE: Record<string, { color: string; label: string }> = {
  direct: { color: T.gold, label: "MEASURED" },
  derived: { color: T.gold, label: "DERIVED" },
  estimated: { color: T.text3, label: "ESTIMATED" },
  manual: { color: T.ember, label: "MANUAL" },
  conflicted: { color: T.ember, label: "CONFLICTED" },
};
