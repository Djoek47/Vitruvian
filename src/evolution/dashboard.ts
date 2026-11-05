import type { store as Store } from "../passport/store";
import type { VitruvianApp } from "../app/app";
import type { BodyPassport } from "../passport/passport";
import { MEASUREMENT_BY_ID } from "../measurement/registry";
import { changeReport, compareSnapshots, proportions, series, trend, type Snapshot, type BodyChangeEvent } from "../intelligence/history";
import { assessGarment, questions, recommendSizes, STATUS_LABEL, CATEGORY_FIELDS, type FitAssessment, type Garment, type GarmentCategory, type GarmentMeasureId, type WardrobeItem, type FitIntent } from "../intelligence/wardrobe";
import { bodyMesh, hypotheticalPassport, makeSequence, type SequenceKey } from "../intelligence/interpolate";
import { EvolutionViewer, type ViewDir, type ViewStyle } from "./viewer";
import { PROFILE_INFO } from "../measurement/procedures";

type Deps = { store: typeof Store; app: VitruvianApp };
type CheckIn = { id: string; date: string; weightKg?: number; tape?: Record<string, number>; workout?: { category: string; minutes: number }; notes?: string; readiness?: { hoursSinceMeal?: number; sleepH?: number; hydrated?: boolean }; useAsCurrentWeight?: boolean };
type Program = { id: string; name: string; category: string; start: string; end?: string; notes?: string };
type Schedule = { kind: "daily" | "weekly" | "monthly" | "custom"; everyDays: number };

const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const day = (iso: string) => iso.slice(0, 10);
const cmv = (mm: number) => (mm / 10).toFixed(1);
const fmtVal = (id: string, v: number) => (id === "weight" ? `${v.toFixed(1)} kg` : `${cmv(v)} cm`);
const label = (id: string) => (id === "weight" ? "Weight" : MEASUREMENT_BY_ID[id]?.label ?? id);
function download(name: string, data: BlobPart | Blob, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1500);
}

const KEY_IDS = ["height", "weight", "neck_circumference", "shoulder_width", "chest_circumference", "chest_depth", "waist_circumference", "hip_circumference", "arm_length", "upper_arm_circumference", "forearm_circumference", "wrist_circumference", "thigh_circumference", "calf_circumference"];
const TAPE_IDS = ["waist_circumference", "chest_circumference", "hip_circumference", "neck_circumference", "upper_arm_circumference", "forearm_circumference", "wrist_circumference", "thigh_circumference", "calf_circumference"];
const MESH_REGION_TO_EVENT: Record<string, string[]> = {
  hips: ["hips"], waist: ["waist"], chest: ["chest"], shoulders: ["shoulders"], neck: ["neck"], head: [], thighs: ["thighs"], calves: ["calves"], feet: ["feet"],
  "upper arms": ["upper arms", "arms"], forearms: ["forearms", "arms"],
};

export function initEvolution(d: Deps) {
  let snaps: Snapshot[] = [];
  let checkins: CheckIn[] = [];
  let items: WardrobeItem[] = [];
  let programs: Program[] = [];
  let schedule: Schedule = { kind: "monthly", everyDays: 30 };
  let viewer: EvolutionViewer | null = null;
  let studioViewer: EvolutionViewer | null = null;
  const st = { from: "", to: "", pickedFrom: false, pickedTo: false, measure: "waist_circumference", range: "all" as "week" | "month" | "quarter" | "year" | "all" | "custom", cFrom: "", cTo: "", wardFilter: "all" };

  const evo = $("#evolution");
  evo.innerHTML = `
    <h2>Body Evolution</h2>
    <p class="dim">Your measurement history on this device. Every saved session is an immutable snapshot; nothing is overwritten. Changes are only called meaningful when they exceed measurement uncertainty plus normal day-to-day variation. Proportions are geometric comparisons, not health or fitness assessments.</p>
    <div id="evo-overview"></div>
    <h3>Anatomical change map</h3>
    <div class="row wrap"><label class="field">From <select id="evo-from"></select></label><label class="field">To <select id="evo-to"></select></label>
      <label class="field">View <select id="evo-view"><option value="front">Front</option><option value="side">Side</option><option value="back">Back</option><option value="orbit">360°</option><option value="free">Free (drag)</option></select></label></div>
    <div id="evo-map-viewer" class="viewer-host"></div>
    <div class="legend"><span class="sw inc"></span>increased <span class="sw dec"></span>decreased <span class="sw pos"></span>possible (unconfirmed) <span class="sw stb"></span>stable / within noise</div>
    <div id="evo-regions"></div>
    <h3>Measurement timeline</h3>
    <div class="row wrap"><select id="evo-measure"></select>
      <div class="seg" id="evo-range">${["week", "month", "quarter", "year", "all"].map((r) => `<button data-r="${r}">${r[0].toUpperCase() + r.slice(1)}</button>`).join("")}</div>
      <input type="date" id="evo-cfrom"/> <input type="date" id="evo-cto"/></div>
    <div id="evo-chart"></div>
    <h3>Body proportions (geometric)</h3><div id="evo-props"></div>
    <h3>Change report</h3><div id="evo-report"></div>
    <h3>Body Transformation Studio</h3>
    <div id="evo-studio"></div>
    <h3>Training programs &amp; body progression</h3><div id="evo-programs"></div>
    <h3>Measurement schedule</h3><div id="evo-schedule"></div>`;

  const wardrobe = $("#wardrobe");
  const checkin = $("#checkin");

    const snapLabel = (s: Snapshot) => `${day(s.passport.updatedAt)} · ${PROFILE_INFO[s.passport.profile]?.title ?? s.passport.profile} · #${s.snapshotId}${s.passport.hardware.simulated ? " · SIMULATED" : ""}`;
  const latest = () => snaps.at(-1) ?? null;
  const previous = () => (snaps.length > 1 ? snaps.at(-2)! : null);
  const byId = (id: string) => snaps.find((s) => String(s.snapshotId) === id) ?? null;

  async function load() {
    snaps = await d.store.snapshots().catch(() => []);
    checkins = (await d.store.list<CheckIn>("checkins").catch(() => [])).sort((a, b) => a.date.localeCompare(b.date));
    items = await d.store.list<WardrobeItem>("wardrobe").catch(() => []);
    programs = await d.store.list<Program>("programs").catch(() => []);
    schedule = (await d.store.getKv<Schedule>("schedule").catch(() => undefined)) ?? schedule;
    // Follow new sessions (latest vs previous) unless the user picked dates explicitly.
    if (!st.pickedTo || !byId(st.to)) st.to = latest() ? String(latest()!.snapshotId) : "";
    if (!st.pickedFrom || !byId(st.from)) st.from = previous() ? String(previous()!.snapshotId) : st.to;
    renderAll();
  }

  function renderAll() {
    renderOverview();
    renderSelectors();
    renderMap();
    renderTimeline();
    renderProps();
    renderReport();
    renderStudio();
    renderPrograms();
    renderSchedule();
    renderWardrobe();
    renderCheckin();
  }

  // ── A. overview ────────────────────────────────────────────────────────────
  function renderOverview() {
    const L = latest();
    const P = previous();
    const ev = L && P ? compareSnapshots(P, L, snaps) : [];
    const sig = ev.filter((e) => e.significance === "significant");
    $("#evo-overview").innerHTML = !L
      ? `<p class="dim">No snapshots yet. Complete a Quick or Precision Fit in the headset — each saved session becomes a snapshot.</p>`
      : `<div class="cards">
          <div class="stat"><b>${snaps.length}</b><span>sessions recorded</span></div>
          <div class="stat"><b>${day(L.passport.updatedAt)}</b><span>last scan</span></div>
          <div class="stat"><b>${P ? day(P.passport.updatedAt) : "—"}</b><span>previous scan</span></div>
          <div class="stat"><b>${sig.length}</b><span>meaningful changes since previous</span></div>
          <div class="stat"><b>${checkins.length}</b><span>check-ins</span></div></div>
        ${sig.length ? `<p>${sig.slice(0, 4).map((e) => `<b>${esc(e.label)}</b> ${e.delta > 0 ? "+" : ""}${fmtVal(e.measurementId, e.delta)}`).join(" · ")}</p>` : P ? `<p class="dim">No change since the previous scan exceeds the uncertainty threshold.</p>` : ""}`;
  }

  function renderSelectors() {
    const opts = snaps.map((s) => `<option value="${s.snapshotId}">${esc(snapLabel(s))}</option>`).join("");
    const f = $<HTMLSelectElement>("#evo-from");
    const t = $<HTMLSelectElement>("#evo-to");
    f.innerHTML = opts;
    t.innerHTML = opts;
    f.value = st.from;
    t.value = st.to;
    f.onchange = () => ((st.from = f.value), (st.pickedFrom = true), renderMap(), renderReport());
    t.onchange = () => ((st.to = t.value), (st.pickedTo = true), renderMap(), renderReport());
    const v = $<HTMLSelectElement>("#evo-view");
    v.onchange = () => viewer?.setView(v.value as ViewDir);
    const m = $<HTMLSelectElement>("#evo-measure");
    const ids = new Set<string>(["weight"]);
    for (const s of snaps) for (const x of s.passport.measurements) ids.add(x.id);
    for (const c of checkins) for (const k of Object.keys(c.tape ?? {})) ids.add(k);
    m.innerHTML = [...ids].map((id) => `<option value="${id}">${esc(label(id))}</option>`).join("");
    if (![...ids].includes(st.measure)) st.measure = [...ids][1] ?? "weight";
    m.value = st.measure;
    m.onchange = () => ((st.measure = m.value), renderTimeline());
    document.querySelectorAll<HTMLButtonElement>("#evo-range button").forEach((b) => {
      b.classList.toggle("on", b.dataset.r === st.range);
      b.onclick = () => ((st.range = b.dataset.r as typeof st.range), renderSelectors(), renderTimeline());
    });
    const cf = $<HTMLInputElement>("#evo-cfrom");
    const ct = $<HTMLInputElement>("#evo-cto");
    cf.onchange = ct.onchange = () => {
      st.cFrom = cf.value;
      st.cTo = ct.value;
      st.range = "custom";
      renderTimeline();
    };
  }

  // ── B. change map ──────────────────────────────────────────────────────────
  function colorsFor(ev: BodyChangeEvent[], regions: string[]): Float32Array {
    const per: Record<string, BodyChangeEvent | undefined> = {};
    for (const e of ev) {
      const cur = per[e.region];
      if (!cur || e.z > cur.z) per[e.region] = e;
    }
    const col = new Float32Array(regions.length * 3);
    regions.forEach((r, i) => {
      const e = (MESH_REGION_TO_EVENT[r] ?? []).map((x) => per[x]).find(Boolean);
      let c = [0.2, 0.18, 0.16];
      if (e) {
        if (e.significance === "stable") c = [0.42, 0.38, 0.33];
        else {
          const base = e.delta > 0 ? [1, 0.78, 0.1] : [0.36, 0.78, 1];
          c = e.significance === "significant" ? base : base.map((x) => x * 0.5 + 0.2);
        }
      }
      col.set(c, i * 3);
    });
    return col;
  }

  function renderMap() {
    const A = byId(st.from);
    const B = byId(st.to);
    const host = $("#evo-map-viewer");
    if (!B) {
      host.innerHTML = `<p class="dim">The 3D change map appears after your first saved session.</p>`;
      $("#evo-regions").innerHTML = "";
      return;
    }
    if (!viewer) {
      host.innerHTML = "";
      viewer = new EvolutionViewer(host, 960, 560);
    }
    const ev = A && A !== B ? compareSnapshots(A, B, snaps) : [];
    const mesh = bodyMesh(B.passport).mesh;
    viewer.show([mesh], { colors: [colorsFor(ev, mesh.vertexRegion)] });
    viewer.setStyle("gold-wire");
    viewer.overlay = { title: "VITRUVIAN · CHANGE MAP", kind: "ACTUAL SCAN", date: `${A && A !== B ? day(A.passport.updatedAt) + " → " : ""}${day(B.passport.updatedAt)}`, lines: [] };
    const regions: Record<string, BodyChangeEvent[]> = {};
    for (const e of ev) (regions[e.region] ??= []).push(e);
    $("#evo-regions").innerHTML = !ev.length ? `<p class="dim">Choose two different snapshots to compare.</p>` : `<div class="regions">${Object.entries(regions).map(([r, list]) => `<div class="region"><b>${esc(r)}</b>${list.map((e) => `<div class="${e.significance}">${esc(e.label)}: ${e.delta > 0 ? "+" : ""}${fmtVal(e.measurementId, e.delta)} <span class="dim">(${e.pct >= 0 ? "+" : ""}${e.pct.toFixed(1)} % · ${e.significance})</span></div>`).join("")}</div>`).join("")}</div>`;
  }

  // ── C. timeline ────────────────────────────────────────────────────────────
  function renderTimeline() {
    const id = st.measure;
    let pts = series(snaps, id, checkins);
    const now = Date.now();
    const span = { week: 7, month: 31, quarter: 92, year: 366 }[st.range as "week"];
    if (span) pts = pts.filter((p) => now - new Date(p.at).getTime() <= span * 86400000);
    if (st.range === "custom") pts = pts.filter((p) => (!st.cFrom || p.at >= st.cFrom) && (!st.cTo || p.at <= st.cTo + "T23:59"));
    const el = $("#evo-chart");
    if (!pts.length) {
      el.innerHTML = `<p class="dim">No data for ${esc(label(id))} in this range.</p>`;
      return;
    }
    const W = 900;
    const H = 260;
    const pad = 48;
    const ts = pts.map((p) => new Date(p.at).getTime());
    const t0 = Math.min(...ts);
    const t1 = Math.max(...ts, t0 + 86400000);
    const lo = Math.min(...pts.map((p) => p.value - 1.96 * p.uncertainty));
    const hi = Math.max(...pts.map((p) => p.value + 1.96 * p.uncertainty));
    const pr = (hi - lo) * 0.1 || 1;
    const X = (t: number) => pad + ((t - t0) / (t1 - t0)) * (W - 2 * pad);
    const Y = (v: number) => H - pad + 10 - ((v - (lo - pr)) / (hi - lo + 2 * pr)) * (H - pad - 20);
    const tr = trend(snaps.filter((s) => pts.some((p) => p.snapshotId === s.snapshotId)), id);
    const unit = id === "weight" ? 1 : 10;
    const ticks = [lo, (lo + hi) / 2, hi].map((v) => `<text x="6" y="${Y(v) + 4}" class="ax">${(v / unit).toFixed(1)}</text><line x1="${pad}" x2="${W - pad}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/>`).join("");
    const bars = pts.map((p, i) => `<line x1="${X(ts[i])}" x2="${X(ts[i])}" y1="${Y(p.value - 1.96 * p.uncertainty)}" y2="${Y(p.value + 1.96 * p.uncertainty)}" class="eb"/>`).join("");
    const dots = pts.map((p, i) => `<circle cx="${X(ts[i])}" cy="${Y(p.value)}" r="6" class="${p.kind === "scan" ? "scan" : "chk"}"><title>${day(p.at)} · ${fmtVal(id, p.value)} ±${fmtVal(id, 1.96 * p.uncertainty)} · ${p.kind} (${p.method})</title></circle>`).join("");
    const path = pts.filter((p) => p.kind === "scan").map((p, i, a) => `${i ? "L" : "M"}${X(new Date(p.at).getTime())},${Y(p.value)}`).join("");
    let trendLine = "";
    if (tr) {
      const w0 = (t0 - tr.t0) / (7 * 86400000);
      const w1 = (t1 - tr.t0) / (7 * 86400000);
      trendLine = `<line x1="${X(t0)}" y1="${Y(tr.interceptAt0 + tr.slopePerWeek * w0)}" x2="${X(t1)}" y2="${Y(tr.interceptAt0 + tr.slopePerWeek * w1)}" class="tr"/>`;
    }
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(label(id))} over time">${ticks}${bars}<path d="${path}" class="ln"/>${trendLine}${dots}
      <text x="${pad}" y="${H - 8}" class="ax">${day(new Date(t0).toISOString())}</text><text x="${W - pad}" y="${H - 8}" class="ax" text-anchor="end">${day(new Date(t1).toISOString())}</text></svg>
      <p class="dim">● scan &nbsp; ○ check-in (tape/scale) &nbsp; bars = 95 % measurement uncertainty${tr ? ` · trend ${tr.slopePerWeek >= 0 ? "+" : ""}${fmtVal(id, tr.slopePerWeek)}/week ± ${fmtVal(id, tr.seSlope)} — ${tr.significant ? "significant" : "not significant"} (n=${tr.n})` : " · trend needs ≥ 3 scans"}</p>`;
  }

  // ── D. proportions ─────────────────────────────────────────────────────────
  function renderProps() {
    const cols = [snaps[0], previous(), latest()].filter((x, i, a): x is Snapshot => !!x && a.indexOf(x) === i);
    if (!cols.length) {
      $("#evo-props").innerHTML = "";
      return;
    }
    const pr = cols.map((s) => proportions(s.passport));
    const rows: [string, keyof ReturnType<typeof proportions>, (v: number) => string][] = [
      ["Shoulder ÷ waist breadth", "shoulderToWaistBreadth", (v) => v.toFixed(3)], ["Chest ÷ waist circumference", "chestToWaistCirc", (v) => v.toFixed(3)],
      ["Waist ÷ hip circumference", "waistToHipCirc", (v) => v.toFixed(3)], ["Arm span ÷ height", "armSpanToHeight", (v) => v.toFixed(3)],
      ["Upper arm ÷ forearm length", "upperArmToForearm", (v) => v.toFixed(3)], ["Inseam ÷ height", "legToHeight", (v) => v.toFixed(3)],
      ["Shoulder level L − R (mm)", "shoulderLevelMm", (v) => v.toFixed(1)], ["Waist centre offset (mm)", "waistCentreOffsetMm", (v) => v.toFixed(1)],
    ];
    $("#evo-props").innerHTML = `<table><tr><td></td>${cols.map((c) => `<td class="num">${day(c.passport.updatedAt)}</td>`).join("")}</tr>${rows.map(([l, k, f]) => `<tr><td>${l}</td>${pr.map((p) => `<td class="num">${p[k] == null ? "—" : f(p[k] as number)}</td>`).join("")}</tr>`).join("")}</table>
      <p class="dim">Geometric comparisons of your own measurements over time. Symmetry values come from simultaneous two-tip captures; differences under ~5 mm are within measurement uncertainty.</p>`;
  }

  // ── E. report ──────────────────────────────────────────────────────────────
  function renderReport() {
    const A = byId(st.from);
    const B = byId(st.to);
    const el = $("#evo-report");
    if (!A || !B || A === B) {
      el.innerHTML = `<p class="dim">Select two different snapshots above.</p>`;
      return;
    }
    const r = changeReport(A, B, snaps);
    el.innerHTML = `${r.protocol.map((p) => `<p class="warnline">${esc(p)}</p>`).join("")}
      <table><tr><td>Measurement</td><td class="num">Previous</td><td class="num">Current</td><td class="num">Change</td><td class="num">%</td><td class="num">/week</td><td class="num">±95 %</td><td>Assessment</td></tr>
      ${r.events.map((e) => `<tr class="${e.significance}"><td>${esc(e.label)}</td><td class="num">${fmtVal(e.measurementId, e.from.value)}</td><td class="num">${fmtVal(e.measurementId, e.to.value)}</td><td class="num">${e.delta > 0 ? "+" : ""}${fmtVal(e.measurementId, e.delta)}</td><td class="num">${e.pct >= 0 ? "+" : ""}${e.pct.toFixed(2)}</td><td class="num">${e.perWeek == null ? "—" : (e.perWeek > 0 ? "+" : "") + fmtVal(e.measurementId, e.perWeek)}</td><td class="num">${fmtVal(e.measurementId, 1.96 * e.uDelta)}</td><td>${e.significance}${e.confirmedByTrend ? " ✓trend" : ""}<br/><span class="dim">${e.notes.map(esc).join(" ")}</span></td></tr>`).join("")}</table>
      <div class="row"><button id="rep-md">Report (.md)</button><button id="rep-json">Report data (.json)</button></div>`;
    $("#rep-md").onclick = () => download(`vitruvian-change-${A.snapshotId}-${B.snapshotId}.md`, r.text, "text/markdown");
    $("#rep-json").onclick = () => download(`vitruvian-change-${A.snapshotId}-${B.snapshotId}.json`, JSON.stringify(r, null, 2), "application/json");
  }

  // ── F. transformation studio ───────────────────────────────────────────────
  function renderStudio() {
    const el = $("#evo-studio");
    if (!snaps.length) {
      el.innerHTML = `<p class="dim">Needs at least one saved snapshot (two or more for a transformation).</p>`;
      return;
    }
    el.innerHTML = `<p class="dim">Every body is generated by the same parametric model in the same standard pose, so snapshots are compared on identical scale and topology. Frames between scans are labelled <b>INTERPOLATED VISUAL STATE</b>.</p>
      <div class="snaplist">${snaps.map((s, i) => `<label class="check"><input type="checkbox" class="ts-snap" value="${s.snapshotId}" ${i >= snaps.length - 6 ? "checked" : ""}/> ${esc(snapLabel(s))}</label>`).join("")}</div>
      <details><summary>Hypothetical scenario (simulation)</summary>
        <p class="dim">Adds a clearly-labelled HYPOTHETICAL end state: your latest body with these changes (cm). It is a simulation, not a prediction.</p>
        <div class="row wrap">${["chest_circumference", "waist_circumference", "hip_circumference", "upper_arm_circumference", "thigh_circumference"].map((id) => `<label class="field">${esc(label(id))} Δ cm<input class="hyp" data-id="${id}" type="number" step="0.5" value="0"/></label>`).join("")}</div>
        <label class="check"><input type="checkbox" id="ts-hyp"/> Include hypothetical end state</label></details>
      <div class="row wrap">
        <label class="field">Mode <select id="ts-mode"><option value="sequence">Transformation</option><option value="overlay">Overlay first vs last</option><option value="side">Side by side</option></select></label>
        <label class="field">View <select id="ts-view"><option value="front">Front</option><option value="side">Side</option><option value="back">Back</option><option value="orbit">360°</option><option value="free">Free</option></select></label>
        <label class="field">Style <select id="ts-style"><option value="gold-wire">Faberland gold</option><option value="blue-holo">Hologram blue</option><option value="solid">Solid</option><option value="skin">Skin tone</option></select></label>
        <label class="field">Duration (s) <input id="ts-dur" type="number" min="2" max="60" value="8"/></label></div>
      <div id="ts-viewer" class="viewer-host"></div>
      <div class="row wrap"><button class="primary" id="ts-play">Play</button><button id="ts-video">Export video</button><button id="ts-frames">Image sequence (.zip)</button><button id="ts-strip">Filmstrip (.png)</button><button id="ts-report">Comparison report</button></div>
      <p id="ts-msg" class="dim"></p>`;
    studioViewer?.dispose();
    studioViewer = new EvolutionViewer($("#ts-viewer"), 960, 600);
    const keys = (): SequenceKey[] => {
      const chosen = [...document.querySelectorAll<HTMLInputElement>(".ts-snap:checked")].map((c) => byId(c.value)!).filter(Boolean);
      const k: SequenceKey[] = chosen.map((s) => ({ snapshotId: s.snapshotId, at: s.passport.updatedAt, passport: s.passport, mesh: bodyMesh(s.passport), label: day(s.passport.updatedAt) }));
      if ($<HTMLInputElement>("#ts-hyp").checked && chosen.length) {
        const deltas: Record<string, number> = {};
        document.querySelectorAll<HTMLInputElement>(".hyp").forEach((i) => (deltas[i.dataset.id!] = (parseFloat(i.value) || 0) * 10));
        const hp = hypotheticalPassport(chosen.at(-1)!.passport, deltas);
        k.push({ snapshotId: "hypothetical", at: hp.updatedAt, passport: hp, mesh: bodyMesh(hp), label: "HYPOTHETICAL", hypothetical: true });
      }
      return k;
    };
    const lines = (p: BodyPassport) => ["chest_circumference", "waist_circumference", "hip_circumference"].map((id) => {
      const m = p.measurements.find((x) => x.id === id);
      return m ? `${label(id)}: ${cmv(m.value)} cm` : "";
    }).filter(Boolean);
    const setup = () => {
      const k = keys();
      const mode = $<HTMLSelectElement>("#ts-mode").value;
      const style = $<HTMLSelectElement>("#ts-style").value as ViewStyle;
      studioViewer!.setView($<HTMLSelectElement>("#ts-view").value as ViewDir);
      if (!k.length) return null;
      if (mode !== "sequence" && k.length >= 2) {
        studioViewer!.show([k[0].mesh.mesh, k.at(-1)!.mesh.mesh], { layout: mode === "side" ? "side" : "overlay" });
        studioViewer!.setStyle(style, d.app.appearance?.skinTone?.hex);
        studioViewer!.overlay = { title: "VITRUVIAN · BEFORE / AFTER", kind: k.at(-1)!.hypothetical ? "HYPOTHETICAL SIMULATION" : "ACTUAL SCAN", date: `${k[0].label}  vs  ${k.at(-1)!.label}`, lines: [`gold = ${k[0].label}   ember = ${k.at(-1)!.label}`, ...lines(k.at(-1)!.passport)] };
        return null;
      }
      const seq = makeSequence(k);
      studioViewer!.show([k[0].mesh.mesh]);
      studioViewer!.setStyle(style, d.app.appearance?.skinTone?.hex);
      const t0 = new Date(k[0].at).getTime();
      const t1 = new Date(k.at(-1)!.at).getTime();
      const ticks = k.map((_, i) => (k.length === 1 ? 0 : i / (k.length - 1)));
      return (u: number) => {
        const f = seq.frameAt(u);
        studioViewer!.setPositions(f.positions);
        const act = f.kind !== "INTERPOLATED VISUAL STATE";
        studioViewer!.overlay = {
          title: "VITRUVIAN · BODY TRANSFORMATION", kind: f.kind, date: f.dateLabel,
          lines: act ? lines((f.alpha === 1 ? f.to : f.from).passport) : [`between ${f.from.label} and ${f.to.label}`, ...lines(f.from.passport).map((l, i) => `${l} → ${lines(f.to.passport)[i]?.split(": ")[1] ?? ""}`)],
          timeline: { ticks, u, labels: k.map((x) => x.label) },
        };
        void t0;
        void t1;
      };
    };
    let frameFn = setup();
    const msg = (m: string) => ($("#ts-msg").textContent = m);
    el.querySelectorAll("select, input").forEach((i) => i.addEventListener("change", () => (frameFn = setup())));
    frameFn?.(0);
    $("#ts-play").onclick = () => {
      frameFn = setup();
      if (!frameFn) return;
      const dur = parseFloat($<HTMLInputElement>("#ts-dur").value) || 8;
      const start = performance.now();
      const step = () => {
        const u = Math.min(1, (performance.now() - start) / (dur * 1000));
        frameFn!(u);
        if (u < 1) requestAnimationFrame(step);
      };
      step();
    };
    $("#ts-video").onclick = async () => {
      frameFn = setup();
      if (!frameFn) return msg("Choose Transformation mode with at least one snapshot.");
      try {
        msg("Recording… (real time)");
        const r = await studioViewer!.record(parseFloat($<HTMLInputElement>("#ts-dur").value) || 8, frameFn);
        const ext = r.mime.includes("mp4") ? "mp4" : "webm";
        download(`vitruvian-transformation.${ext}`, r.blob);
        msg(`Exported ${ext.toUpperCase()} (${(r.blob.size / 1e6).toFixed(1)} MB). ${ext === "webm" ? "MP4 is not supported by this browser's recorder; WebM plays in browsers/VLC and converts losslessly with ffmpeg." : ""}`);
        await d.store.put("sequences", { id: uid(), createdAt: new Date().toISOString(), snapshotIds: keys().map((k) => k.snapshotId), durationS: parseFloat($<HTMLInputElement>("#ts-dur").value) || 8, view: $<HTMLSelectElement>("#ts-view").value, style: $<HTMLSelectElement>("#ts-style").value });
      } catch (e) {
        msg((e as Error).message);
      }
    };
    $("#ts-frames").onclick = async () => {
      frameFn = setup();
      if (!frameFn) return msg("Choose Transformation mode.");
      msg("Rendering 60 frames…");
      download("vitruvian-transformation-frames.zip", await studioViewer!.frames(60, frameFn));
      msg("Image sequence exported (60 PNG frames, labels burned in).");
    };
    $("#ts-strip").onclick = async () => {
      const k = keys();
      if (!k.length) return;
      frameFn = setup();
      if (!frameFn) return msg("Choose Transformation mode.");
      const fn = frameFn;
      download("vitruvian-transformation-filmstrip.png", await studioViewer!.filmstrip(k.map((_, i) => () => fn(k.length === 1 ? 0 : i / (k.length - 1)))));
    };
    $("#ts-report").onclick = () => {
      const k = keys().filter((x) => !x.hypothetical);
      if (k.length < 2) return msg("Select at least two real snapshots.");
      const a = { snapshotId: k[0].snapshotId, passport: k[0].passport };
      const b = { snapshotId: k.at(-1)!.snapshotId, passport: k.at(-1)!.passport };
      download(`vitruvian-transformation-report.md`, changeReport(a, b, snaps).text, "text/markdown");
    };
  }

  // ── programs ───────────────────────────────────────────────────────────────
  function renderPrograms() {
    const el = $("#evo-programs");
    const near = (iso: string, dir: "before" | "after") => {
      const t = new Date(iso).getTime();
      const c = dir === "before" ? snaps.filter((s) => new Date(s.passport.updatedAt).getTime() <= t + 86400000).at(-1) : snaps.find((s) => new Date(s.passport.updatedAt).getTime() >= t - 86400000);
      return c ?? null;
    };
    el.innerHTML = `<p class="dim">Link scans to a training program to compare before and after. A change that happens after a program started is an association, not proof that the program caused it.</p>
      ${programs.map((p) => {
        const a = near(p.start, "before");
        const b = p.end ? near(p.end, "after") : latest();
        const ev = a && b && a !== b ? compareSnapshots(a, b, snaps).filter((e) => e.significance !== "stable") : [];
        return `<div class="prog"><b>${esc(p.name)}</b> <span class="dim">${esc(p.category)} · ${day(p.start)} → ${p.end ? day(p.end) : "ongoing"}</span> <button class="ghost sm" data-delprog="${p.id}">Delete</button>
          <div>${a && b && a !== b ? `Compared ${day(a.passport.updatedAt)} → ${day(b.passport.updatedAt)}: ${ev.length ? ev.map((e) => `${esc(e.label)} ${e.delta > 0 ? "+" : ""}${fmtVal(e.measurementId, e.delta)} (${e.significance})`).join(" · ") : "no change beyond uncertainty"}` : `<span class="dim">Needs a scan before the start and one after.</span>`}</div></div>`;
      }).join("")}
      <div class="row wrap"><input id="pg-name" placeholder="Program name"/><select id="pg-cat"><option>Resistance training</option><option>Endurance</option><option>Mixed</option><option>Nutrition change</option><option>Other</option></select>
        <label class="field">Start<input id="pg-start" type="date"/></label><label class="field">End<input id="pg-end" type="date"/></label><button id="pg-add">Add program</button></div>`;
    el.querySelectorAll<HTMLButtonElement>("[data-delprog]").forEach((b) => (b.onclick = async () => (await d.store.remove("programs", b.dataset.delprog!), load())));
    $("#pg-add").onclick = async () => {
      const name = $<HTMLInputElement>("#pg-name").value.trim();
      const start = $<HTMLInputElement>("#pg-start").value;
      if (!name || !start) return;
      await d.store.put("programs", { id: uid(), name, category: $<HTMLSelectElement>("#pg-cat").value, start, end: $<HTMLInputElement>("#pg-end").value || undefined });
      load();
    };
  }

  function renderSchedule() {
    const lastScan = latest()?.passport.updatedAt;
    const lastCheck = checkins.at(-1)?.date;
    const lastAny = [lastScan, lastCheck].filter(Boolean).sort().at(-1);
    const due = lastAny ? new Date(new Date(lastAny).getTime() + schedule.everyDays * 86400000) : new Date();
    $("#evo-schedule").innerHTML = `<div class="row wrap"><select id="sc-kind"><option value="daily">Daily check-in</option><option value="weekly">Weekly guided measurements</option><option value="monthly">Monthly full scan</option><option value="custom">Custom</option></select>
      <label class="field">Every (days)<input id="sc-days" type="number" min="1" max="365" value="${schedule.everyDays}"/></label></div>
      <p>Next: <b>${due <= new Date() ? "due now" : day(due.toISOString())}</b> · <span class="dim">For comparable results measure at the same time of day, same clothing, after the same routine (e.g. morning, before eating). A full monthly scan updates your body model; check-ins don't need the headset.</span></p>`;
    const k = $<HTMLSelectElement>("#sc-kind");
    k.value = schedule.kind;
    const save = async () => {
      const kind = k.value as Schedule["kind"];
      const def = { daily: 1, weekly: 7, monthly: 30, custom: parseInt($<HTMLInputElement>("#sc-days").value) || 14 }[kind];
      schedule = { kind, everyDays: kind === "custom" ? def : def };
      await d.store.setKv("schedule", schedule);
      renderSchedule();
    };
    k.onchange = save;
    $<HTMLInputElement>("#sc-days").onchange = () => ((k.value = "custom"), save());
  }

  // ── wardrobe ───────────────────────────────────────────────────────────────
  function assessments(): { item: WardrobeItem; now: FitAssessment | null; before: FitAssessment | null }[] {
    const L = latest();
    const P = previous();
    const hist = new Map<string | number, BodyPassport>(snaps.map((s) => [s.snapshotId, s.passport]));
    const tr: Record<string, number> = {};
    for (const id of ["chest_circumference", "waist_circumference", "hip_circumference", "thigh_circumference", "shoulder_width"]) {
      const t = trend(snaps, id);
      if (t?.significant) tr[id] = t.slopePerWeek;
    }
    return items.map((item) => ({
      item,
      now: L ? assessGarment(item, L.passport, { snapshotId: L.snapshotId, previous: P?.passport, trendMmPerWeek: tr, history: hist }) : null,
      before: P ? assessGarment(item, P.passport, { snapshotId: P.snapshotId, history: hist }) : null,
    }));
  }

  function renderWardrobe() {
    const all = assessments();
    const nowList = all.map((a) => a.now).filter((x): x is FitAssessment => !!x);
    const filt = st.wardFilter;
    const pick = filt === "no-longer" ? questions.noLongerFit(nowList) : filt === "tight" ? questions.becomingTight(nowList) : filt === "after" ? questions.couldFitAfterChange(nowList) : filt === "tryon" ? questions.tryOnAgain(nowList) : nowList;
    const ids = new Set(pick.map((a) => a.itemId));
    const shown = filt === "all" ? all : all.filter((a) => ids.has(a.item.itemId));
    wardrobe.innerHTML = `<h2>Wardrobe · fit intelligence</h2>
      <p class="dim">Your garments, stored with their own measurements. Body, garment and ease (garment − body) stay separate. Assessments use your latest snapshot; the previous snapshot is shown for comparison. Ease ranges are starting points, refined by your feedback and Marvelous Designer simulation.</p>
      ${!latest() ? `<p class="warnline">No body snapshot yet — measure yourself first.</p>` : ""}
      <div class="seg" id="wq">${[["all", "All"], ["no-longer", "Which no longer fit?"], ["tight", "Becoming tight?"], ["after", "Could fit after a change?"], ["tryon", "Try on again?"]].map(([k, l]) => `<button data-q="${k}" class="${filt === k ? "on" : ""}">${l}</button>`).join("")}</div>
      ${shown.map(({ item, now, before }) => `<div class="garment">
        <div><b>${esc(item.garment.brand)} ${esc(item.garment.name)}</b> <span class="dim">${esc(item.garment.category)} · size ${esc(item.garment.size)} · ${item.garment.fitIntent}${item.garment.fabric?.stretchPct ? ` · ${item.garment.fabric.stretchPct}% stretch` : ""}${item.garment.mdProject ? ` · MD: ${esc(item.garment.mdProject)}` : ""}</span></div>
        <div class="row wrap"><span class="badge st-${now?.overall ?? "needs-info"}">${now ? STATUS_LABEL[now.overall] : "No body data"}</span>${before ? `<span class="dim">previous snapshot: ${STATUS_LABEL[before.overall]}</span>` : ""}</div>
        <details><summary>Why</summary><table>${(now?.areas ?? []).map((a) => `<tr><td>${a.area}</td><td class="num">body ${a.bodyMm == null ? "—" : cmv(a.bodyMm)}</td><td class="num">garment ${cmv(a.garmentMm)}</td><td class="num">ease ${a.easeMm == null ? "—" : cmv(a.easeMm)}</td><td class="num">target ${cmv(a.effectiveMinMm)}–${cmv(a.targetMm[1])}</td><td>${STATUS_LABEL[a.status]}${a.requiredBodyChangeMm ? `<br/><span class="dim">needs body ${a.requiredBodyChangeMm < 0 ? "−" : "+"}${cmv(Math.abs(a.requiredBodyChangeMm))} cm</span>` : ""}</td></tr>`).join("")}</table>
          ${(now?.explanation ?? []).map((x) => `<p class="dim">${esc(x)}</p>`).join("")}</details>
        <div class="row wrap"><span class="dim">Your feedback:</span>${(["too-tight", "good", "too-loose"] as const).map((v) => `<button class="ghost sm" data-fb="${item.itemId}" data-v="${v}">${v.replace("-", " ")}</button>`).join("")}
          <span class="dim">${item.feedback.length ? `last: ${item.feedback.at(-1)!.verdict} (${day(item.feedback.at(-1)!.at)})` : ""}</span><button class="ghost sm" data-delg="${item.itemId}">Remove</button></div></div>`).join("")}
      <h3>Add a garment</h3>
      <div class="row wrap"><select id="g-cat">${Object.keys(CATEGORY_FIELDS).map((c) => `<option>${c}</option>`).join("")}</select><input id="g-brand" placeholder="Brand"/><input id="g-name" placeholder="Product name"/><input id="g-size" placeholder="Size label" style="width:110px"/>
        <select id="g-fit">${["compression", "slim", "regular", "relaxed", "oversized"].map((f) => `<option ${f === "regular" ? "selected" : ""}>${f}</option>`).join("")}</select></div>
      <div class="row wrap"><input id="g-fabric" placeholder="Fabric (e.g. cotton jersey)"/><label class="field">Stretch %<input id="g-stretch" type="number" min="0" max="100" value="0" style="width:90px"/></label><input id="g-md" placeholder="Marvelous Designer project (.zprj) ref"/><label class="field">Purchased<input id="g-date" type="date"/></label></div>
      <p class="dim">Garment measurements (cm), measured on the garment laid flat or from the supplier's garment spec. For chest/waist/hip you can enter the flat width — tick "flat" and it is doubled.</p>
      <div class="row wrap" id="g-fields"></div>
      <div class="row"><button class="primary" id="g-add">Save garment</button></div>
      <h3>What size should I buy?</h3>
      <p class="dim">Paste the product's garment-measurement chart (cm) — first row headers: <code>size,chest,waist,hip,shoulder,sleeve,body_length,inseam,thigh</code>.</p>
      <textarea id="sz-csv" rows="4" placeholder="size,chest,shoulder,body_length&#10;S,92,43,69&#10;M,102,46,72"></textarea>
      <div class="row wrap"><select id="sz-cat">${Object.keys(CATEGORY_FIELDS).map((c) => `<option>${c}</option>`).join("")}</select><select id="sz-fit">${["slim", "regular", "relaxed", "oversized"].map((f) => `<option ${f === "regular" ? "selected" : ""}>${f}</option>`).join("")}</select><button id="sz-go">Recommend</button></div>
      <div id="sz-out"></div>`;
    wardrobe.querySelectorAll<HTMLButtonElement>("#wq button").forEach((b) => (b.onclick = () => ((st.wardFilter = b.dataset.q!), renderWardrobe())));
    wardrobe.querySelectorAll<HTMLButtonElement>("[data-fb]").forEach((b) => (b.onclick = async () => {
      const it = items.find((i) => i.itemId === b.dataset.fb)!;
      it.feedback.push({ at: new Date().toISOString(), verdict: b.dataset.v as "good", snapshotId: latest()?.snapshotId });
      await d.store.put("wardrobe", { id: it.itemId, ...it });
      load();
    }));
    wardrobe.querySelectorAll<HTMLButtonElement>("[data-delg]").forEach((b) => (b.onclick = async () => (await d.store.remove("wardrobe", b.dataset.delg!), load())));
    const fields = () => {
      const cat = $<HTMLSelectElement>("#g-cat").value as GarmentCategory;
      $("#g-fields").innerHTML = CATEGORY_FIELDS[cat].map((f) => `<label class="field">${f.replace("_", " ")}<input class="g-m" data-id="${f}" type="number" step="0.1" style="width:100px"/>${["chest", "waist", "hip", "thigh"].includes(f) ? `<span><input type="checkbox" class="g-flat" data-id="${f}"/> flat</span>` : ""}</label>`).join("");
    };
    $<HTMLSelectElement>("#g-cat").onchange = fields;
    fields();
    $("#g-add").onclick = async () => {
      const ms = [...document.querySelectorAll<HTMLInputElement>(".g-m")].filter((i) => parseFloat(i.value) > 0).map((i) => {
        const flat = (document.querySelector(`.g-flat[data-id="${i.dataset.id}"]`) as HTMLInputElement | null)?.checked;
        return { id: i.dataset.id as GarmentMeasureId, valueMm: parseFloat(i.value) * 10 * (flat ? 2 : 1), method: flat ? ("flat-x2" as const) : ("tape-on-garment" as const) };
      });
      const g: Garment = {
        garmentId: uid(), brand: $<HTMLInputElement>("#g-brand").value || "—", name: $<HTMLInputElement>("#g-name").value || "Garment", category: $<HTMLSelectElement>("#g-cat").value as GarmentCategory,
        size: $<HTMLInputElement>("#g-size").value || "—", measurements: ms, fabric: { type: $<HTMLInputElement>("#g-fabric").value || undefined, stretchPct: parseFloat($<HTMLInputElement>("#g-stretch").value) || 0 },
        fitIntent: $<HTMLSelectElement>("#g-fit").value as FitIntent, mdProject: $<HTMLInputElement>("#g-md").value || undefined,
      };
      const item: WardrobeItem = { itemId: g.garmentId, garment: g, addedAt: new Date().toISOString(), purchaseDate: $<HTMLInputElement>("#g-date").value || undefined, feedback: [] };
      await d.store.put("wardrobe", { id: item.itemId, ...item });
      load();
    };
    $("#sz-go").onclick = () => {
      const L = latest();
      if (!L) return ($("#sz-out").textContent = "Measure yourself first.");
      const rows = $<HTMLTextAreaElement>("#sz-csv").value.trim().split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((x) => x.trim()));
      const head = rows.shift()?.map((h) => h.toLowerCase()) ?? [];
      const cat = $<HTMLSelectElement>("#sz-cat").value as GarmentCategory;
      const sizes: Garment[] = rows.filter((r) => r.length > 1).map((r) => ({
        garmentId: r[0], brand: "", name: "product", category: cat, size: r[0], fitIntent: $<HTMLSelectElement>("#sz-fit").value as FitIntent,
        measurements: head.slice(1).map((h, i) => ({ id: h as GarmentMeasureId, valueMm: parseFloat(r[i + 1]) * 10, method: "supplier-chart" as const })).filter((m) => m.valueMm > 0),
      }));
      const rec = recommendSizes(sizes, L.passport);
      $("#sz-out").innerHTML = rec.length ? `<table>${rec.map((r, i) => `<tr><td>${i === 0 ? "★ " : ""}<b>${esc(r.size)}</b></td><td>${STATUS_LABEL[r.assessment.overall]}</td><td class="dim">${r.assessment.areas.map((a) => `${a.area} ease ${a.easeMm == null ? "—" : cmv(a.easeMm)}`).join(" · ")}</td></tr>`).join("")}</table><p class="dim">Ranked by how centrally each size sits in the target ease range for this body — garment-specific, not a generic S/M/L.</p>` : "No sizes parsed.";
    };
  }

  // ── check-in ───────────────────────────────────────────────────────────────
  function renderCheckin() {
    checkin.innerHTML = `<h2>Daily check-in</h2>
      <p class="dim">Lightweight tracking without the headset. Tape values are marked <i>manual</i>; they appear in your timeline as check-ins, never as scans. Readiness notes help explain day-to-day variation.</p>
      <div class="row wrap"><label class="field">Date<input id="ci-date" type="datetime-local"/></label><label class="field">Weight (kg)<input id="ci-w" type="number" step="0.1" style="width:110px"/></label>
        <label class="check"><input type="checkbox" id="ci-usew" checked/> use as my current weight</label></div>
      <div class="row wrap">${TAPE_IDS.map((id) => `<label class="field">${esc(label(id).replace(" (tape)", ""))} (cm)<input class="ci-t" data-id="${id}" type="number" step="0.1" style="width:100px"/></label>`).join("")}</div>
      <div class="row wrap"><label class="field">Workout<select id="ci-wk"><option value="">none</option><option>Resistance</option><option>Cardio</option><option>Mixed</option><option>Mobility</option><option>Sport</option></select></label><label class="field">Minutes<input id="ci-min" type="number" style="width:90px"/></label>
        <label class="field">Hours since last meal<input id="ci-meal" type="number" step="0.5" style="width:90px"/></label><label class="field">Sleep (h)<input id="ci-sleep" type="number" step="0.5" style="width:90px"/></label><label class="check"><input type="checkbox" id="ci-hyd"/> well hydrated</label></div>
      <textarea id="ci-notes" rows="2" placeholder="Notes"></textarea>
      <div class="row"><button class="primary" id="ci-save">Save check-in</button></div>
      <h3>Recent</h3>
      <table>${checkins.slice(-12).reverse().map((c) => `<tr><td>${c.date.replace("T", " ").slice(0, 16)}</td><td>${c.weightKg ? c.weightKg.toFixed(1) + " kg" : ""}</td><td class="dim">${Object.entries(c.tape ?? {}).map(([k, v]) => `${esc(label(k).replace(" (tape)", ""))} ${cmv(v)}`).join(" · ")}</td><td class="dim">${c.workout ? `${esc(c.workout.category)} ${c.workout.minutes || ""} min` : ""} ${esc(c.notes ?? "")}</td><td><button class="ghost sm" data-delci="${c.id}">Delete</button></td></tr>`).join("")}</table>`;
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    $<HTMLInputElement>("#ci-date").value = now;
    checkin.querySelectorAll<HTMLButtonElement>("[data-delci]").forEach((b) => (b.onclick = async () => (await d.store.remove("checkins", b.dataset.delci!), load())));
    $("#ci-save").onclick = async () => {
      const tape: Record<string, number> = {};
      document.querySelectorAll<HTMLInputElement>(".ci-t").forEach((i) => parseFloat(i.value) > 0 && (tape[i.dataset.id!] = parseFloat(i.value) * 10));
      const w = parseFloat($<HTMLInputElement>("#ci-w").value);
      const c: CheckIn = {
        id: uid(), date: new Date($<HTMLInputElement>("#ci-date").value || Date.now()).toISOString(), weightKg: w > 0 ? w : undefined, tape,
        workout: $<HTMLSelectElement>("#ci-wk").value ? { category: $<HTMLSelectElement>("#ci-wk").value, minutes: parseFloat($<HTMLInputElement>("#ci-min").value) || 0 } : undefined,
        notes: $<HTMLTextAreaElement>("#ci-notes").value || undefined,
        readiness: { hoursSinceMeal: parseFloat($<HTMLInputElement>("#ci-meal").value) || undefined, sleepH: parseFloat($<HTMLInputElement>("#ci-sleep").value) || undefined, hydrated: $<HTMLInputElement>("#ci-hyd").checked },
      };
      await d.store.put("checkins", c);
      if (c.weightKg && $<HTMLInputElement>("#ci-usew").checked) {
        d.app.subject = { ...d.app.subject, weightKg: c.weightKg };
        await d.store.setKv("subject", d.app.subject);
      }
      load();
    };
  }

  load();
  return { refresh: load, get viewer() { return studioViewer; } };
}

export type { CheckIn, Program, Schedule };
export { KEY_IDS };
