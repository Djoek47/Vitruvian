import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Mesh } from "../body/mannequin";
import { zipStore } from "../intelligence/zip";

/**
 * Body Evolution 3D viewer (desktop / phone / Quest-browser page, not immersive).
 * Renders mannequin meshes (mm) with a burned-in label layer so recordings and
 * frame exports always carry ACTUAL / INTERPOLATED / HYPOTHETICAL labels.
 */
export type ViewStyle = "gold-wire" | "blue-holo" | "solid" | "skin";
export type ViewDir = "front" | "side" | "back" | "free" | "orbit";
export type Overlay = { title: string; kind: string; date: string; lines: string[]; timeline?: { ticks: number[]; u: number; labels: string[] } };

const GOLD = new THREE.Color(0xffc61a);
const BLUE = new THREE.Color(0x5bc8ff);
const EMBER = new THREE.Color(0xff3d00);

const holoVert = `varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vC;
attribute vec3 color;
void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); vC=color; gl_Position=projectionMatrix*viewMatrix*w; }`;
const holoFrag = `uniform vec3 uColor; uniform float uUseVC; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vC;
void main(){ float rim=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.0); float scan=0.85+0.15*step(0.5,fract(vW.y*0.04-uTime*0.3));
vec3 c=mix(uColor,vC,uUseVC); gl_FragColor=vec4(c*(0.55+rim*0.9),(0.12+rim*0.8)*scan); }`;

export class EvolutionViewer {
  readonly gl: HTMLCanvasElement;
  readonly out: HTMLCanvasElement; // composited (3D + labels) — this is what gets recorded
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private meshes: THREE.Mesh[] = [];
  private wires: THREE.LineSegments[] = [];
  private style: ViewStyle = "gold-wire";
  private dir: ViewDir = "front";
  private t0 = performance.now();
  overlay: Overlay | null = null;
  private raf = 0;

  constructor(host: HTMLElement, private w = 960, private h = 600) {
    this.gl = document.createElement("canvas");
    this.out = document.createElement("canvas");
    this.out.width = w;
    this.out.height = h;
    this.out.className = "viewer";
    host.appendChild(this.out);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.gl, antialias: true, preserveDrawingBuffer: true, alpha: false });
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x0d0b08, 1);
    this.camera = new THREE.PerspectiveCamera(32, w / h, 0.05, 50);
    this.controls = new OrbitControls(this.camera, this.out);
    this.controls.target.set(0, 0.95, 0);
    this.controls.enableDamping = true;
    this.scene.add(new THREE.HemisphereLight(0xfff6e6, 0x1a1611, 1.2));
    const d = new THREE.DirectionalLight(0xffffff, 1.4);
    d.position.set(1.5, 3, 2.5);
    this.scene.add(d);
    // projector base rings
    for (const [r, o] of [[0.55, 0.5], [0.7, 0.3], [0.85, 0.18]] as const) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.008, 96), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: o, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      this.scene.add(ring);
    }
    const grid = new THREE.GridHelper(6, 30, 0x3a2c08, 0x231e17);
    this.scene.add(grid);
    this.setView("front");
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.render();
    };
    loop();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
  }

  /** Show one or two bodies. colors: per-vertex RGB (0..1) for change maps. */
  show(meshes: Mesh[], opts: { layout?: "overlay" | "side"; colors?: (Float32Array | null)[] } = {}) {
    for (const m of [...this.meshes, ...this.wires]) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.meshes = [];
    this.wires = [];
    meshes.forEach((mesh, i) => {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(mesh.vertices.length * 3);
      mesh.vertices.forEach((v, k) => pos.set(v, k * 3));
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const col = opts.colors?.[i] ?? new Float32Array(mesh.vertices.length * 3).fill(1);
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const idx: number[] = [];
      for (const f of mesh.faces) for (let k = 1; k < f.length - 1; k++) idx.push(f[0], f[k], f[k + 1]);
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, this.material(i, !!opts.colors?.[i]));
      m.scale.setScalar(0.001);
      if (opts.layout === "side" && meshes.length > 1) m.position.x = (i - (meshes.length - 1) / 2) * 0.75;
      this.scene.add(m);
      this.meshes.push(m);
      const wire = new THREE.LineSegments(new THREE.WireframeGeometry(g), new THREE.LineBasicMaterial({ color: i === 0 ? (this.style === "blue-holo" ? BLUE : GOLD) : EMBER, transparent: true, opacity: this.style === "solid" || this.style === "skin" ? 0.0 : 0.22 }));
      wire.scale.copy(m.scale);
      wire.position.copy(m.position);
      this.scene.add(wire);
      this.wires.push(wire);
    });
  }

  /** Update vertex positions of body i (mm) — used for interpolation playback. */
  setPositions(pos: Float32Array, i = 0) {
    const m = this.meshes[i];
    if (!m) return;
    const a = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    (a.array as Float32Array).set(pos);
    a.needsUpdate = true;
    m.geometry.computeVertexNormals();
    const w = this.wires[i];
    if (w) {
      w.geometry.dispose();
      w.geometry = new THREE.WireframeGeometry(m.geometry);
    }
  }

  setStyle(s: ViewStyle, skinHex = "#c69c7a") {
    this.style = s;
    this.meshes.forEach((m, i) => {
      const hasVC = !!(m.material as THREE.ShaderMaterial).uniforms?.uUseVC?.value;
      m.material = this.material(i, hasVC, skinHex);
    });
    this.wires.forEach((w, i) => ((w.material as THREE.LineBasicMaterial).opacity = s === "solid" || s === "skin" ? 0 : i === 0 ? 0.25 : 0.35));
    this.wires.forEach((w, i) => (w.material as THREE.LineBasicMaterial).color.copy(i === 0 ? (s === "blue-holo" ? BLUE : GOLD) : EMBER));
  }

  private material(i: number, vertexColors: boolean, skinHex = "#c69c7a"): THREE.Material {
    if (this.style === "solid" || this.style === "skin") {
      const c = this.style === "skin" ? new THREE.Color(skinHex) : new THREE.Color(i === 0 ? 0xb8ab98 : 0xff7a4d);
      return new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, vertexColors, transparent: i > 0, opacity: i > 0 ? 0.55 : 1 });
    }
    return new THREE.ShaderMaterial({
      vertexShader: holoVert, fragmentShader: holoFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: i === 0 ? (this.style === "blue-holo" ? BLUE : GOLD) : EMBER }, uUseVC: { value: vertexColors ? 1 : 0 }, uTime: { value: 0 } },
    });
  }

  setView(d: ViewDir) {
    this.dir = d;
    const r = 3.6;
    const ang = d === "side" ? Math.PI / 2 : d === "back" ? Math.PI : 0;
    if (d !== "free") {
      this.camera.position.set(Math.sin(ang) * r, 1.05, Math.cos(ang) * r);
      this.controls.target.set(0, 0.92, 0);
    }
    this.controls.update();
  }

  render() {
    const t = (performance.now() - this.t0) / 1000;
    if (this.dir === "orbit") {
      const r = 3.6;
      this.camera.position.set(Math.sin(t * 0.5) * r, 1.05, Math.cos(t * 0.5) * r);
      this.camera.lookAt(0, 0.92, 0);
    } else this.controls.update();
    for (const m of this.meshes) {
      const u = (m.material as THREE.ShaderMaterial).uniforms?.uTime;
      if (u) u.value = t;
    }
    this.renderer.render(this.scene, this.camera);
    const c = this.out.getContext("2d")!;
    c.drawImage(this.gl, 0, 0, this.w, this.h);
    if (this.overlay) drawOverlay(c, this.w, this.h, this.overlay);
  }

  /** Record a sequence in real time. frameAt(u) updates positions + overlay. */
  async record(durationS: number, frameAt: (u: number) => void): Promise<{ blob: Blob; mime: string }> {
    const stream = this.out.captureStream(30);
    const mime = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error("Video recording is not supported in this browser — use the image-sequence export.");
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<void>((res) => (rec.onstop = () => res()));
    rec.start(250);
    const start = performance.now();
    await new Promise<void>((res) => {
      const step = () => {
        const u = Math.min(1, (performance.now() - start) / (durationS * 1000));
        frameAt(u);
        this.render();
        if (u < 1) requestAnimationFrame(step);
        else res();
      };
      step();
    });
    await new Promise((r) => setTimeout(r, 300));
    rec.stop();
    await done;
    return { blob: new Blob(chunks, { type: mime.split(";")[0] }), mime };
  }

  /** Deterministic frame-by-frame PNG export (zip). */
  async frames(n: number, frameAt: (u: number) => void): Promise<Blob> {
    const files: { name: string; data: Uint8Array }[] = [];
    for (let i = 0; i < n; i++) {
      frameAt(n === 1 ? 1 : i / (n - 1));
      this.render();
      const b = await new Promise<Blob>((res) => this.out.toBlob((x) => res(x!), "image/png"));
      files.push({ name: `frame_${String(i).padStart(4, "0")}.png`, data: new Uint8Array(await b.arrayBuffer()) });
    }
    return new Blob([zipStore(files) as BlobPart], { type: "application/zip" });
  }

  /** Filmstrip PNG: one panel per keyframe, side by side. */
  async filmstrip(states: (() => void)[]): Promise<Blob> {
    const strip = document.createElement("canvas");
    const cw = Math.round(this.w / 2);
    strip.width = cw * states.length;
    strip.height = this.h;
    const c = strip.getContext("2d")!;
    for (let i = 0; i < states.length; i++) {
      states[i]();
      this.render();
      c.drawImage(this.out, this.w / 4, 0, cw, this.h, i * cw, 0, cw, this.h);
    }
    return new Promise((res) => strip.toBlob((b) => res(b!), "image/png"));
  }
}

function drawOverlay(c: CanvasRenderingContext2D, w: number, h: number, o: Overlay) {
  c.save();
  c.font = "italic 700 20px 'Chakra Petch', sans-serif";
  c.fillStyle = "#FFC61A";
  c.fillText(o.title, 24, 36);
  const kindColor = o.kind === "ACTUAL SCAN" ? "#3DD68C" : o.kind.startsWith("HYPOTHETICAL") ? "#FF2E88" : "#C9BFB0";
  c.font = "700 15px Inter, sans-serif";
  const kw = c.measureText(o.kind).width + 24;
  c.strokeStyle = kindColor;
  c.lineWidth = 2;
  if (o.kind !== "ACTUAL SCAN") c.setLineDash([6, 4]);
  c.strokeRect(24, 50, kw, 28);
  c.setLineDash([]);
  c.fillStyle = kindColor;
  c.fillText(o.kind, 36, 70);
  c.font = "600 22px 'Chakra Petch', sans-serif";
  c.fillStyle = "#FFF6E6";
  c.fillText(o.date, 24, 112);
  c.font = "500 15px Inter, sans-serif";
  c.fillStyle = "#C9BFB0";
  o.lines.forEach((l, i) => c.fillText(l, 24, 142 + i * 22));
  if (o.kind !== "ACTUAL SCAN") {
    c.fillStyle = "#8A8176";
    c.fillText(o.kind.startsWith("HYPOTHETICAL") ? "Simulation — not a measurement" : "Visual interpolation between scans — not a measurement", 24, h - 64);
  }
  if (o.timeline) {
    const x0 = 24;
    const x1 = w - 24;
    const y = h - 32;
    c.strokeStyle = "rgba(255,198,26,0.35)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x0, y);
    c.lineTo(x1, y);
    c.stroke();
    o.timeline.ticks.forEach((t, i) => {
      const x = x0 + (x1 - x0) * t;
      c.fillStyle = "#FFC61A";
      c.beginPath();
      c.arc(x, y, 6, 0, Math.PI * 2);
      c.fill();
      c.font = "600 12px Inter, sans-serif";
      c.fillStyle = "#C9BFB0";
      c.textAlign = i === 0 ? "left" : i === o.timeline!.ticks.length - 1 ? "right" : "center";
      c.fillText(o.timeline!.labels[i] ?? "", x, y - 12);
      c.textAlign = "left";
    });
    const px = x0 + (x1 - x0) * o.timeline.u;
    c.fillStyle = "#FFF6E6";
    c.fillRect(px - 2, y - 10, 4, 20);
  }
  c.restore();
}
