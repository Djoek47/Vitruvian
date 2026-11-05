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
  success: "#3DD68C",
  error: "#FF2E88",
  display: "'Chakra Petch', 'Inter', sans-serif",
  ui: "'Inter', sans-serif",
};
export const GOLD_HEX = 0xffc61a;
export const AMBER_HEX = 0xf5a81c;
export const EMBER_HEX = 0xff3d00;
export const SUCCESS_HEX = 0x3dd68c;
export const INFO_HEX = 0x5bc8ff;
export const ERROR_HEX = 0xff2e88;

export const METHOD_STYLE: Record<string, { color: string; label: string }> = {
  direct: { color: T.gold, label: "MEASURED" },
  derived: { color: T.gold, label: "DERIVED" },
  estimated: { color: T.text3, label: "ESTIMATED" },
  manual: { color: T.ember, label: "MANUAL" },
  conflicted: { color: T.ember, label: "CONFLICTED" },
};
