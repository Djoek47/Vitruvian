// End-to-end software test on an EMULATED Meta Quest 3 (Meta IWER runtime).
// Drives the real WebXR code path: session start, controller poses, buttons,
// guided Quick Fit capture, passport save, reload persistence, exports.
// Evidence: e2e/out/*.png + e2e/out/report.json.
// This is NOT a headset test — it proves the software pipeline only.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/node-tools/node_modules/playwright"); }
const { chromium } = pw;
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("./out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PORT = 4173;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "pipe" });
await new Promise((r) => server.stdout.on("data", (d) => /Local/.test(d) && r()));
const report = { started: new Date().toISOString(), checks: [] };
const check = (name, ok, detail = "") => {
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://localhost:${PORT}/?emulate=quest3`);
await page.waitForFunction(() => window.__vitruvian);
await page.screenshot({ path: OUT + "01-landing.png", fullPage: true });

// consent gate
check("Enter buttons disabled before consent", await page.locator("#btn-vr").isDisabled());
await page.check("#consent");
await page.waitForFunction(() => !document.querySelector("#btn-vr").disabled);
check("Enter VR enabled after consent", true);
await page.click("#btn-vr");
await page.waitForFunction(() => window.__vitruvian.xrDevice.activeSession);
check("Immersive session started", true);

// ── helpers running in the page ─────────────────────────────────────────────
await page.evaluate(() => {
  const V = window.__vitruvian;
  const dev = V.xrDevice;
  const qFromTo = (f, t) => {
    const n = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
    f = n(f); t = n(t);
    const d = f.x * t.x + f.y * t.y + f.z * t.z;
    if (d < -0.99999) return { x: 0, y: 1, z: 0, w: 0 };
    const c = { x: f.y * t.z - f.z * t.y, y: f.z * t.x - f.x * t.z, z: f.x * t.y - f.y * t.x };
    const q = { x: c.x, y: c.y, z: c.z, w: 1 + d };
    const l = Math.hypot(q.x, q.y, q.z, q.w);
    return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
  };
  dev.position.set(0, 1.68, 0);
  dev.quaternion.set(0, 0, 0, 1);
  window.__e2e = {
    // Place a controller so that its measuring tip (aim origin + offset) lands on `target`.
    async put(hand, target, dir) {
      const c = dev.controllers[hand];
      const q = qFromTo({ x: 0, y: 0, z: -1 }, dir);
      c.quaternion.set(q.x, q.y, q.z, q.w);
      let p = { ...target };
      for (let i = 0; i < 4; i++) {
        c.position.set(p.x, p.y, p.z);
        await new Promise((r) => setTimeout(r, 60));
        const f = V.app.frame;
        const aim = f?.[hand]?.aim;
        if (!aim) continue;
        const off = V.app.session?.calibration.tipOffsetM ?? 0;
        const fw = (() => { const o = aim.orientation; const x = o.x, y = o.y, z = o.z, w = o.w; return { x: -2 * (x * z + w * y), y: -2 * (y * z - w * x), z: -(1 - 2 * (x * x + y * y)) }; })();
        const tip = { x: aim.position.x + fw.x * off, y: aim.position.y + fw.y * off, z: aim.position.z + fw.z * off };
        p = { x: p.x + target.x - tip.x, y: p.y + target.y - tip.y, z: p.z + target.z - tip.z };
      }
    },
    press(hand, btn, v) { dev.controllers[hand].updateButtonValue(btn, v); },
  };
});

const BODY = {
  floor: [0.25, 0, -0.1], top_of_head: [0, 1.78, 0],
  acromion_l: [-0.2, 1.46, 0], acromion_r: [0.2, 1.46, 0],
  chest_side_l: [-0.16, 1.28, 0], chest_side_r: [0.16, 1.28, 0], chest_front: [0, 1.28, -0.12], chest_back: [0, 1.28, 0.12],
  waist_side_l: [-0.145, 1.08, 0], waist_side_r: [0.145, 1.08, 0], waist_front: [0, 1.08, -0.11], waist_back: [0, 1.08, 0.11],
  hip_side_l: [-0.175, 0.92, 0], hip_side_r: [0.175, 0.92, 0], hip_front: [0, 0.92, -0.12], hip_back: [0, 0.92, 0.13],
  arm_acromion_r: [0.2, 1.46, 0], wrist_r: [0.2505, 0.882, 0],
};
const P = (k) => ({ x: BODY[k][0], y: BODY[k][1], z: BODY[k][2] });
const hold = async (ms = 5000) => {
  await page.evaluate(() => window.__e2e.press("right", "a-button", 1));
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.__e2e.press("right", "a-button", 0));
  await page.waitForTimeout(120);
};
const tap = async (btn = "a-button") => {
  await page.evaluate((b) => window.__e2e.press("right", b, 1), btn);
  await page.waitForTimeout(150);
  await page.evaluate((b) => window.__e2e.press("right", b, 0), btn);
  await page.waitForTimeout(150);
};
const state = () => page.evaluate(() => ({ screen: window.__vitruvian.app.screen, step: window.__vitruvian.app.session?.step?.id, phase: window.__vitruvian.app.session?.phase }));

await page.waitForTimeout(800);
await page.screenshot({ path: OUT + "02-vr-home.png" });

// Studio live distance check (Test 004 software path): tips 300 mm apart.
await page.evaluate(() => { window.__vitruvian.app.screen = "studio"; });
await page.evaluate(async () => {
  await window.__e2e.put("left", { x: -0.15, y: 1.3, z: -0.45 }, { x: 1, y: 0, z: 0 });
  await window.__e2e.put("right", { x: 0.15, y: 1.3, z: -0.45 }, { x: -1, y: 0, z: 0 });
});
await page.waitForTimeout(800);
const live = await page.evaluate(() => window.__vitruvian.app.beamInfo());
check("Studio live tip distance = 300 mm (emulated)", /30\.0 cm/.test(live.readout), live.readout);
await hold();
const rl = await page.evaluate(() => window.__vitruvian.app.studio.readings.at(-1));
check("Studio capture records a reading", rl && Math.abs(rl.vrMm - 300) < 1, rl && rl.vrMm.toFixed(2) + " mm");
await page.screenshot({ path: OUT + "03-studio.png" });

// Quick Fit
await page.evaluate(() => window.__vitruvian.app.startProfile("quick"));
const touches = [
  [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }],
  [{ x: 0, y: 0, z: -1 }, { x: 0.7071, y: 0, z: 0.7071 }],
  [{ x: 0, y: 1, z: 0 }, { x: 0, y: -0.6, z: -0.8 }],
];
const meet = { x: 0, y: 1.25, z: -0.4 };
let shots = 0;
for (let guard = 0; guard < 40; guard++) {
  const s = await state();
  if (s.screen !== "capture" || !s.step) break;
  const step = await page.evaluate(() => window.__vitruvian.app.session.step);
  if (step.kind === "tip-calibration") {
    const n = await page.evaluate(() => window.__vitruvian.app.session.tipSamples.length);
    const [dl, dr] = touches[n % 3];
    await page.evaluate(async ([m, dl, dr]) => { await window.__e2e.put("left", m, dl); await window.__e2e.put("right", m, dr); }, [meet, dl, dr]);
  } else if (step.kind === "floor") {
    await page.evaluate(async (t) => window.__e2e.put("right", t, { x: 0, y: -1, z: 0 }), P("floor"));
  } else if (step.kind === "landmarks") {
    for (const pt of step.points) {
      const dir = pt.controller === "left" ? { x: 0.3, y: -0.2, z: -1 } : { x: -0.3, y: 0.1, z: -1 };
      await page.evaluate(async ([h, t, d]) => window.__e2e.put(h, t, d), [pt.controller, P(pt.landmark), dir]);
    }
  }
  await page.waitForTimeout(1600);
  await hold();
  const ph = await state();
  if (ph.phase !== "review") {
    const dbg = await page.evaluate(() => { const s = window.__vitruvian.app.session; return { rep: s.lastReport, prog: s.progress, msg: s.message, pts: s.currentPoints(window.__vitruvian.app.frame) }; });
    check(`capture ${step.id}`, false, JSON.stringify(ph) + " " + JSON.stringify(dbg));
    break;
  }
  if (shots < 3 && ["chest_sides", "acromions", "crown"].includes(step.id)) {
    await page.screenshot({ path: OUT + `04-capture-${step.id}.png` });
    shots++;
  }
  await tap("a-button"); // accept
}
const s = await state();
check("Quick Fit completed in VR", s.screen === "results", JSON.stringify(s));
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "05-results.png" });

const m = await page.evaluate(() => Object.fromEntries(Object.values(window.__vitruvian.app.session.measurements).map((x) => [x.id, [+x.value.toFixed(1), x.method, x.status]])));
console.log(m);
const near = (id, v, tol = 1.5) => m[id] && Math.abs(m[id][0] - v) <= tol;
check("height 1780 mm", near("height", 1780), m.height?.join(" "));
check("shoulder 400 mm", near("shoulder_width", 400), m.shoulder_width?.join(" "));
check("chest breadth 320 / depth 240", near("chest_width", 320) && near("chest_depth", 240));
check("arm length 580 mm", near("arm_length", 580, 2), m.arm_length?.join(" "));
check("circumferences derived", m.chest_circumference?.[1] === "derived" && m.waist_circumference?.[1] === "derived" && m.hip_circumference?.[1] === "derived");

// editor + fit screenshots
await page.evaluate(() => { const a = window.__vitruvian.app; a.screen = "editor"; a.editor.sel = "chest_circumference"; });
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + "06-editor.png" });
await page.evaluate(() => { window.__vitruvian.app.screen = "fit"; });
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + "07-fit.png" });

// exit XR → passport saved & listed
await page.evaluate(() => window.__vitruvian.xrDevice.activeSession.end());
await page.waitForTimeout(800);
const passport = await page.evaluate(() => window.__vitruvian.app.latest);
check("Passport saved", !!passport && passport.measurements.length >= 10, passport && passport.measurements.length + " measurements");
check("Passport flagged simulated", passport?.hardware.simulated === true);
writeFileSync(OUT + "sample-passport.SIMULATED.json", JSON.stringify(passport, null, 2));
await page.screenshot({ path: OUT + "08-landing-passport.png", fullPage: true });

// persistence across restart
await page.reload();
await page.waitForFunction(() => window.__vitruvian);
await page.waitForTimeout(1200);
const after = await page.evaluate(async () => { const v = await window.__vitruvian.store.listVersions(); const p = await window.__vitruvian.store.latest(); return { versions: v.length, id: p?.profileId, n: p?.measurements.length }; });
check("Passport survives reload (encrypted IndexedDB)", after.id === passport.profileId && after.n === passport.measurements.length, JSON.stringify(after));

// exports
const dl = async (sel) => {
  const [d] = await Promise.all([page.waitForEvent("download"), page.click(sel)]);
  const path = OUT + d.suggestedFilename();
  await d.saveAs(path);
  return path;
};
for (const x of ["json", "csv", "md", "mdtxt", "obj", "mh"]) {
  const f = await dl(`[data-x="${x}"]`);
  check(`export ${x}`, !!f, f.split("/").pop());
}
// External CDN requests (controller glTF models) are blocked in the CI sandbox; ignore network-only errors.
const real = errors.filter((e) => !/ERR_TUNNEL_CONNECTION_FAILED|net::ERR_|Failed to fetch|profilesList|webxr-input-profiles/.test(e));
check("No page errors", real.length === 0, real.slice(0, 3).join(" | ") + (errors.length - real.length ? ` (${errors.length - real.length} sandbox network errors ignored)` : ""));
report.finished = new Date().toISOString();
report.passed = report.checks.every((c) => c.ok);
writeFileSync(OUT + "report.json", JSON.stringify(report, null, 2));
await browser.close();
server.kill();
console.log(report.passed ? "\nALL E2E CHECKS PASSED" : "\nE2E FAILURES");
process.exit(report.passed ? 0 : 1);
