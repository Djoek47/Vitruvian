import * as THREE from "three";
import { CanvasPanel } from "../ui/canvasPanel";
import { drawControllers, type BtnState } from "../ui/questController";
import type { HotspotId } from "../ui/questControllerArt";
import { T } from "../ui/theme";

/**
 * Floating hint card above each physical controller, drawn with the Figma
 * Touch Plus artwork: the button you should press right now is lit using the
 * design's hover / press / hold states, with a one-line caption.
 */
export type HintSpec = { states: Partial<Record<HotspotId, BtnState>>; labels: Partial<Record<HotspotId, string>>; caption: string } | null;

export class ControllerHints {
  readonly cards: Record<"left" | "right", CanvasPanel>;
  private t = 0;

  constructor(scene: THREE.Scene) {
    this.cards = { left: new CanvasPanel(560, 470, 0.13, { transparent: true }), right: new CanvasPanel(560, 470, 0.13, { transparent: true }) };
    for (const c of Object.values(this.cards)) {
      c.mesh.renderOrder = 40;
      c.mesh.visible = false;
      scene.add(c.mesh);
    }
  }

  update(dt: number, side: "left" | "right", gripPos: THREE.Vector3 | null, head: THREE.Vector3, spec: HintSpec) {
    this.t += dt;
    const card = this.cards[side];
    card.mesh.visible = !!(spec && gripPos);
    if (!spec || !gripPos) return;
    // float 11 cm above the controller, slightly toward the head, facing the head
    const toHead = new THREE.Vector3().subVectors(head, gripPos).setY(0).normalize();
    card.mesh.position.copy(gripPos).add(new THREE.Vector3(0, 0.11, 0)).addScaledVector(toHead, 0.03);
    card.mesh.lookAt(head);
    // Redraw only when the hint changes — texture uploads are the expensive part on a headset.
    const sig = JSON.stringify(spec);
    card.draw(sig, (g) => {
      const c = g.ctx;
      c.fillStyle = "rgba(13,11,8,0.78)";
      c.beginPath();
      c.roundRect(4, 4, 552, 462, 28);
      c.fill();
      c.fillStyle = "rgba(255,198,26,0.5)";
      c.fillRect(30, 4, 500, 3);
      drawControllers(c, 12, 18, 536, { side, states: spec.states, labels: spec.labels, time: 0 });
      g.text(spec.caption, 280, 444, { size: 30, weight: 700, color: T.gold, align: "center", maxW: 520 });
    });
  }
}
