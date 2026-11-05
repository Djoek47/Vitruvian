// Self-hosted fonts (OFL) — works offline on the headset, no third-party requests.
import "@fontsource/chakra-petch/500.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/chakra-petch/600-italic.css";
import "@fontsource/chakra-petch/700-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import * as THREE from "three";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { VitruvianApp } from "./app/app";
import { readXRFrame } from "./tracking/webxr";
import type { TrackingFrame } from "./tracking/types";
import { MeasurementBeam } from "./scene/beam";
import { VitruvianHologram } from "./scene/vitruvian";
import { aimLine, circlePts, fatLines, loopSegments, glowSprite, unitLine } from "./scene/fx";
import { GOLD_HEX } from "./ui/theme";
import { store } from "./passport/store";
import { initLanding } from "./landing";
import type { CanvasPanel } from "./ui/canvasPanel";
import { deliverPassport, hostConfig, listenForRequests } from "./integration/faberland";
import { BodyTwin } from "./scene/twin";
import { AvatarSlot } from "./scene/avatar";
import type { Settings } from "./app/app";
import type { Subject } from "./passport/passport";

const host = hostConfig();

// ── optional emulator (development / automated tests only) ───────────────────
const params = new URLSearchParams(location.search);
let simulated = false;
let xrDevice: unknown = null;
if (params.get("emulate")) {
  const { XRDevice, metaQuest3 } = await import("iwer");
  const dev = new XRDevice(metaQuest3, { stereoEnabled: false } as never);
  dev.installRuntime({ forceInstall: true } as never);
  xrDevice = dev;
  simulated = true;
  // Emulator-only: headless software rendering runs ~6 fps, so lower the sample floor
  // (the 600 ms stability window itself is unchanged). Real headsets keep the default.
  const { DEFAULT_STABILIZER } = await import("./measurement/stabilizer");
  DEFAULT_STABILIZER.minSamples = 3;
  DEFAULT_STABILIZER.windowMs = 1500;
  (window as unknown as { __xrdevice: unknown }).__xrdevice = dev;
}

const loadImg = (src: string) => {
  const i = new Image();
  i.src = src;
  return i;
};
const images = { star: loadImg(import.meta.env.BASE_URL + "brand/faberland-star.png"), wordmark: loadImg(import.meta.env.BASE_URL + "brand/faberland-wordmark.png") };

// ── renderer / scene ─────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local-floor");
renderer.xr.setFoveation(0.4);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById("stage")!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.02, 60);
camera.position.set(0.2, 1.6, 0.4);
camera.lookAt(0.2, 1.25, -2);
scene.add(new THREE.HemisphereLight(0xfff6e6, 0x1a1611, 1.6));

// VR environment (hidden in passthrough): warm dark void, Da Vinci floor grid.
const env = new THREE.Group();
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(30, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {},
    vertexShader: "varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
    fragmentShader: "varying vec3 v; void main(){ float h = v.y*0.5+0.5; vec3 c = mix(vec3(0.05,0.04,0.03), vec3(0.012,0.01,0.008), h); c += vec3(0.25,0.14,0.02)*pow(1.0-abs(v.y),18.0)*0.25; gl_FragColor = vec4(c,1.0);} ",
  }),
);
env.add(sky);
const grid = new THREE.GridHelper(24, 48, GOLD_HEX, GOLD_HEX);
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.07;
env.add(grid);
const horizon = fatLines(loopSegments(circlePts(6, 192, 0.001)), GOLD_HEX, 0.01, 0.15);
env.add(horizon);
scene.add(env);

function haptic(hand: "left" | "right", intensity: number, ms: number) {
  const s = renderer.xr.getSession();
  if (!s) return;
  for (const src of s.inputSources) {
    if (src.handedness !== hand) continue;
    const act = src.gamepad?.hapticActuators?.[0] as unknown as { pulse?: (i: number, d: number) => void } | undefined;
    act?.pulse?.(intensity, ms);
  }
}

// ── app objects ──────────────────────────────────────────────────────────────
let draftTimer = 0;
const app = new VitruvianApp({
  exitXR: () => renderer.xr.getSession()?.end(),
  savePassport: async (p) => {
    await store.savePassport(p);
    landing.refresh();
    if (host.enabled) deliverPassport(p, host);
  },
  saveDraft: (s) => {
    clearTimeout(draftTimer);
    draftTimer = window.setTimeout(() => (s ? store.saveDraft(s) : store.clearDraft()), 150);
  },
  saveStudio: (r) => void store.setKv("rulerLog", JSON.parse(JSON.stringify(r))),
  saveSettings: (st) => void store.setKv("settings", st),
  saveSubject: (sj) => void store.setKv("subject", JSON.parse(JSON.stringify(sj))),
  replacePanels: () => {
    placed = false;
  },
  haptic: (hand, intensity, ms) => haptic(hand, intensity, ms),
  images,
});
app.simulated = simulated;

const hologram = new VitruvianHologram();
hologram.group.userData.baseYaw = 0;
scene.add(hologram.group);
// The measured twin and the optional MetaHuman/UE5 avatar live inside the hologram (same floor origin).
const twin = new BodyTwin();
hologram.group.add(twin.group);
const avatar = new AvatarSlot();
hologram.group.add(avatar.group);
async function loadAvatar(src: string | ArrayBuffer) {
  try {
    await avatar.load(src);
    const p = app.passport();
    if (p) avatar.fit(p);
    return avatar.lastFit;
  } catch (e) {
    console.warn("avatar load failed", e);
    return null;
  }
}
// Ground marker: shows where the calibrated floor is (step 1).
const ground = new THREE.Group();
ground.add(fatLines(loopSegments(circlePts(0.35, 96, 0.002)), GOLD_HEX, 0.006, 0.8));
ground.add(fatLines(loopSegments(circlePts(0.5, 96, 0.002)), GOLD_HEX, 0.003, 0.4));
for (let i = 0; i < 4; i++) {
  const a = (i * Math.PI) / 2;
  ground.add(fatLines([Math.cos(a) * 0.38, 0.002, Math.sin(a) * 0.38, Math.cos(a) * 0.5, 0.002, Math.sin(a) * 0.5], GOLD_HEX, 0.006, 0.8));
}
ground.visible = false;
scene.add(ground);
scene.add(app.panel.mesh);
const beam = new MeasurementBeam();
scene.add(beam.group);

// tip reticles (always shown so the user knows which physical point measures)
const tips = [0, 1].map(() => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.0045, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff6e6, toneMapped: false })));
  g.add(glowSprite(GOLD_HEX, 0.035, 0.7));
  scene.add(g);
  return g;
});
// rays + cursors
const rays = [0, 1].map(() => {
  const l = unitLine(GOLD_HEX, 0.002, 0.55);
  const cur = glowSprite(GOLD_HEX, 0.03, 1);
  scene.add(l, cur);
  return { l, cur };
});
// captured landmarks pinned in the world (visible on your body in passthrough)
const worldMarks = new THREE.Group();
scene.add(worldMarks);

// controller models (Touch Plus glTF from the WebXR input-profiles CDN)
const factory = new XRControllerModelFactory();
for (let i = 0; i < 2; i++) {
  const grip = renderer.xr.getControllerGrip(i);
  grip.add(factory.createControllerModel(grip));
  scene.add(grip);
}

// ── placement ────────────────────────────────────────────────────────────────
let placed = false;
function place(head: THREE.Vector3, quat: THREE.Quaternion, floorY = 0) {
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
  fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const yaw = Math.atan2(-fwd.x, -fwd.z);
  const dist = { near: 1.1, normal: 1.35, far: 1.6 }[app.settings.panelDistance];
  app.panel.mesh.position.copy(head).addScaledVector(fwd, dist).addScaledVector(right, -0.42 * (dist / 1.35));
  app.panel.mesh.position.y = head.y - 0.12;
  app.panel.mesh.lookAt(head.x, app.panel.mesh.position.y, head.z);
  hologram.group.position.copy(head).addScaledVector(fwd, 2.4).addScaledVector(right, 1.0);
  hologram.group.position.y = floorY;
  hologram.group.userData.baseYaw = yaw - 0.35;
  placed = true;
}
place(new THREE.Vector3(0, 1.6, 0), new THREE.Quaternion());

// ── desktop pointer (no headset) ─────────────────────────────────────────────
const mouse = { ndc: new THREE.Vector2(), down: false, clicked: false, inside: false };
renderer.domElement.addEventListener("pointermove", (e) => {
  mouse.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  mouse.inside = true;
});
renderer.domElement.addEventListener("pointerdown", () => (mouse.down = true));
renderer.domElement.addEventListener("pointerup", () => {
  mouse.down = false;
  mouse.clicked = true;
});
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── frame loop ───────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pressState = { left: null as string | null, right: null as string | null };
const prevTrig = { left: false, right: false };
let prevStick = false;
let last = performance.now();
const headV = new THREE.Vector3();
const headQ = new THREE.Quaternion();

function pointPanel(origin: THREE.Vector3, dir: THREE.Vector3): { hit: ReturnType<CanvasPanel["hitAt"]>; point: THREE.Vector3 | null } {
  raycaster.set(origin, dir);
  raycaster.far = 6;
  const hit = raycaster.intersectObject(app.panel.mesh, false)[0];
  if (!hit?.uv) return { hit: null, point: null };
  return { hit: app.panel.hitAt(hit.uv), point: hit.point };
}

renderer.setAnimationLoop((time, xrFrame?: XRFrame) => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const session = renderer.xr.getSession();
  let f: TrackingFrame;
  if (session && xrFrame) {
    const ref = renderer.xr.getReferenceSpace()!;
    f = readXRFrame(xrFrame, ref, time, simulated);
  } else f = { t: time, source: simulated ? "simulator" : "webxr", head: null, left: null, right: null, device: "desktop preview" };

  // head pose for billboards
  if (f.head) {
    headV.set(f.head.position.x, f.head.position.y, f.head.position.z);
    headQ.set(f.head.orientation.x, f.head.orientation.y, f.head.orientation.z, f.head.orientation.w);
    if (!placed) place(headV, headQ, app.session?.calibration.floorY ?? 0);
  } else camera.getWorldPosition(headV);

  // panel interaction
  let hoverId: string | null = null;
  const uiHover = { left: false, right: false };
  if (session) {
    (["left", "right"] as const).forEach((hand, i) => {
      const c = f[hand];
      const r = rays[i];
      if (!c?.aim?.tracked) {
        r.l.visible = r.cur.visible = false;
        return;
      }
      const o = new THREE.Vector3(c.aim.position.x, c.aim.position.y, c.aim.position.z);
      const q = new THREE.Quaternion(c.aim.orientation.x, c.aim.orientation.y, c.aim.orientation.z, c.aim.orientation.w);
      const d = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      const { hit, point } = pointPanel(o, d);
      const end = point ?? o.clone().addScaledVector(d, 0.35);
      r.l.visible = true;
      aimLine(r.l, o, end);
      (r.l.material as unknown as { opacity: number }).opacity = point ? 0.7 : 0.18;
      r.cur.visible = !!point;
      if (point) r.cur.position.copy(point);
      if (point) uiHover[hand] = true;
      if (hit) hoverId = hit.id;
      const trig = c.trigger > 0.6;
      if (trig && !prevTrig[hand]) pressState[hand] = hit?.id ?? null;
      if (!trig && prevTrig[hand]) {
        if (hit && pressState[hand] === hit.id) {
          hit.onClick();
          app.panel.invalidate();
          haptic(hand, 0.4, 20);
        }
        pressState[hand] = null;
      }
      prevTrig[hand] = trig;
    });
    app.panel.pressId = pressState.right ?? pressState.left;
    const stick = !!(f.right?.thumbstick.pressed || f.left?.thumbstick.pressed);
    if (stick && !prevStick && f.head) place(headV, headQ, app.session?.calibration.floorY ?? 0);
    prevStick = stick;
  } else if (mouse.inside) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const hit = raycaster.intersectObject(app.panel.mesh, false)[0];
    const h = hit?.uv ? app.panel.hitAt(hit.uv) : null;
    hoverId = h?.id ?? null;
    app.panel.pressId = mouse.down ? hoverId : null;
    if (mouse.clicked && h) {
      h.onClick();
      app.panel.invalidate();
    }
    rays.forEach((r) => (r.l.visible = r.cur.visible = false));
  }
  mouse.clicked = false;
  app.panel.hoverId = hoverId;

  app.update(dt, f, uiHover);
  app.draw();

  // tips
  const off = app.session?.calibration.tipOffsetM ?? 0;
  (["left", "right"] as const).forEach((hand, i) => {
    const a = f[hand]?.aim;
    tips[i].visible = !!a?.tracked;
    if (a?.tracked) {
      const d = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(a.orientation.x, a.orientation.y, a.orientation.z, a.orientation.w));
      tips[i].position.set(a.position.x, a.position.y, a.position.z).addScaledVector(d, off);
    }
  });

  // beam
  const bi = app.beamInfo();
  const V = (p: { x: number; y: number; z: number } | null | undefined) => (p ? new THREE.Vector3(p.x, p.y, p.z) : null);
  if (bi) beam.update(dt, V(bi.a), V(bi.b), headV, bi.state, bi.progress, bi.readout, bi.sub, bi.axes);
  else beam.group.visible = false;

  // hologram + world landmarks
  const s = app.session;
  hologram.setData(s?.landmarks ?? {}, s?.measurements ?? {}, app.highlightLandmarks(), app.editor.sel);
  hologram.tick(dt);
  const p = s && Object.keys(s.measurements).length ? app.passport() : null;
  const hasAvatar = !!avatar.root;
  twin.update(p, hasAvatar ? "lines" : app.settings.twin, app.appearance?.skinTone?.hex ?? null);
  twin.tick(now / 1000);
  hologram.showFigure(!twin.mesh && !hasAvatar);
  if (hasAvatar && p && avatarFitKey !== p.updatedAt + p.measurements.length) {
    avatarFitKey = p.updatedAt + p.measurements.length;
    avatar.fit(p);
  }
  syncWorldMarks(s?.landmarks ?? {});
  const fl = s?.landmarks.floor;
  ground.visible = !!(s?.calibration.floorCalibrated && fl);
  if (fl) ground.position.set(fl.position.x, s!.calibration.floorY ?? fl.position.y, fl.position.z);
  grid.position.y = s?.calibration.floorY ?? 0;

  renderer.render(scene, camera);
});

let avatarFitKey = "";
const markCache = new Map<string, THREE.Object3D>();
function syncWorldMarks(lms: Record<string, { position: { x: number; y: number; z: number } }>) {
  for (const [id, o] of markCache) if (!lms[id]) {
    worldMarks.remove(o);
    markCache.delete(id);
  }
  for (const [id, l] of Object.entries(lms)) {
    let o = markCache.get(id);
    if (!o) {
      o = new THREE.Group();
      o.add(new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), new THREE.MeshBasicMaterial({ color: GOLD_HEX, toneMapped: false })));
      o.add(glowSprite(GOLD_HEX, 0.03, 0.6));
      worldMarks.add(o);
      markCache.set(id, o);
    }
    o.position.set(l.position.x, l.position.y, l.position.z);
  }
}

// ── sessions ─────────────────────────────────────────────────────────────────
async function enter(mode: "immersive-ar" | "immersive-vr") {
  const session = await navigator.xr!.requestSession(mode, { requiredFeatures: ["local-floor"], optionalFeatures: ["hand-tracking"] });
  env.visible = mode === "immersive-vr";
  scene.background = null;
  await renderer.xr.setSession(session);
  placed = false;
  app.onEnterXR();
  document.body.classList.add("in-xr");
  session.addEventListener("end", () => {
    document.body.classList.remove("in-xr");
    env.visible = true;
    landing.refresh();
  });
}

// restore settings + subject (About you) from the encrypted store
{
  const st = await store.getKv<Settings>("settings").catch(() => undefined);
  if (st) app.applySettings(st);
  else app.applySettings({});
  const sj = await store.getKv<Subject>("subject").catch(() => undefined);
  if (sj) app.subject = sj;
  const glb = await store.getKv<ArrayBuffer>("avatarGlb").catch(() => undefined);
  if (glb) void loadAvatar(glb);
  const av = params.get("avatar");
  if (av) void loadAvatar(av);
}

const landing = initLanding({
  app, store, simulated, loadAvatar,
  enterAR: () => enter("immersive-ar"),
  enterVR: () => enter("immersive-vr"),
  preview: () => document.body.classList.toggle("preview"),
});

listenForRequests(() => app.latest, host);
if (host.startProfile) app.startProfile(host.startProfile);

// Hook for the e2e test
(window as unknown as Record<string, unknown>).__vitruvian = { app, store, xrDevice, twin, avatar };
for (const f of ["600 40px 'Chakra Petch'", "italic 700 40px 'Chakra Petch'", "500 40px Inter", "600 40px Inter", "700 40px Inter"]) document.fonts?.load(f).then(() => app.panel.invalidate());
document.fonts?.ready.then(() => app.panel.invalidate());
