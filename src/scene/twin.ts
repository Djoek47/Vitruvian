import * as THREE from "three";
import type { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { buildMannequin, type Mesh } from "../body/mannequin";
import type { BodyPassport } from "../passport/passport";
import { GOLD_HEX } from "../ui/theme";
import { fatLines, setLinePositions } from "./fx";

/**
 * THE VITRUVIAN TWIN — the person's own body, generated live from their
 * measurements (same mannequin that is exported to Marvelous Designer), drawn
 * as a gold hologram with horizontal contour lines, or tinted with their
 * captured skin tone. At chest / waist / hip / neck the contour perimeter
 * equals the measured circumference.
 *
 * Modes: "lines" (contours only), "hologram" (fresnel shell + contours), "skin" (skin-tone shell + gold contours).
 */
export type TwinMode = "lines" | "hologram" | "skin";

const holoVert = `
varying vec3 vN; varying vec3 vW; varying vec3 vV;
void main(){
  vec4 w = modelMatrix * vec4(position,1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const holoFrag = `
uniform vec3 uColor; uniform float uTime; uniform float uOpacity;
varying vec3 vN; varying vec3 vW; varying vec3 vV;
void main(){
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  float scan = smoothstep(0.0, 0.08, abs(fract(vW.y * 40.0 - uTime * 0.4) - 0.5)) ;
  float sweep = exp(-pow((fract(uTime * 0.12) * 2.2 - 0.1) - vW.y, 2.0) * 60.0);
  float a = (0.06 + rim * 0.75) * (0.75 + 0.25 * scan) + sweep * 0.25;
  gl_FragColor = vec4(uColor * (0.6 + rim), a * uOpacity);
}`;

export class BodyTwin {
  readonly group = new THREE.Group();
  private shell: THREE.Mesh;
  private contours: LineSegments2;
  /** particle constellation on every mesh vertex (holographic "measured points" look) */
  private points: THREE.Points;
  private holoMat: THREE.ShaderMaterial;
  private skinMat: THREE.MeshStandardMaterial;
  private sig = "";
  mode: TwinMode = "hologram";
  mesh: Mesh | null = null;

  constructor() {
    this.holoMat = new THREE.ShaderMaterial({
      vertexShader: holoVert, fragmentShader: holoFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(GOLD_HEX) }, uTime: { value: 0 }, uOpacity: { value: 1 } },
    });
    this.skinMat = new THREE.MeshStandardMaterial({ color: 0xc69c7a, roughness: 0.62, metalness: 0, transparent: true, opacity: 0.96 });
    this.shell = new THREE.Mesh(new THREE.BufferGeometry(), this.holoMat);
    this.contours = fatLines([], GOLD_HEX, 0.0025, 0.55);
    this.points = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xfff0c2, size: 0.0065, sizeAttenuation: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.points.frustumCulled = false;
    this.group.add(this.shell, this.contours, this.points);
    this.group.scale.setScalar(0.001); // mannequin is in millimetres
  }

  /** Rebuild from a passport when its measurements change. */
  update(p: BodyPassport | null, mode: TwinMode, skinHex: string | null) {
    this.mode = mode;
    const sig = p ? p.measurements.map((m) => m.id + m.value.toFixed(0)).join() + "|" + p.landmarks.length : "none";
    if (sig !== this.sig) {
      this.sig = sig;
      if (p && p.measurements.length) this.rebuild(p);
    }
    this.group.visible = !!this.mesh;
    this.shell.visible = mode !== "lines";
    this.points.visible = mode !== "skin";
    this.shell.material = mode === "skin" ? this.skinMat : this.holoMat;
    if (skinHex) this.skinMat.color.set(skinHex);
  }

  private rebuild(p: BodyPassport) {
    const mesh = buildMannequin(p);
    this.mesh = mesh;
    const pos: number[] = [];
    const idx: number[] = [];
    for (const v of mesh.vertices) pos.push(v[0], v[1], v[2]);
    for (const f of mesh.faces) for (let k = 1; k < f.length - 1; k++) idx.push(f[0], f[k], f[k + 1]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.shell.geometry.dispose();
    this.shell.geometry = g;
    this.points.geometry = g; // shares the vertex buffer
    // contour lines: every ring of the loft (each quad's bottom edge → horizontal ring segments)
    const seg: number[] = [];
    for (const f of mesh.faces) {
      if (f.length !== 4) continue;
      const a = mesh.vertices[f[0]];
      const b = mesh.vertices[f[3]];
      if (Math.abs(a[1] - b[1]) < 0.01) seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    setLinePositions(this.contours, seg); // LineMaterial worldUnits widths are in view space → metres regardless of group scale
  }

  tick(t: number) {
    this.holoMat.uniforms.uTime.value = t;
    (this.points.material as THREE.PointsMaterial).opacity = 0.6 + 0.25 * Math.sin(t * 1.618);
  }
}
