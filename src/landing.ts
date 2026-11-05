import type { VitruvianApp } from "./app/app";
import type { store as Store } from "./passport/store";
import { parsePassport, passportToCsv, validatePassport, type BodyPassport } from "./passport/passport";
import { mdMannequinObj, mdSheetCsv, mdWorksheet } from "./bridge/marvelous";
import { metahumanTargets } from "./bridge/metahuman";
import { MEASUREMENT_BY_ID, PROFILE_PRIMARY } from "./measurement/registry";
import { errorStats, rulerLogCsv, type RulerReading } from "./validation/stats";
import type { SessionSnapshot } from "./measurement/session";
import { unrealDataTableCsv, unrealPassport } from "./bridge/unreal";
import { patchMeanLinear, skinToneFrom, MONK, type SkinTone, type RGB } from "./appearance/skinTone";
import { footLengthFromSize, SHOE_SYSTEMS, type ShoeSystem } from "./body/shoe";
import type { Subject } from "./passport/passport";
import type { AvatarFit } from "./scene/avatar";
import { initEvolution } from "./evolution/dashboard";
import { controllersSvg } from "./ui/questController";
import { PROFILE_INFO, bodyPointsFor } from "./measurement/procedures";

type Deps = { app: VitruvianApp; store: typeof Store; simulated: boolean; enterAR: () => Promise<void>; enterVR: () => Promise<void>; preview: () => void; loadAvatar: (src: string | ArrayBuffer) => Promise<AvatarFit | null> };

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function download(name: string, text: string, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export function initLanding(d: Deps) {
  const root = $("#landing");
  root.innerHTML = `
  <header class="hero">
    <img class="star" src="${import.meta.env.BASE_URL}brand/faberland-star.png" alt="Faberland" />
    <div>
      <img class="wordmark" src="${import.meta.env.BASE_URL}brand/faberland-wordmark.png" alt="faberland" />
      <h1>VITRUVIAN</h1>
      <p class="tag">Measure once. Your Body Passport powers your avatar, virtual try-on and clothing made for your proportions.</p>
    </div>
  </header>
  <nav class="tabs">${[["headset", "Headset"], ["passport", "Body Passport"], ["evolution", "Body Evolution"], ["wardrobe", "Wardrobe"], ["checkin", "Check-in"], ["validation", "Validation"]].map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join("")}</nav>
  ${d.simulated ? `<div class="warn">EMULATOR MODE — controller positions are simulated (IWER). Data from this mode is flagged <b>simulated</b> and must never be used for a real fit.</div>` : ""}
  <section class="card" data-tab="headset" id="xr-status"><h2>Headset</h2><p id="xr-support">Checking WebXR…</p></section>
  <section class="card" data-tab="headset">
    <h2>Consent</h2>
    <ul class="plain">
      <li><b>What is captured:</b> positions of your two controllers when you touch body landmarks, and your headset position. No camera images, no face capture, no video.</li>
      <li><b>Where it is stored:</b> only on this device, encrypted (AES-GCM). Nothing is uploaded.</li>
      <li><b>Sharing:</b> only when you press an export button below.</li>
      <li><b>Deleting:</b> “Delete all my body data” removes every passport, history and the encryption key.</li>
    </ul>
    <label class="check"><input type="checkbox" id="consent" /> I agree to measure my body and store the result on this device.</label>
    <label class="field">Passport name <input id="pname" maxlength="60" value="My Body Passport" /></label>
    <div class="row">
      <button class="primary" id="btn-ar" disabled>Enter Mixed Reality (passthrough)</button>
      <button id="btn-vr" disabled>Enter VR</button>
      <button class="ghost" id="btn-preview">Desktop 3D preview</button>
    </div>
    <p class="hint">Recommended: Mixed Reality — you see your own body and the gold landmark points you capture. Clear 1.5 m around you.</p>
    <div id="resume"></div>
  </section>
  <section class="card" data-tab="headset" id="controls">
    <h2>Controls</h2>
    <div class="ctrl-art">${controllersSvg({ r_a: "hold", l_x: "press", r_b: "hover", l_y: "hover", r_trigger: "hover", l_trigger: "hover" })}</div>
    <table><tr><td><b>Hold A</b> (or X)</td><td>Capture: fills only while you hold still</td></tr><tr><td><b>A</b> after a capture</td><td>Accept and go on</td></tr>
    <tr><td><b>X</b> after a capture</td><td>Add a sample of the same point (more points = more established)</td></tr><tr><td><b>B</b> / <b>Y</b></td><td>Retake · back · close</td></tr>
    <tr><td><b>Trigger</b></td><td>Select on the panels</td></tr><tr><td><b>Thumbstick click</b></td><td>Bring the panels in front of you</td></tr></table>
    <h3>Measurement modes</h3>
    <table>${(["simple", "intermediate", "ultra"] as const).map((k) => `<tr><td><b>${PROFILE_INFO[k].title}</b></td><td class="num">${bodyPointsFor(k)} points</td><td>${PROFILE_INFO[k].blurb} · ~${PROFILE_INFO[k].minutes} min</td></tr>`).join("")}</table>
  </section>
  <section class="card" data-tab="headset" id="about"></section>
  <section class="card" data-tab="headset" id="appearance"></section>
  <section class="card" data-tab="passport" id="passport"></section>
  <section class="card" data-tab="passport" id="avatar-card"></section>
  <section class="card" data-tab="evolution" id="evolution"></section>
  <section class="card" data-tab="wardrobe" id="wardrobe"></section>
  <section class="card" data-tab="checkin" id="checkin"></section>
  <section class="card" data-tab="validation" id="validation"></section>
  <footer>Faberland Vitruvian · Body Passport schema v1.0 · measurement engine is hardware-independent · <span id="build"></span></footer>`;

  const showTab = (t: string) => {
    document.querySelectorAll<HTMLElement>("section[data-tab]").forEach((el) => (el.hidden = el.dataset.tab !== t));
    document.querySelectorAll<HTMLButtonElement>("nav.tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    if (t === "evolution" || t === "wardrobe" || t === "checkin") evolution.refresh();
  };
  document.querySelectorAll<HTMLButtonElement>("nav.tabs button").forEach((b) => (b.onclick = () => showTab(b.dataset.tab!)));
  const evolution = initEvolution({ store: d.store, app: d.app });

  // ── About you (manual, optional) ─────────────────────────────────────────
  const renderAbout = () => {
    const sj = d.app.subject;
    $("#about").innerHTML = `<h2>About you <span class="dim">(optional)</span></h2>
      <p class="dim">Used for BMI and body-composition estimates, avatar base selection and shoes. Stored on this device; also editable inside the headset.</p>
      <div class="row wrap"><label class="field">Weight (kg)<input id="ab-w" type="number" step="0.1" value="${sj.weightKg ?? ""}"/></label>
      <label class="field">Age<input id="ab-age" type="number" value="${sj.ageYears ?? ""}"/></label>
      <label class="field">Sex (only for the body-fat equation)<select id="ab-sex">${["unspecified", "female", "male"].map((x) => `<option ${sj.sex === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <label class="field">Shoe system<select id="ab-sys">${SHOE_SYSTEMS.map((x) => `<option ${sj.shoe?.system === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <label class="field">Shoe size<input id="ab-shoe" type="number" step="0.5" value="${sj.shoe?.size ?? ""}"/></label></div>
      <div class="row"><button id="ab-save">Save</button><span id="ab-msg" class="dim"></span></div>`;
    $("#ab-save").onclick = async () => {
      const num = (id: string) => parseFloat($<HTMLInputElement>(id).value) || undefined;
      const sys = $<HTMLSelectElement>("#ab-sys").value as ShoeSystem;
      const size = num("#ab-shoe");
      const next: Subject = { ...d.app.subject, weightKg: num("#ab-w"), ageYears: num("#ab-age"), sex: $<HTMLSelectElement>("#ab-sex").value as Subject["sex"], shoe: size ? { system: sys, size, footLengthMm: footLengthFromSize(sys, size), converted: true } : undefined };
      d.app.subject = next;
      await d.store.setKv("subject", JSON.parse(JSON.stringify(next)));
      $("#ab-msg").textContent = "Saved ✓ — included in your next Body Passport snapshot";
    };
  };

  // ── Appearance / skin tone (separate, optional consent) ──────────────────
  const renderAppearance = () => {
    const st = d.app.appearance?.skinTone;
    $("#appearance").innerHTML = `<h2>Skin tone <span class="dim">(optional)</span></h2>
      <p class="dim">For avatar skin, and later makeup and colour matching. Photograph the <b>inner forearm</b> (no face needed) next to a sheet of <b>plain white paper</b>, in daylight. Only the derived colour is stored — the photo is discarded.</p>
      <label class="check"><input type="checkbox" id="ap-consent"/> I agree to analyse a photo of my skin on this device.</label>
      <div class="row wrap"><input type="file" id="ap-file" accept="image/*" capture="environment" disabled/><button id="ap-cam" disabled>Use camera</button><button id="ap-snap" disabled>Take frame</button></div>
      <video id="ap-video" playsinline muted style="display:none;max-width:100%"></video>
      <canvas id="ap-canvas" style="max-width:100%;display:none;cursor:crosshair"></canvas>
      <div class="row wrap"><button id="ap-mode-skin" class="on" disabled>1 · Tap skin</button><button id="ap-mode-white" disabled>2 · Tap white paper</button><span id="ap-msg" class="dim"></span></div>
      <div id="ap-result">${st ? toneHtml(st) : ""}</div>`;
    const consentEl = $<HTMLInputElement>("#ap-consent");
    const file = $<HTMLInputElement>("#ap-file");
    const cv = $<HTMLCanvasElement>("#ap-canvas");
    const video = $<HTMLVideoElement>("#ap-video");
    let mode: "skin" | "white" = "skin";
    let skin: RGB | null = null;
    let white: RGB | null = null;
    let source: SkinTone["source"] = "photo";
    const enable = () => ["#ap-file", "#ap-cam", "#ap-snap", "#ap-mode-skin", "#ap-mode-white"].forEach((id) => ($<HTMLButtonElement>(id).disabled = !consentEl.checked));
    consentEl.onchange = enable;
    const draw = (img: CanvasImageSource, w: number, h: number) => {
      const k = Math.min(1, 1280 / w);
      cv.width = w * k;
      cv.height = h * k;
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      cv.style.display = "block";
    };
    file.onchange = async () => {
      const f = file.files?.[0];
      if (!f) return;
      const bmp = await createImageBitmap(f);
      source = "photo";
      draw(bmp, bmp.width, bmp.height);
      $("#ap-msg").textContent = "Tap the skin, then the white paper.";
    };
    $("#ap-cam").onclick = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        video.style.display = "block";
        await video.play();
        source = "camera";
      } catch (e) {
        $("#ap-msg").textContent = "Camera not available here: " + (e as Error).message + " — use a photo instead.";
      }
    };
    $("#ap-snap").onclick = () => {
      if (!video.videoWidth) return;
      draw(video, video.videoWidth, video.videoHeight);
      (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
      video.style.display = "none";
    };
    $("#ap-mode-skin").onclick = () => ((mode = "skin"), $("#ap-mode-skin").classList.add("on"), $("#ap-mode-white").classList.remove("on"));
    $("#ap-mode-white").onclick = () => ((mode = "white"), $("#ap-mode-white").classList.add("on"), $("#ap-mode-skin").classList.remove("on"));
    cv.onclick = async (e) => {
      const r = cv.getBoundingClientRect();
      const x = Math.round(((e.clientX - r.left) / r.width) * cv.width);
      const y = Math.round(((e.clientY - r.top) / r.height) * cv.height);
      const R = Math.max(6, Math.round(cv.width / 80));
      const px = cv.getContext("2d")!.getImageData(Math.max(0, x - R), Math.max(0, y - R), R * 2, R * 2).data;
      const lin = patchMeanLinear(px);
      if (mode === "skin") skin = lin;
      else white = lin;
      if (skin) {
        const tone = skinToneFrom(skin, white, source, "inner forearm");
        d.app.appearance = { skinTone: tone, photoStored: false };
        await d.store.setKv("appearance", JSON.parse(JSON.stringify(d.app.appearance)));
        $("#ap-result").innerHTML = toneHtml(tone);
        $("#ap-msg").textContent = white ? "White-balanced ✓ (saved)" : "Saved — now tap the white paper to calibrate the colour.";
      }
    };
  };

  // ── Avatar slot (MetaHuman / UE5 .glb) ────────────────────────────────────
  const renderAvatar = (fit: AvatarFit | null = null) => {
    $("#avatar-card").innerHTML = `<h2>Avatar</h2>
      <p class="dim">In the headset your <b>Vitruvian twin</b> is generated from your measurements (exact girths, gold lines / hologram / skin tone — Settings ▸ Your twin). To preview a <b>MetaHuman</b>, export its body from Unreal as a low-LOD <code>.glb</code> (UE5 skeleton names) and load it here: its skeleton is scaled to your height and limb lengths. Girths are applied in Unreal by MetaHuman Creator from the exported targets.</p>
      <div class="row wrap"><input type="file" id="av-file" accept=".glb,.gltf,model/gltf-binary"/><button class="ghost" id="av-clear">Remove avatar</button></div>
      <div id="av-out">${fit ? `<p>${fit.ok ? "Fitted ✓" : "Not fitted"} · scale ${fit.scale.toFixed(3)} · ${esc(fit.note)}</p><table>${fit.adjusted.map((a) => `<tr><td>${esc(a.segment)}</td><td class="num">${a.fromCm} → ${a.toCm} cm</td></tr>`).join("")}</table>` : ""}</div>`;
    $<HTMLInputElement>("#av-file").onchange = async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const buf = await f.arrayBuffer();
      await d.store.setKv("avatarGlb", buf);
      renderAvatar(await d.loadAvatar(buf));
    };
    $("#av-clear").onclick = async () => {
      await d.store.setKv("avatarGlb", null);
      location.reload();
    };
  };

  const consent = $<HTMLInputElement>("#consent");
  const pname = $<HTMLInputElement>("#pname");
  const btnAR = $<HTMLButtonElement>("#btn-ar");
  const btnVR = $<HTMLButtonElement>("#btn-vr");
  let support = { ar: false, vr: false };

  const syncButtons = () => {
    btnAR.disabled = !consent.checked || !support.ar;
    btnVR.disabled = !consent.checked || !support.vr;
  };
  consent.addEventListener("change", async () => {
    if (consent.checked) {
      d.app.identity.consentTimestamp = new Date().toISOString();
      await d.store.setKv("consent", d.app.identity.consentTimestamp);
    } else await d.store.setKv("consent", null);
    syncButtons();
  });
  pname.addEventListener("input", () => (d.app.identity.displayName = pname.value || "My Body Passport"));
  const go = (fn: () => Promise<void>) => async () => {
    try {
      await fn();
    } catch (e) {
      alert("Could not start the XR session: " + (e as Error).message);
    }
  };
  btnAR.onclick = go(d.enterAR);
  btnVR.onclick = go(d.enterVR);
  $("#btn-preview").onclick = d.preview;
  addEventListener("keydown", (e) => e.key === "Escape" && document.body.classList.remove("preview"));

  (async () => {
    const xr = navigator.xr;
    if (!xr) {
      $("#xr-support").innerHTML = `WebXR is not available in this browser. On your Quest, open this page in the <b>Meta Quest Browser</b> (HTTPS required).`;
      return;
    }
    support = { ar: await xr.isSessionSupported("immersive-ar").catch(() => false), vr: await xr.isSessionSupported("immersive-vr").catch(() => false) };
    $("#xr-support").innerHTML = `${support.vr ? "✅" : "❌"} VR &nbsp; ${support.ar ? "✅" : "❌"} Mixed Reality &nbsp;·&nbsp; <span class="dim">${esc(navigator.userAgent.slice(0, 120))}</span>`;
    syncButtons();
  })();

  const refresh = async () => {
    const c = await d.store.getKv<string | null>("consent").catch(() => null);
    if (c) {
      consent.checked = true;
      d.app.identity.consentTimestamp = c;
    }
    syncButtons();
    const draft = await d.store.loadDraft<SessionSnapshot>().catch(() => null);
    $("#resume").innerHTML = draft && !d.app.session ? `<p class="hint">An unfinished measurement session was found (step ${draft.index + 1}). It will resume automatically when you enter.</p>` : "";
    if (draft && !d.app.session) d.app.loadSnapshot(draft);
    const ruler = (await d.store.getKv<RulerReading[]>("rulerLog").catch(() => undefined)) ?? [];
    if (!d.app.studio.readings.length && ruler.length) d.app.studio.readings = ruler;
    const versions = await d.store.listVersions().catch(() => []);
    let latest: BodyPassport | null = d.app.latest;
    if (!latest && versions.length) latest = await d.store.loadVersion(versions[0].vid);
    if (latest && !d.app.latest) {
      d.app.latest = latest;
      if (!d.app.session) d.app.loadPassport(latest);
      pname.value = latest.displayName;
    }
    if (!d.app.appearance) {
      const ap = await d.store.getKv<VitruvianApp["appearance"]>("appearance").catch(() => undefined);
      if (ap) d.app.appearance = ap;
    }
    renderPassport(latest, versions);
    renderValidation(latest, d.app.studio.readings);
    if (!$("#about").innerHTML) {
      renderAbout();
      renderAppearance();
      renderAvatar();
    }
    evolution.refresh();
  };

  const renderPassport = (p: BodyPassport | null, versions: Awaited<ReturnType<typeof d.store.listVersions>>) => {
    const el = $("#passport");
    if (!p) {
      el.innerHTML = `<h2>Body Passport</h2><p class="dim">No passport yet. Enter the headset and run Quick Fit.</p>${importHtml()}`;
      bindImport();
      return;
    }
    const v = validatePassport(p);
    const rows = p.measurements
      .map((m) => `<tr class="${m.status}"><td>${esc(MEASUREMENT_BY_ID[m.id]?.label ?? m.id)}</td><td class="num">${(m.value / 10).toFixed(1)} cm</td><td class="num dim">±${(m.uncertaintyMm / 10).toFixed(1)}</td><td><span class="badge ${m.method}">${m.method === "direct" ? "measured" : m.method}</span>${m.status === "conflicted" ? ' <span class="badge conflicted">conflicted</span>' : ""}</td></tr>`)
      .join("");
    el.innerHTML = `<h2>Body Passport</h2>
      <p><b>${esc(p.displayName)}</b> · <span class="dim">${p.profileId}</span><br/><span class="dim">v${p.schemaVersion} · ${p.profile} · updated ${p.updatedAt.replace("T", " ").slice(0, 16)} · ${esc(p.hardware.device)}</span>
      ${p.hardware.simulated ? '<br/><b class="ember">SIMULATED DATA</b>' : ""}<br/>Schema validation: ${v.ok ? '<span class="ok">valid ✓</span>' : `<span class="ember">${esc(v.errors.join("; "))}</span>`}</p>
      <table>${rows}</table>
      <h3>Export</h3>
      <div class="row wrap">
        <button data-x="json">Body Passport (.json)</button>
        <button data-x="csv">Measurements (.csv)</button>
        <button data-x="md">Marvelous Designer sheet (.csv)</button>
        <button data-x="mdtxt">MD worksheet (.txt)</button>
        <button data-x="obj">Measured mannequin (.obj, mm)</button>
        <button data-x="mh">MetaHuman body targets (.json)</button>
        <button data-x="ue">Unreal passport (.json, cm, Z-up)</button>
        <button data-x="uecsv">Unreal DataTable (.csv)</button>
      </div>
      <h3>History</h3>
      <table>${versions.map((x) => `<tr><td>${x.savedAt.replace("T", " ").slice(0, 19)}</td><td>${x.count} values${x.simulated ? " · simulated" : ""}</td><td><button class="ghost sm" data-load="${x.vid}">Open</button> <button class="ghost sm" data-del="${x.vid}">Delete</button></td></tr>`).join("")}</table>
      ${importHtml()}
      <div class="row"><button class="danger" id="delall">Delete all my body data</button></div>`;
    const base = `vitruvian-${p.profileId.slice(0, 8)}`;
    el.querySelectorAll<HTMLButtonElement>("[data-x]").forEach((b) => (b.onclick = () => {
      const x = b.dataset.x;
      if (x === "json") download(`${base}-passport.json`, JSON.stringify(p, null, 2), "application/json");
      if (x === "csv") download(`${base}-measurements.csv`, passportToCsv(p), "text/csv");
      if (x === "md") download(`${base}-marvelous-designer.csv`, mdSheetCsv(p), "text/csv");
      if (x === "mdtxt") download(`${base}-marvelous-designer.txt`, mdWorksheet(p));
      if (x === "obj") download(`${base}-mannequin.obj`, mdMannequinObj(p), "model/obj");
      if (x === "mh") download(`${base}-metahuman-targets.json`, JSON.stringify(metahumanTargets(p), null, 2), "application/json");
      if (x === "ue") download(`${base}-unreal.json`, JSON.stringify(unrealPassport(p), null, 2), "application/json");
      if (x === "uecsv") download(`${base}-unreal-datatable.csv`, unrealDataTableCsv(p), "text/csv");
    }));
    el.querySelectorAll<HTMLButtonElement>("[data-load]").forEach((b) => (b.onclick = async () => {
      const pp = await d.store.loadVersion(+b.dataset.load!);
      if (pp) {
        d.app.latest = pp;
        d.app.loadPassport(pp);
        refresh();
      }
    }));
    el.querySelectorAll<HTMLButtonElement>("[data-del]").forEach((b) => (b.onclick = async () => {
      if (confirm("Delete this saved version?")) {
        await d.store.deleteVersion(+b.dataset.del!);
        d.app.latest = null;
        refresh();
      }
    }));
    $("#delall").onclick = async () => {
      if (!confirm("Permanently delete every Body Passport, history, draft and the encryption key on this device?")) return;
      await d.store.deleteAll();
      location.reload();
    };
    bindImport();
  };

  const importHtml = () => `<h3>Import</h3><input type="file" id="imp" accept=".json,application/json" /> <span id="impmsg" class="dim"></span>`;
  const bindImport = () => {
    const i = $<HTMLInputElement>("#imp");
    if (!i) return;
    i.onchange = async () => {
      const f = i.files?.[0];
      if (!f) return;
      try {
        const p = parsePassport(await f.text());
        await d.store.savePassport(p);
        d.app.latest = p;
        d.app.loadPassport(p);
        $("#impmsg").textContent = "Imported and validated ✓";
        refresh();
      } catch (e) {
        $("#impmsg").textContent = (e as Error).message;
      }
    };
  };

  const renderValidation = (p: BodyPassport | null, ruler: RulerReading[]) => {
    const el = $("#validation");
    const withRef = ruler.filter((r) => r.refMm != null).map((r) => ({ vrMm: r.vrMm, refMm: r.refMm! }));
    const rs = withRef.length ? errorStats(withRef) : null;
    const refs = p?.validation.referenceMeasurements ?? [];
    const byId = Object.fromEntries(refs.map((r) => [r.id, r]));
    const ids = p ? PROFILE_PRIMARY[p.profile].filter((id) => p.measurements.some((m) => m.id === id)) : [];
    const pm = Object.fromEntries((p?.measurements ?? []).map((m) => [m.id, m]));
    const pairs = ids.filter((id) => byId[id]).map((id) => ({ vrMm: pm[id].value, refMm: byId[id].tapeMm }));
    const bs = pairs.length ? errorStats(pairs) : null;
    el.innerHTML = `<h2>Validation</h2>
      <h3>Test 001 · ruler (Measurement Studio)</h3>
      <p>${ruler.length} readings · ${withRef.length} with reference${rs ? ` · MAE <b>${rs.maeMm.toFixed(1)} mm</b> · RMSE ${rs.rmseMm.toFixed(1)} mm · bias ${rs.meanErrorMm.toFixed(1)} mm · SD ${rs.sdMm.toFixed(1)} mm` : ""}</p>
      <div class="row wrap"><button id="xruler" ${ruler.length ? "" : "disabled"}>Ruler log (.csv)</button><button id="xtrack">Tracking log (.csv)</button></div>
      ${p ? `<h3>Tape-measure comparison (Test 08)</h3>
      <p class="dim">Measure the same person with a tape (ISO 8559-1 procedure, docs/VALIDATION.md) and enter the values in cm.</p>
      <table>${ids.map((id) => `<tr><td>${esc(MEASUREMENT_BY_ID[id].label)}</td><td class="num">${(pm[id].value / 10).toFixed(1)}</td><td><input class="tape" data-id="${id}" inputmode="decimal" placeholder="tape cm" value="${byId[id] ? (byId[id].tapeMm / 10).toFixed(1) : ""}"/></td><td class="num">${byId[id] ? ((pm[id].value - byId[id].tapeMm) / 10).toFixed(1) + " cm" : ""}</td></tr>`).join("")}</table>
      ${bs ? `<p>n=${bs.n} · MAE <b>${(bs.maeMm / 10).toFixed(2)} cm</b> · bias ${(bs.meanErrorMm / 10).toFixed(2)} cm · RMSE ${(bs.rmseMm / 10).toFixed(2)} cm</p>` : ""}
      <div class="row"><button class="primary" id="savetape">Save tape values</button><button id="xcmp" ${pairs.length ? "" : "disabled"}>Comparison report (.csv)</button></div>` : ""}`;
    const xr = $("#xruler");
    if (xr) xr.onclick = () => download("vitruvian-ruler-test-001.csv", rulerLogCsv(ruler), "text/csv");
    $("#xtrack").onclick = () => download("vitruvian-tracking-log.csv", "timestamp,device,event\n" + d.app.trackingLog.map((e) => `${e.t},${e.device},${e.event}`).join("\n") + "\n", "text/csv");
    const st = $("#savetape");
    if (st && p) st.onclick = async () => {
      const now = new Date().toISOString();
      const list = [...document.querySelectorAll<HTMLInputElement>(".tape")]
        .filter((i) => parseFloat(i.value) > 0)
        .map((i) => ({ id: i.dataset.id!, tapeMm: parseFloat(i.value) * 10, method: "tape, ISO 8559-1 landmarks (docs/VALIDATION.md)", timestamp: now }));
      const np: BodyPassport = { ...p, updatedAt: now, validation: { referenceMeasurements: list } };
      await d.store.savePassport(np);
      d.app.latest = np;
      refresh();
    };
    const xc = $("#xcmp");
    if (xc && p) xc.onclick = () => {
      const lines = ["id,label,vitruvian_cm,method,uncertainty_cm,tape_cm,error_cm,abs_error_pct"];
      for (const id of ids) if (byId[id]) {
        const m = pm[id];
        const e = m.value - byId[id].tapeMm;
        lines.push([id, MEASUREMENT_BY_ID[id].label, (m.value / 10).toFixed(1), m.method, (m.uncertaintyMm / 10).toFixed(1), (byId[id].tapeMm / 10).toFixed(1), (e / 10).toFixed(1), ((Math.abs(e) / byId[id].tapeMm) * 100).toFixed(2)].join(","));
      }
      download(`vitruvian-tape-comparison-${p.profileId.slice(0, 8)}.csv`, lines.join("\n") + "\n", "text/csv");
    };
  };

  $("#build").textContent = `build ${__BUILD__}`;
  showTab("headset");
  refresh();
  return { refresh };
}

declare const __BUILD__: string;

function toneHtml(t: SkinTone): string {
  return `<div class="tone"><span class="swatch" style="background:${t.hex}"></span><div><b>${t.hex}</b> · L*a*b* ${t.lab.map((v) => v.toFixed(1)).join(" / ")} · ITA° ${t.itaDeg.toFixed(1)} (${t.itaCategory})<br/>
    Monk Skin Tone ${t.monk} <span class="swatch sm" style="background:${MONK[t.monk - 1]}"></span> (ΔE ${t.monkDeltaE.toFixed(1)}) · <span class="dim">${t.whiteBalanced ? "white-balanced" : "UNCALIBRATED — tap the white paper"} · estimated</span></div></div>`;
}
