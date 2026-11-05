import * as THREE from "three";
import type { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { AMBER_HEX, EMBER_HEX, GOLD_HEX, SUCCESS_HEX } from "../ui/theme";
import { CanvasPanel } from "../ui/canvasPanel";
import { T } from "../ui/theme";
import { aimLine, glowSprite, unitLine } from "./fx";

/**
 * Measurement beam between the two controller tips: core beam + glow, rotating
 * endpoint reticles, travelling particles, a hold-progress arc and a floating
 * readout chip (240 × 64 dmm design spec, panel-glass, gold text).
 */
export type BeamState = "idle" | "live" | "stable" | "holding" | "captured" | "lost";

export class MeasurementBeam {
  readonly group = new THREE.Group();
  private core: LineSegments2;
  private glow: LineSegments2;
  private ends: THREE.Group[] = [];
  private particles: THREE.Points;
  private arc: THREE.Mesh;
  readonly chip = new CanvasPanel(640, 220, 0.26);
  private t = 0;
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  state: BeamState = "idle";

  constructor() {
    this.core = unitLine(GOLD_HEX, 0.0025, 1);
    this.glow = unitLine(AMBER_HEX, 0.012, 0.22);
    this.group.add(this.glow, this.core);
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0012, 8, 48), new THREE.MeshBasicMaterial({ color: GOLD_HEX, transparent: true, toneMapped: false }));
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0008, 6, 6), new THREE.MeshBasicMaterial({ color: GOLD_HEX, transparent: true, opacity: 0.7, toneMapped: false }));
      ring2.name = "hex";
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.004, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff6e6, toneMapped: false }));
      g.add(ring, ring2, dot, glowSprite(GOLD_HEX, 0.06, 0.6));
      this.ends.push(g);
      this.group.add(g);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * 24), 3));
    this.particles = new THREE.Points(pg, new THREE.PointsMaterial({ color: GOLD_HEX, size: 0.006, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.particles.frustumCulled = false;
    this.group.add(this.particles);
    const ag = new THREE.RingGeometry(0.03, 0.036, 64, 1);
    this.arc = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: GOLD_HEX, side: THREE.DoubleSide, transparent: true, toneMapped: false }));
    this.group.add(this.arc);
    this.chip.mesh.renderOrder = 30;
    this.group.add(this.chip.mesh);
    this.group.visible = false;
  }

  /**
   * @param a,b endpoints (null hides that end)
   * @param readout main number, e.g. "41.3 cm"
   * @param sub second line, e.g. "STABLE · ±1.2 mm"
   */
  update(dt: number, a: THREE.Vector3 | null, b: THREE.Vector3 | null, head: THREE.Vector3, state: BeamState, progress: number, readout: string, sub: string, axes = "") {
    this.t += dt;
    this.state = state;
    const visible = !!(a || b);
    this.group.visible = visible;
    if (!visible) return;
    const color = state === "captured" ? SUCCESS_HEX : state === "lost" ? EMBER_HEX : state === "holding" || state === "stable" ? GOLD_HEX : AMBER_HEX;
    const ends = [a, b];
    ends.forEach((p, i) => {
      const g = this.ends[i];
      g.visible = !!p;
      if (!p) return;
      g.position.copy(p);
      g.lookAt(head);
      g.getObjectByName("hex")!.rotation.z += dt * (i ? -1.2 : 1.2);
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (m && "color" in m && o.type !== "Sprite" && (o as THREE.Mesh).geometry?.type !== "SphereGeometry") m.color.setHex(color);
      });
    });
    const two = !!(a && b);
    this.core.visible = this.glow.visible = this.particles.visible = two;
    let anchor = a ?? b!;
    if (two) {
      this.a.copy(a!);
      this.b.copy(b!);
      aimLine(this.core, this.a, this.b);
      aimLine(this.glow, this.a, this.b);
      (this.core.material as { color: THREE.Color }).color.setHex(color);
      (this.glow.material as { color: THREE.Color; opacity: number }).color.setHex(color);
      (this.glow.material as { opacity: number }).opacity = state === "holding" ? 0.35 + 0.15 * Math.sin(this.t * 14) : 0.2;
      const arr = (this.particles.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      const speed = state === "holding" ? 1.6 : 0.5;
      for (let i = 0; i < 24; i++) {
        const f = ((this.t * speed + i / 24) % 1);
        arr[i * 3] = this.a.x + (this.b.x - this.a.x) * f;
        arr[i * 3 + 1] = this.a.y + (this.b.y - this.a.y) * f;
        arr[i * 3 + 2] = this.a.z + (this.b.z - this.a.z) * f;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
      (this.particles.material as THREE.PointsMaterial).color.setHex(color);
      anchor = new THREE.Vector3().addVectors(this.a, this.b).multiplyScalar(0.5);
    }
    // progress arc around the anchor (hold-to-capture)
    this.arc.visible = state === "holding" || state === "captured";
    if (this.arc.visible) {
      this.arc.position.copy(a && !b ? a : b && !a ? b : anchor);
      this.arc.lookAt(head);
      const idx = this.arc.geometry.index!;
      this.arc.geometry.setDrawRange(0, Math.floor((idx.count / 6) * Math.min(1, progress)) * 6);
      (this.arc.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
    // readout chip floats above the midpoint, facing the head
    this.chip.mesh.position.copy(anchor).add(new THREE.Vector3(0, 0.08, 0));
    this.chip.mesh.lookAt(head);
    const sc = Math.max(0.6, Math.min(1.6, this.chip.mesh.position.distanceTo(head) / 0.6));
    this.chip.mesh.scale.setScalar(sc);
    const colorCss = state === "captured" ? T.success : state === "lost" ? T.ember : T.gold;
    this.chip.draw(readout + sub + state + axes, (g) => {
      const c = g.ctx;
      const h = axes ? 212 : 162;
      c.fillStyle = "rgba(13,11,8,0.82)";
      c.beginPath();
      c.roundRect(4, 4, 632, h, 24);
      c.fill();
      c.fillStyle = colorCss;
      c.fillRect(4, 4, 8, h);
      c.strokeStyle = "rgba(255,198,26,0.35)";
      c.lineWidth = 2;
      c.stroke();
      g.text(readout, 36, 98, { size: 84, weight: 600, color: colorCss, font: "display" });
      if (axes) g.text(axes, 38, 146, { size: 30, weight: 700, color: T.gold, spacing: 2, maxW: 590 });
      g.text(sub, 38, axes ? 194 : 146, { size: 26, weight: 600, color: T.text2, spacing: 3, maxW: 590 });
    });
  }
}
