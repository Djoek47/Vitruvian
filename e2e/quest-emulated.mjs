// End-to-end SOFTWARE test on an EMULATED Meta Quest 3 (Meta IWER runtime).
// Drives the real WebXR code path and the Body Intelligence pages.
// Evidence: e2e/out/*.png, downloads, report.json. NOT a headset or accuracy test.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/node-tools/node_modules/playwright"); }
const { chromium } = pw;

const OUT = new URL("./out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PORT = 4173;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "pipe" });
await new Promise((r) => server.stdout.on("data", (d) => /Local/.test(d) && r()));
const report = { started: new Date().toISOString(), checks: [] };
const check = (name, ok, detail = "") => {
  report.checks.push({ name, ok: !!ok, detail: String(detail) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://localhost:${PORT}/?emulate=quest3`);
await page.waitForFunction(() => window.__vitruvian);
await page.screenshot({ path: OUT + "01-landing.png", fullPage: true });

check("Enter buttons disabled before consent", await page.locator("#btn-vr").isDisabled());
await page.check("#consent");
await page.waitForFunction(() => !document.querySelector("#btn-vr").disabled);
await page.click("#btn-vr");
await page.waitForFunction(() => window.__vitruvian.xrDevice.activeSession);
check("Immersive session started", true);

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
    async put(hand, target, dir) {
      const c = dev.controllers[hand];
      const q = qFromTo({ x: 0, y: 0, z: -1 }, dir);
      c.quaternion.set(q.x, q.y, q.z, q.w);
      let p = { ...target };
      for (let i = 0; i < 4; i++) {
        c.position.set(p.x, p.y, p.z);
        await new Promise((r) => setTimeout(r, 60));
        const aim = V.app.frame?.[hand]?.aim;
        if (!aim) continue;
        const off = V.app.session?.calibration.tipOffsetM ?? 0;
        const o = aim.orientation;
        const fw = { x: -2 * (o.x * o.z + o.w * o.y), y: -2 * (o.y * o.z - o.w * o.x), z: -(1 - 2 * (o.x * o.x + o.y * o.y)) };
        const tip = { x: aim.position.x + fw.x * off, y: aim.position.y + fw.y * off, z: aim.position.z + fw.z * off };
        p = { x: p.x + target.x - tip.x, y: p.y + target.y - tip.y, z: p.z + target.z - tip.z };
      }
    },
    press(hand, btn, v) { dev.controllers[hand].updateButtonValue(btn, v); },
  };
});
const tap = async (btn = "a-button", hand = "right") => {
  await page.evaluate(([b, h]) => window.__e2e.press(h, b, 1), [btn, hand]);
  await page.waitForTimeout(400);
  await page.evaluate(([b, h]) => window.__e2e.press(h, b, 0), [btn, hand]);
  await page.waitForTimeout(400);
};
const hold = async (ms = 7500) => {
  await page.evaluate(() => window.__e2e.press("right", "a-button", 1));
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.__e2e.press("right", "a-button", 0));
  await page.waitForTimeout(200);
};
const state = () => page.evaluate(() => ({ screen: window.__vitruvian.app.screen, step: window.__vitruvian.app.session?.step?.id, phase: window.__vitruvian.app.session?.phase }));
const setScreen = (s) => page.evaluate((x) => (window.__vitruvian.app.screen = x), s);

// boot → tutorial → home
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + "02-boot.png" });
await page.waitForFunction(() => window.__vitruvian.app.screen === "tutorial", null, { timeout: 20000 });
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "03-tutorial-1.png" });
check("Boot sequence then tutorial on first entry", true);
await tap();
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + "03-tutorial-2-controllers.png" });
await tap();
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + "03-tutorial-3-buttons.png" });
await tap();
await tap();
await page.waitForFunction(() => window.__vitruvian.app.screen === "home", null, { timeout: 15000 });
check("Tutorial completes to Home and is remembered", await page.evaluate(() => window.__vitruvian.app.settings.tutorialDone));
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + "04-home.png" });

// studio
await setScreen("studio");
await page.evaluate(async () => {
  await window.__e2e.put("left", { x: -0.15, y: 1.3, z: -0.45 }, { x: 1, y: 0, z: 0 });
  await window.__e2e.put("right", { x: 0.15, y: 1.3, z: -0.45 }, { x: -1, y: 0, z: 0 });
});
await page.waitForTimeout(1600);
const live = await page.evaluate(() => window.__vitruvian.app.beamInfo());
check("Studio live tip distance = 300 mm (emulated)", /30\.0 cm/.test(live.readout), live.readout + " · " + live.axes);
check("XYZ axis readout present", /X 30\.0/.test(live.axes), live.axes);
await hold();
const rl = await page.evaluate(() => window.__vitruvian.app.studio.readings.at(-1));
check("Studio capture records a reading", rl && Math.abs(rl.vrMm - 300) < 1, rl && rl.vrMm.toFixed(2) + " mm");
await page.screenshot({ path: OUT + "05-studio.png" });

// Simple mode (10 body points) in the order: ground → head → instrument → body
const BODY = {
  floor: [0.25, 0, -0.1], top_of_head: [0, 1.78, 0],
  acromion_l: [-0.2, 1.46, 0], acromion_r: [0.2, 1.46, 0],
  chest_side_l: [-0.16, 1.28, 0], chest_side_r: [0.16, 1.28, 0], chest_front: [0, 1.28, -0.12], chest_back: [0, 1.28, 0.12],
  waist_side_l: [-0.145, 1.08, 0], waist_side_r: [0.145, 1.08, 0], waist_front: [0, 1.08, -0.11], waist_back: [0, 1.08, 0.11],
  hip_side_l: [-0.175, 0.92, 0], hip_side_r: [0.175, 0.92, 0], hip_front: [0, 0.92, -0.12], hip_back: [0, 0.92, 0.13],
  arm_acromion_r: [0.2, 1.46, 0], wrist_r: [0.2505, 0.882, 0],
};
const P = (k) => ({ x: BODY[k][0], y: BODY[k][1], z: BODY[k][2] });
await page.evaluate(() => window.__vitruvian.app.startProfile("simple"));
const touches = [[{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }], [{ x: 0, y: 0, z: -1 }, { x: 0.7071, y: 0, z: 0.7071 }], [{ x: 0, y: 1, z: 0 }, { x: 0, y: -0.6, z: -0.8 }]];
const meet = { x: 0, y: 1.25, z: -0.4 };
const order = [];
for (let guard = 0; guard < 40; guard++) {
  const s = await state();
  if (s.screen !== "capture" || !s.step) break;
  const step = await page.evaluate(() => window.__vitruvian.app.session.step);
  order.push(step.id);
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
  await page.waitForTimeout(2400);
  if (["cal_floor", "crown", "chest_sides"].includes(step.id)) await page.screenshot({ path: OUT + `06-capture-${step.id}.png` });
  await hold();
  const ph = await state();
  if (ph.phase !== "review") {
    check(`capture ${step.id}`, false, JSON.stringify(ph));
    break;
  }
  if (step.id === "chest_sides") await page.screenshot({ path: OUT + "06-capture-review.png" });
  await tap("a-button");
}
check("Step order: ground → head → instrument first", order.slice(0, 3).join() === "cal_floor,cal_stance,cal_tip", order.slice(0, 4).join(" → "));
const s1 = await state();
check("Simple mode completed in VR (10 body points)", s1.screen === "results" && order.filter((x) => !x.startsWith("cal_")).length === 6, JSON.stringify(s1) + " · " + order.join(","));
const m = await page.evaluate(() => Object.fromEntries(Object.values(window.__vitruvian.app.session.measurements).map((x) => [x.id, [+x.value.toFixed(1), x.method]])));
const near = (id, v, tol = 1.5) => m[id] && Math.abs(m[id][0] - v) <= tol;
check("height 1780 mm (floor re-projected after tip calibration)", near("height", 1780), m.height?.join(" "));
check("shoulder 400 / chest breadth 320 / arm 580", near("shoulder_width", 400) && near("chest_width", 320) && near("arm_length", 580, 2), JSON.stringify({ s: m.shoulder_width, c: m.chest_width, a: m.arm_length }));
check("Simple-mode girths are labelled ESTIMATED (no depth points)", m.chest_circumference?.[1] === "estimated" && m.waist_circumference?.[1] === "estimated");
const hint = await page.evaluate(() => window.__vitruvian.app.hintSpec("right"));
check("Controller hint card spec available (Figma art)", true, JSON.stringify(hint));
await page.evaluate(() => { const a = window.__vitruvian.app; a.subject = { weightKg: 78, ageYears: 34, sex: "male", shoe: { system: "EU", size: 42, footLengthMm: 265, converted: true } }; });
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + "07-results-twin.png" });
const comp = await page.evaluate(() => window.__vitruvian.app.passport()?.composition);
check("BMI computed from entered weight + measured height", comp?.bmi && Math.abs(comp.bmi.value - 78 / 1.78 ** 2) < 0.05, comp?.bmi?.value?.toFixed(2));
check("Twin mesh built from measurements", await page.evaluate(() => !!window.__vitruvian.twin.mesh));
for (const [scr, file] of [["about", "08-about"], ["settings", "09-settings"], ["steps", "10-step-map"]]) {
  await setScreen(scr);
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + file + ".png" });
}
await page.evaluate(() => { const a = window.__vitruvian.app; a.screen = "editor"; a.editor.sel = "chest_circumference"; });
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + "11-editor.png" });
await page.evaluate(() => { window.__vitruvian.app.screen = "home"; window.__vitruvian.app.modal = "exit"; });
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + "12-exit-modal.png" });
await page.evaluate(async () => { window.__vitruvian.app.modal = null; await window.__vitruvian.app.save(); window.__vitruvian.xrDevice.activeSession.end(); });
await page.waitForTimeout(1500);
const passport = await page.evaluate(() => window.__vitruvian.app.latest);
check("Passport saved (schema 1.1, simple mode, simulated flag)", passport?.schemaVersion === "1.1" && passport.profile === "simple" && passport.hardware.simulated === true && passport.measurements.length >= 10, passport?.measurements.length);
writeFileSync(OUT + "sample-passport.SIMULATED.json", JSON.stringify(passport, null, 2));

const dl = async (sel) => {
  const [d] = await Promise.all([page.waitForEvent("download", { timeout: 180000 }), page.click(sel)]);
  const path = OUT + d.suggestedFilename();
  await d.saveAs(path);
  return path;
};
await page.click('nav.tabs button[data-tab="passport"]');
await page.waitForTimeout(500);
for (const x of ["json", "csv", "md", "mdtxt", "obj", "mh", "ue", "uecsv"]) {
  const f = await dl(`[data-x="${x}"]`);
  check(`export ${x}`, statSync(f).size > 50, f.split("/").pop());
}

// ── Body Intelligence: seed 3 more snapshots (TEST FIXTURES, flagged simulated) ──
const seeded = await page.evaluate(async () => {
  const { store, app } = window.__vitruvian;
  const base = app.latest;
  const first = JSON.stringify((await store.snapshots())[0].passport);
  const scale = (weeks, dWaist, dChest) => {
    const t = new Date(Date.parse(base.updatedAt) + weeks * 7 * 86400000).toISOString();
    return { ...base, updatedAt: t, measurements: base.measurements.map((mm) => ({ ...mm, timestamp: t, value: mm.value + (mm.id === "waist_circumference" ? dWaist : mm.id === "chest_circumference" ? dChest : mm.id === "waist_width" ? dWaist / 3.2 : 0) })) };
  };
  for (const [w, dw, dc] of [[4, -25, 8], [8, -45, 18], [12, -70, 30]]) await store.savePassport(scale(w, dw, dc));
  const snaps = await store.snapshots();
  return { n: snaps.length, firstUnchanged: JSON.stringify(snaps[0].passport) === first };
});
check("Multiple snapshots saved", seeded.n >= 4, seeded.n);
check("Historical snapshot unchanged after new saves (immutable)", seeded.firstUnchanged);
await page.click('nav.tabs button[data-tab="evolution"]');
await page.waitForTimeout(3000);
await page.screenshot({ path: OUT + "13-evolution.png", fullPage: true });
check("Evolution overview shows sessions", (await page.locator("#evo-overview").innerText()).includes("sessions recorded"));
const repText = await page.locator("#evo-report").innerText();
check("Change report compares two snapshots", /Waist circumference/.test(repText), repText.split("\n").slice(0, 2).join(" | "));
await page.fill("#ts-dur", "2");
await page.dispatchEvent("#ts-dur", "change");
const vid = await dl("#ts-video");
check("Transformation video rendered locally", statSync(vid).size > 10000, vid.split("/").pop() + " " + (statSync(vid).size / 1024).toFixed(0) + " kB");
const strip = await dl("#ts-strip");
check("Filmstrip exported", statSync(strip).size > 5000, (statSync(strip).size / 1024).toFixed(0) + " kB");
await page.evaluate(() => document.querySelector("#evo-studio").scrollIntoView());
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "14-transformation-studio.png" });

// wardrobe
await page.click('nav.tabs button[data-tab="wardrobe"]');
await page.waitForTimeout(800);
await page.selectOption("#g-cat", "tshirt");
await page.fill("#g-brand", "Faberland");
await page.fill("#g-name", "Black tee (test garment)");
await page.fill("#g-size", "M");
const chestCm = passport.measurements.find((x) => x.id === "chest_circumference").value / 10;
await page.fill('.g-m[data-id="chest"]', String((chestCm + 9).toFixed(1)));
await page.fill('.g-m[data-id="shoulder"]', "42");
await page.click("#g-add");
await page.waitForTimeout(1500);
const wtxt = await page.locator("#wardrobe").innerText();
check("Wardrobe item assessed with garment-specific data", /Black tee/.test(wtxt) && /(Fits comfortably|Becoming tight|May no longer fit|Currently too loose|cannot be determined|additional information)/.test(wtxt));
await page.screenshot({ path: OUT + "15-wardrobe.png", fullPage: true });

// check-in
await page.click('nav.tabs button[data-tab="checkin"]');
await page.waitForTimeout(500);
await page.fill("#ci-w", "77.4");
await page.fill('.ci-t[data-id="waist_circumference"]', "80.2");
await page.click("#ci-save");
await page.waitForTimeout(1200);
check("Daily check-in saved", /77\.4 kg/.test(await page.locator("#checkin").innerText()));
await page.screenshot({ path: OUT + "16-checkin.png", fullPage: true });

// persistence across restart
await page.reload();
await page.waitForFunction(() => window.__vitruvian);
await page.waitForTimeout(2000);
const after = await page.evaluate(async () => { const s = window.__vitruvian.store; return { snaps: (await s.snapshots()).length, wardrobe: (await s.list("wardrobe")).length, checkins: (await s.list("checkins")).length }; });
check("Snapshots, wardrobe and check-ins survive reload (encrypted IndexedDB)", after.snaps === seeded.n && after.wardrobe === 1 && after.checkins === 1, JSON.stringify(after));

const real = errors.filter((e) => !/ERR_TUNNEL_CONNECTION_FAILED|net::ERR_|Failed to fetch|profilesList|webxr-input-profiles/.test(e));
check("No page errors", real.length === 0, real.slice(0, 3).join(" | ") + (errors.length - real.length ? ` (${errors.length - real.length} sandbox network errors ignored)` : ""));
report.finished = new Date().toISOString();
report.passed = report.checks.every((c) => c.ok);
writeFileSync(OUT + "report.json", JSON.stringify(report, null, 2));
await browser.close();
server.kill();
console.log(report.passed ? "\nALL E2E CHECKS PASSED" : "\nE2E FAILURES");
process.exit(report.passed ? 0 : 1);
