import { HOTSPOTS, LEFT_PATHS, RIGHT_PATHS, VIEWBOX, type ArtPath, type HotspotId } from "./questControllerArt";

/**
 * Renders the Figma design's Touch Plus controller artwork (QuestController.tsx)
 * onto a 2D canvas, with the design's hotspot states:
 *   hover = gold ring · press = bright gold · hold = ember (with outer pulse ring)
 */
export type BtnState = "idle" | "hover" | "press" | "hold";
export type Side = "left" | "right" | "both";

const SC: Record<BtnState, { ring: string; fill: string; dot: string; outer: number }> = {
  hover: { ring: "#FFC61A", fill: "rgba(255,198,26,0.15)", dot: "#FFC61A", outer: 18 },
  press: { ring: "#FFD84A", fill: "rgba(255,198,26,0.30)", dot: "#FFD84A", outer: 20 },
  hold: { ring: "#FF3D00", fill: "rgba(255,61,0,0.25)", dot: "#FF3D00", outer: 22 },
  idle: { ring: "rgba(255,246,230,0.35)", fill: "transparent", dot: "rgba(255,246,230,0.5)", outer: 13 },
};

/** Approximate front tips of the controller heads in art space (for the "measuring tip" marker). */
export const TIP_ART = { left: { x: 322, y: 62 }, right: { x: 388, y: 62 } };

const cache = new Map<string, Path2D>();
const p2d = (d: string) => {
  let p = cache.get(d);
  if (!p) cache.set(d, (p = new Path2D(d)));
  return p;
};

function drawPaths(c: CanvasRenderingContext2D, paths: ArtPath[], color: string) {
  for (const p of paths) {
    const path = p2d(p.d);
    if (p.fill) {
      c.save();
      c.globalAlpha = p.fo ?? 1;
      c.fillStyle = p.fill === "currentColor" ? color : p.fill;
      c.fill(path);
      c.restore();
    } else {
      c.lineWidth = p.w || 1;
      c.lineCap = p.round ? "round" : "butt";
      c.lineJoin = p.round ? "round" : "miter";
      c.strokeStyle = color;
      c.stroke(path);
    }
  }
}

export type ControllerDrawOpts = {
  side: Side;
  states?: Partial<Record<HotspotId, BtnState>>;
  /** Custom label per hotspot (e.g. "HOLD · CAPTURE"); hotspots without a label show their default only when active. */
  labels?: Partial<Record<HotspotId, string>>;
  showAllLabels?: boolean;
  color?: string;
  tip?: boolean;
  time?: number;
};

/** Draw into the box (x, y, w); height follows the art's aspect ratio. Returns the drawn height. */
export function drawControllers(c: CanvasRenderingContext2D, x: number, y: number, w: number, o: ControllerDrawOpts): number {
  const half = VIEWBOX.w / 2;
  const artW = o.side === "both" ? VIEWBOX.w : half;
  const s = w / artW;
  const color = o.color ?? "rgba(255,246,230,0.7)";
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (o.side === "right") c.translate(-half, 0);
  // soft glow behind each head (design detail)
  for (const cx of o.side === "both" ? [168, 542] : o.side === "left" ? [168] : [542]) {
    c.fillStyle = "rgba(255,198,26,0.035)";
    c.beginPath();
    c.ellipse(cx, 150, 120, 90, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (o.side !== "right") drawPaths(c, LEFT_PATHS, color);
  if (o.side !== "left") drawPaths(c, RIGHT_PATHS, color);
  const t = o.time ?? 0;
  for (const h of HOTSPOTS) {
    if (o.side === "left" && !h.id.startsWith("l_")) continue;
    if (o.side === "right" && !h.id.startsWith("r_")) continue;
    const st = o.states?.[h.id] ?? "idle";
    const k = SC[st];
    const active = st !== "idle";
    c.save();
    c.translate(h.x, h.y);
    if (st === "hold") {
      c.strokeStyle = "rgba(255,61,0,0.4)";
      c.lineWidth = 1;
      c.beginPath();
      c.arc(0, 0, k.outer + 6 + 2 * Math.sin(t * 8), 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    c.arc(0, 0, k.outer, 0, Math.PI * 2);
    if (k.fill !== "transparent") {
      c.fillStyle = k.fill;
      c.fill();
    }
    if (active) {
      c.shadowColor = k.ring;
      c.shadowBlur = st === "hover" ? 0 : 8;
    }
    c.strokeStyle = k.ring;
    c.globalAlpha = active ? 1 : 0.4;
    c.lineWidth = active ? 2 : 1.5;
    c.stroke();
    c.shadowBlur = 0;
    c.globalAlpha = 1;
    c.fillStyle = k.dot;
    c.beginPath();
    c.arc(0, 0, 3.5, 0, Math.PI * 2);
    c.fill();
    const label = o.labels?.[h.id] ?? (o.showAllLabels || active ? h.label : "");
    if (label) {
      c.font = `600 ${active ? 11 : 9}px Inter, sans-serif`;
      c.textAlign = "center";
      c.fillStyle = active ? k.ring : "rgba(255,246,230,0.45)";
      c.fillText(label, 0, k.outer + 13);
    }
    c.restore();
  }
  if (o.tip) {
    for (const side of ["left", "right"] as const) {
      if (o.side !== "both" && o.side !== side) continue;
      const p = TIP_ART[side];
      c.save();
      c.shadowColor = "#FFC61A";
      c.shadowBlur = 14;
      c.fillStyle = "#FFF6E6";
      c.beginPath();
      c.arc(p.x, p.y, 6, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }
  c.restore();
  return (VIEWBOX.h * w) / artW;
}

/** Same artwork as an SVG string (for the 2D companion page). */
export function controllersSvg(states: Partial<Record<HotspotId, BtnState>> = {}, color = "rgba(255,246,230,0.7)"): string {
  const pathEl = (p: ArtPath) =>
    p.fill
      ? `<path d="${p.d}" fill="${p.fill === "currentColor" ? color : p.fill}" fill-opacity="${p.fo ?? 1}" stroke="none"/>`
      : `<path d="${p.d}" fill="none" stroke="${color}" stroke-width="${p.w || 1}"${p.round ? ' stroke-linecap="round" stroke-linejoin="round"' : ""}/>`;
  const hs = HOTSPOTS.map((h) => {
    const st = states[h.id] ?? "idle";
    const k = SC[st];
    return `<g transform="translate(${h.x} ${h.y})"><circle r="${k.outer}" fill="${k.fill}" stroke="${k.ring}" stroke-opacity="${st === "idle" ? 0.4 : 1}" stroke-width="${st === "idle" ? 1.5 : 2}"/><circle r="3.5" fill="${k.dot}"/><text y="${k.outer + 12}" text-anchor="middle" font-size="9" font-family="Inter" font-weight="600" fill="${st === "idle" ? "rgba(255,246,230,0.45)" : k.ring}">${h.label}</text></g>`;
  }).join("");
  return `<svg viewBox="0 0 ${VIEWBOX.w} ${VIEWBOX.h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Meta Quest Touch Plus controllers"><g>${LEFT_PATHS.map(pathEl).join("")}${RIGHT_PATHS.map(pathEl).join("")}</g>${hs}</svg>`;
}
