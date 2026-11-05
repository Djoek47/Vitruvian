import * as THREE from "three";
import { FONT_STATE, snapType, T } from "./theme";

/**
 * Immediate-mode world-space panel: a Canvas2D texture on a plane. Each redraw
 * re-registers hit regions; ray hits are mapped through UV → canvas pixels.
 * Redraw only when the screen's state signature changes (texture uploads are
 * the expensive part on a Quest).
 */
export type Rect = { x: number; y: number; w: number; h: number };
type Hit = Rect & { id: string; onClick: () => void; disabled?: boolean };

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export class CanvasPanel {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  readonly mesh: THREE.Mesh;
  hits: Hit[] = [];
  hoverId: string | null = null;
  pressId: string | null = null;
  private sig = "";
  t = 0;

  constructor(readonly pxW: number, readonly pxH: number, readonly widthM: number, readonly opts: { transparent?: boolean } = {}) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = pxW;
    this.canvas.height = pxH;
    this.ctx = this.canvas.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    const heightM = (widthM * pxH) / pxW;
    const mat = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, heightM), mat);
    this.mesh.userData.panel = this;
    this.mesh.renderOrder = 10;
  }

  /** Redraw if `signature` changed (or force). */
  draw(signature: string, fn: (g: CanvasPanel) => void, force = false) {
    const s = signature + "|" + this.hoverId + "|" + this.pressId;
    if (!force && s === this.sig) return;
    this.sig = s;
    this.hits = [];
    this.ctx.clearRect(0, 0, this.pxW, this.pxH);
    fn(this);
    this.texture.needsUpdate = true;
  }
  invalidate() {
    this.sig = "";
  }

  hitAt(uv: THREE.Vector2): Hit | null {
    const x = uv.x * this.pxW;
    const y = (1 - uv.y) * this.pxH;
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (!h.disabled && x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
  }

  // ── drawing primitives ────────────────────────────────────────────────────
  /** Panel chrome: glass fill, gold top-edge highlight, Stark corner brackets. */
  chrome(primary = true) {
    const c = this.ctx;
    const r = primary ? 28 : 20;
    c.save();
    rr(c, 4, 4, this.pxW - 8, this.pxH - 8, r);
    const g = c.createLinearGradient(0, 0, 0, this.pxH);
    g.addColorStop(0, "rgba(26,22,17,0.86)");
    g.addColorStop(1, "rgba(13,11,8,0.80)");
    c.fillStyle = g;
    c.fill();
    c.clip();
    // fine Da Vinci grid
    c.strokeStyle = "rgba(255,198,26,0.045)";
    c.lineWidth = 1;
    for (let x = 0; x < this.pxW; x += 48) line(c, x, 0, x, this.pxH);
    for (let y = 0; y < this.pxH; y += 48) line(c, 0, y, this.pxW, y);
    c.restore();
    // top-edge highlight
    c.fillStyle = "rgba(255,198,26,0.5)";
    c.fillRect(r, 4, this.pxW - 2 * r, 3);
    // corner brackets
    c.strokeStyle = "rgba(255,198,26,0.75)";
    c.lineWidth = 4;
    const L = 56;
    const m = 14;
    const W = this.pxW;
    const H = this.pxH;
    poly(c, [[m, m + L], [m, m], [m + L, m]]);
    poly(c, [[W - m - L, m], [W - m, m], [W - m, m + L]]);
    poly(c, [[m, H - m - L], [m, H - m], [m + L, H - m]]);
    poly(c, [[W - m - L, H - m], [W - m, H - m], [W - m, H - m - L]]);
  }

  text(s: string, x: number, y: number, o: { size?: number; weight?: number; color?: string; align?: CanvasTextAlign; font?: "ui" | "display"; italic?: boolean; spacing?: number; maxW?: number } = {}) {
    const c = this.ctx;
    // every size lands on the Fibonacci type scale (uniform across screens)
    const size = snapType(o.size ?? 40);
    const display = o.font === "display";
    // Planet Kosmos is natively slanted; synthesize italic only for the fallback face
    const italic = o.italic && !(display && FONT_STATE.kosmos);
    c.font = `${italic ? "italic " : ""}${o.weight ?? 500} ${size}px ${display ? T.display : T.ui}`;
    // wide display faces never overflow the panel: default max width = space to the panel edge
    if (o.maxW === undefined) {
      const room = (o.align ?? "left") === "left" ? this.pxW - x - 40 : (o.align === "right" ? x - 40 : Math.min(x, this.pxW - x) * 2 - 80);
      if (room > 0) o = { ...o, maxW: room };
    }
    c.fillStyle = o.color ?? T.text;
    c.textAlign = o.align ?? "left";
    c.textBaseline = "alphabetic";
    if (o.spacing) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${o.spacing}px`;
    c.fillText(s, x, y, o.maxW);
    if (o.spacing) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }

  /** Word-wrapped paragraph; returns the y after the last line. */
  para(s: string, x: number, y: number, maxW: number, o: { size?: number; color?: string; lh?: number; weight?: number } = {}) {
    const c = this.ctx;
    const size = snapType(o.size ?? 38);
    c.font = `${o.weight ?? 500} ${size}px ${T.ui}`;
    c.fillStyle = o.color ?? T.text2;
    c.textAlign = "left";
    // line height: requested, but never tighter than size × 1.272 (√φ)
    const lh = Math.max(o.lh ?? size * 1.382, size * 1.272);
    let lineS = "";
    for (const w of s.split(" ")) {
      const t = lineS ? lineS + " " + w : w;
      if (c.measureText(t).width > maxW && lineS) {
        c.fillText(lineS, x, y);
        y += lh;
        lineS = w;
      } else lineS = t;
    }
    if (lineS) c.fillText(lineS, x, y);
    return y + lh;
  }

  label(s: string, x: number, y: number, color: string = T.text2) {
    this.text(s.toUpperCase(), x, y, { size: 21, weight: 700, color, spacing: 5 });
  }

  button(id: string, r: Rect, label: string, onClick: () => void, o: { variant?: ButtonVariant; disabled?: boolean; glyph?: string; size?: number } = {}) {
    const c = this.ctx;
    const v = o.variant ?? "secondary";
    const hover = this.hoverId === id && !o.disabled;
    const press = this.pressId === id && !o.disabled;
    const k = press ? 0.97 : 1;
    const x = r.x + (r.w * (1 - k)) / 2;
    const y = r.y + (r.h * (1 - k)) / 2;
    const w = r.w * k;
    const h = r.h * k;
    c.save();
    if (o.disabled) c.globalAlpha = 0.35;
    rr(c, x, y, w, h, Math.min(18, h / 2));
    if (v === "primary") {
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, press ? T.amber : T.gold);
      g.addColorStop(1, T.amber);
      c.fillStyle = g;
    } else if (v === "destructive") c.fillStyle = hover ? "rgba(255,46,136,0.22)" : "rgba(255,46,136,0.12)";
    else if (v === "ghost") c.fillStyle = hover ? "rgba(255,246,230,0.08)" : "rgba(0,0,0,0)";
    else c.fillStyle = hover ? T.surface2 : T.surface;
    c.fill();
    if (hover) {
      // ray-hover: gold outline + outer glow
      c.shadowColor = "rgba(255,198,26,0.8)";
      c.shadowBlur = 24;
      c.strokeStyle = v === "primary" ? "#FFF6E6" : T.gold;
      c.lineWidth = 4;
      c.stroke();
      c.shadowBlur = 0;
    } else if (v !== "primary") {
      // ghost buttons keep a visible outline so they read as buttons at VR distance (UI review #4)
      c.strokeStyle = v === "ghost" ? "rgba(255,246,230,0.22)" : "rgba(255,198,26,0.22)";
      c.lineWidth = 2;
      c.stroke();
    }
    const color = v === "primary" ? T.panel : v === "destructive" ? T.error : hover ? T.text : T.text2;
    const size = snapType(o.size ?? 34);
    c.font = `600 ${size}px ${T.ui}`;
    c.fillStyle = color;
    c.textAlign = "center";
    c.textBaseline = "middle";
    const lbl = o.glyph ? `${label}` : label;
    c.fillText(lbl, x + w / 2 + (o.glyph ? 22 : 0), y + h / 2 + 2);
    if (o.glyph) {
      const tw = c.measureText(lbl).width;
      glyph(c, o.glyph, x + w / 2 - tw / 2 - 18, y + h / 2, color);
    }
    c.restore();
    this.hits.push({ ...r, id, onClick, disabled: o.disabled });
  }

  /** Confidence badge per design system: ● measured, ○ derived, gray estimated, ember manual, ▲ conflicted. */
  badge(method: string, conflicted: boolean, x: number, y: number) {
    const c = this.ctx;
    c.save();
    const kind = conflicted ? "conflicted" : method;
    const color = kind === "estimated" ? T.text3 : kind === "manual" || kind === "conflicted" ? T.ember : T.gold;
    c.lineWidth = 4;
    if (kind === "conflicted") {
      c.strokeStyle = T.ember;
      poly(c, [[x, y - 12], [x + 13, y + 10], [x - 13, y + 10], [x, y - 12]]);
    } else {
      c.beginPath();
      c.arc(x, y, 10, 0, Math.PI * 2);
      if (kind === "derived") {
        c.strokeStyle = color;
        c.stroke();
      } else {
        c.fillStyle = color;
        c.fill();
      }
    }
    c.restore();
  }

  progressBar(x: number, y: number, w: number, v: number, color: string = T.gold) {
    const c = this.ctx;
    c.fillStyle = "rgba(255,246,230,0.08)";
    rr(c, x, y, w, 10, 5);
    c.fill();
    c.fillStyle = color;
    rr(c, x, y, Math.max(10, w * Math.min(1, v)), 10, 5);
    c.fill();
  }

  divider(x: number, y: number, w: number) {
    const c = this.ctx;
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "rgba(255,198,26,0)");
    g.addColorStop(0.5, "rgba(255,198,26,0.35)");
    g.addColorStop(1, "rgba(255,198,26,0)");
    c.fillStyle = g;
    c.fillRect(x, y, w, 2);
  }

  image(img: HTMLImageElement | undefined, x: number, y: number, w: number, h: number, alpha = 1) {
    if (!img || !img.complete || !img.naturalWidth) return;
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(img, x, y, w, h);
    this.ctx.restore();
  }
}

export function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
export function line(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}
export function poly(c: CanvasRenderingContext2D, pts: number[][]) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}

/** Controller input glyphs (A/B/X/Y/trigger/grip/stick). */
export function glyph(c: CanvasRenderingContext2D, g: string, x: number, y: number, color: string) {
  c.save();
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 3;
  if (["A", "B", "X", "Y"].includes(g)) {
    c.beginPath();
    c.arc(x, y, 16, 0, Math.PI * 2);
    c.stroke();
    c.font = `700 20px ${T.ui}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(g, x, y + 1);
  } else if (g === "trigger") {
    c.beginPath();
    c.moveTo(x - 8, y - 16);
    c.quadraticCurveTo(x + 14, y - 6, x + 4, y + 16);
    c.stroke();
  } else if (g === "stick") {
    c.beginPath();
    c.arc(x, y, 15, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(x, y, 5, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
