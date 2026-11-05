// Body Intelligence acceptance suite (software). Numbers come from synthetic
// bodies with KNOWN ground truth — no fabricated user data.
import { describe, expect, it } from "vitest";
import { SyntheticBody, runSession, passportFrom } from "./synthetic";
import { compareSnapshots, changeReport, trend, proportions, series, type Snapshot } from "../src/intelligence/history";
import { assessGarment, recommendSizes, type WardrobeItem, type Garment } from "../src/intelligence/wardrobe";
import { bodyMesh, compatible, makeSequence, hypotheticalPassport, lerpPositions } from "../src/intelligence/interpolate";
import { crc32, zipStore } from "../src/intelligence/zip";
import { migratePassport, parsePassport, validatePassport } from "../src/passport/passport";
import { computeComposition, meshVolumeL, navyBodyFat } from "../src/body/composition";
import { srgbToLab, skinToneFrom, nearestMonk, MONK, fromHex, ita } from "../src/appearance/skinTone";
import { footLengthFromSize, sizeFromFootLength } from "../src/body/shoe";
import { bodyToUe, unrealPassport, unrealDataTableCsv } from "../src/bridge/unreal";
import { buildMannequin } from "../src/body/mannequin";

const WEEK = 7 * 86400000;
const at = (w: number) => new Date(Date.parse("2026-01-05T08:00:00Z") + w * WEEK).toISOString();

/** Snapshot of a synthetic body whose waist is `dWaist` m wider/deeper than baseline. */
function snap(id: number, week: number, dWaist = 0, profile: "quick" | "precision" = "quick"): Snapshot {
  const b = new SyntheticBody();
  if (dWaist) {
    b.offsets.waist_side_l = [-dWaist / 2, 0, 0];
    b.offsets.waist_side_r = [dWaist / 2, 0, 0];
    b.offsets.waist_front = [0, 0, dWaist / 2];
    b.offsets.waist_back = [0, 0, -dWaist / 2];
  }
  const s = runSession(profile, b, Date.parse(at(week)));
  return { snapshotId: id, passport: passportFrom(s, at(week)) };
}

describe("BI-1/2 snapshots are immutable and comparable", () => {
  it("saving a later snapshot never changes an earlier one", () => {
    const a = snap(1, 0);
    const frozen = JSON.stringify(a.passport);
    const b = snap(2, 4, 0.02);
    compareSnapshots(a, b, [a, b]);
    changeReport(a, b, [a, b]);
    expect(JSON.stringify(a.passport)).toBe(frozen);
  });
});

describe("BI-3/4/5/6 change detection", () => {
  const a = snap(1, 0);
  const b = snap(2, 4, 0.06); // waist +6 cm breadth and depth (≈ +19 cm girth)
  const ev = compareSnapshots(a, b, [a, b]);
  const get = (id: string) => ev.find((e) => e.measurementId === id)!;
  it("computes previous, current, delta, % and rate correctly", () => {
    const w = get("waist_width");
    expect(w.from.value).toBeCloseTo(290, 0);
    expect(w.to.value).toBeCloseTo(350, 0);
    expect(w.delta).toBeCloseTo(60, 0);
    expect(w.pct).toBeCloseTo((60 / 290) * 100, 1);
    expect(w.perWeek!).toBeCloseTo(60 / 4, 1);
    expect(w.uDelta).toBeGreaterThan(0);
  });
  it("flags a real change and keeps unchanged dimensions stable", () => {
    expect(get("waist_circumference").significance).toBe("significant");
    expect(get("waist_circumference").direction).toBe("increase");
    expect(get("height").significance).toBe("stable");
    expect(get("shoulder_width").significance).toBe("stable");
  });
  it("filters a tracking-noise-sized change (3 mm) as within noise", () => {
    const c = snap(3, 5, 0.003);
    const e = compareSnapshots(a, c, [a, c]).find((x) => x.measurementId === "waist_width")!;
    expect(e.significance).toBe("stable");
  });
  it("a borderline single change is only 'possible' unless a trend confirms it", () => {
    const c = snap(3, 5, 0.03);
    const e = compareSnapshots(a, c, [a, c]).find((x) => x.measurementId === "waist_circumference")!;
    expect(e.z).toBeGreaterThan(0);
    if (e.z >= 2 && e.z < 3) expect(e.significance).toBe("possible");
    if (e.z < 2) expect(e.significance).toBe("stable");
    if (e.z >= 3) expect(e.significance).toBe("significant");
  });
  it("weighted trend over ≥ 3 snapshots", () => {
    const h = [snap(1, 0, 0), snap(2, 2, 0.02), snap(3, 4, 0.04), snap(4, 6, 0.06)];
    const t = trend(h, "waist_width")!;
    expect(t.n).toBe(4);
    expect(t.slopePerWeek).toBeCloseTo(10, 0); // 60 mm over 6 weeks
    expect(t.significant).toBe(true);
    expect(trend(h.slice(0, 2), "waist_width")).toBeNull();
    expect(series(h, "waist_width").length).toBe(4);
  });
  it("proportions are geometric ratios", () => {
    const p = proportions(a.passport);
    expect(p.shoulderToWaistBreadth!).toBeCloseTo(400 / 290, 2);
    expect(p.shoulderLevelMm!).toBeCloseTo(0, 1);
  });
});

describe("BI-14 reports are reproducible from stored data", () => {
  it("same snapshots → identical report", () => {
    const a = snap(1, 0);
    const b = snap(2, 4, 0.02);
    expect(changeReport(a, b, [a, b]).text).toBe(changeReport(a, b, [a, b]).text);
    expect(changeReport(a, b).text).toContain("bi-change@1");
  });
});

describe("BI-7/8/9 body models, interpolation and labels", () => {
  const a = snap(1, 0);
  const b = snap(2, 8, 0.04);
  const ma = bodyMesh(a.passport);
  const mb = bodyMesh(b.passport);
  it("every snapshot mesh shares one topology (correspondence by construction)", () => {
    expect(ma.topology).toBe(mb.topology);
    expect(compatible(ma, mb)).toBe(true);
    const precision = bodyMesh(snap(3, 9, 0, "precision").passport);
    expect(precision.topology).toBe(ma.topology);
  });
  it("interpolation is exact at the ends and stable in between", () => {
    const p0 = lerpPositions(ma.mesh, mb.mesh, 0);
    const p1 = lerpPositions(ma.mesh, mb.mesh, 1);
    expect(p0[3 * 100 + 1]).toBeCloseTo(ma.mesh.vertices[100][1], 2); // float32, mm
    expect(p1[3 * 100]).toBeCloseTo(mb.mesh.vertices[100][0], 2);
    const mid = lerpPositions(ma.mesh, mb.mesh, 0.5);
    for (let i = 0; i < mid.length; i++) expect(Number.isFinite(mid[i])).toBe(true);
  });
  it("labels: ACTUAL SCAN at keyframes, INTERPOLATED between, HYPOTHETICAL for simulations", () => {
    const keys = [a, b].map((s) => ({ snapshotId: s.snapshotId, at: s.passport.updatedAt, passport: s.passport, mesh: bodyMesh(s.passport), label: s.passport.updatedAt.slice(0, 10) }));
    const seq = makeSequence(keys);
    expect(seq.frameAt(0).kind).toBe("ACTUAL SCAN");
    expect(seq.frameAt(1).kind).toBe("ACTUAL SCAN");
    expect(seq.frameAt(0.5).kind).toBe("INTERPOLATED VISUAL STATE");
    const hp = hypotheticalPassport(b.passport, { waist_circumference: -30 });
    expect(hp.hardware.simulated).toBe(true);
    const seq2 = makeSequence([...keys, { snapshotId: "h", at: hp.updatedAt, passport: hp, mesh: bodyMesh(hp), label: "HYP", hypothetical: true }]);
    expect(seq2.frameAt(1).kind).toBe("HYPOTHETICAL SIMULATION");
    expect(seq2.frameAt(0.75).kind).toBe("HYPOTHETICAL SIMULATION");
  });
  it("refuses meshes with different topology", () => {
    const bad = { ...mb, topology: mb.topology + "x" };
    expect(() => makeSequence([{ snapshotId: 1, at: "", passport: a.passport, mesh: ma, label: "" }, { snapshotId: 2, at: "", passport: b.passport, mesh: bad, label: "" }])).toThrow(/topology/);
  });
});

/** Replace a measurement by a tape (manual) value: ±5 mm instead of the derived-model uncertainty. */
function withTape(s: Snapshot, id: string): Snapshot {
  return { ...s, passport: { ...s.passport, measurements: s.passport.measurements.map((m) => (m.id === id ? { ...m, method: "manual" as const, uncertaintyMm: 0, procedure: "tape" } : m)) } };
}

describe("BI-11/12/13 wardrobe: garment ≠ body, ease, garment-specific fit", () => {
  const base = withTape(snap(1, 0), "chest_circumference");
  const grown = snap(2, 8, 0.05);
  const chest = base.passport.measurements.find((m) => m.id === "chest_circumference")!.value;
  const shoulder = base.passport.measurements.find((m) => m.id === "shoulder_width")!.value;
  const tee = (chestMm: number, stretch = 0, fit: Garment["fitIntent"] = "regular"): WardrobeItem => ({
    itemId: "tee", addedAt: "", feedback: [],
    garment: { garmentId: "tee", brand: "Test", name: "Black tee", category: "tshirt", size: "M", fitIntent: fit, fabric: { stretchPct: stretch }, measurements: [{ id: "chest", valueMm: chestMm, method: "flat-x2" }, { id: "shoulder", valueMm: shoulder + 20, method: "tape-on-garment" }] },
  });
  it("ease = garment − body, kept separate", () => {
    const a = assessGarment(tee(chest + 90), base.passport);
    const c = a.areas.find((x) => x.area === "chest")!;
    expect(c.easeMm!).toBeCloseTo(90, 6);
    expect(c.garmentMm).toBe(chest + 90);
    expect(c.bodyMm).toBe(chest);
    expect(a.overall).toBe("fits-comfortably");
  });
  it("a derived (uncalibrated-model) girth near a limit is honestly 'undetermined'", () => {
    const raw = snap(1, 0);
    const ch = raw.passport.measurements.find((m) => m.id === "chest_circumference")!;
    const a = assessGarment(tee(ch.value + 70), raw.passport);
    expect(["undetermined", "fits-comfortably"]).toContain(a.areas[0].status);
    if (ch.uncertaintyMm > 10) expect(a.areas[0].status).toBe("undetermined");
  });
  it("tight / loose / stretch-aware / needs-info", () => {
    expect(assessGarment(tee(chest - 40), base.passport).overall).toBe("may-no-longer-fit");
    expect(assessGarment(tee(chest + 300), base.passport).overall).toBe("too-loose");
    // compression intent: negative ease is correct, not "too tight"
    expect(assessGarment(tee(chest - 60, 30, "compression"), base.passport).areas[0].status).toBe("fits-comfortably");
    const jeans: WardrobeItem = { itemId: "j", addedAt: "", feedback: [], garment: { garmentId: "j", brand: "", name: "Jeans", category: "jeans", size: "32", fitIntent: "regular", measurements: [{ id: "thigh", valueMm: 600, method: "flat-x2" }] } };
    const a = assessGarment(jeans, base.passport); // quick profile has no thigh measurement
    expect(a.overall).toBe("needs-info");
    expect(a.requiresMore.join()).toMatch(/thigh/);
  });
  it("body growth makes the same garment 'becoming tight' vs the previous snapshot", () => {
    const waist0 = base.passport.measurements.find((m) => m.id === "waist_circumference")!.value;
    const it: WardrobeItem = { ...tee(chest + 70), garment: { ...tee(chest + 70).garment, measurements: [{ id: "chest", valueMm: chest + 70, method: "flat-x2" }, { id: "waist", valueMm: waist0 + 80, method: "flat-x2" }] } };
    const before = assessGarment(it, base.passport);
    const after = assessGarment(it, grown.passport, { previous: base.passport });
    const w0 = before.areas.find((x) => x.area === "waist")!;
    const w1 = after.areas.find((x) => x.area === "waist")!;
    expect(w1.easeMm!).toBeLessThan(w0.easeMm!);
    expect(["becoming-tight", "may-no-longer-fit", "undetermined"]).toContain(w1.status);
  });
  it("size recommendation is garment-specific", () => {
    const sizes: Garment[] = [-40, 90, 220].map((d, i) => ({ garmentId: "s" + i, brand: "", name: "", category: "tshirt", size: ["S", "M", "L"][i], fitIntent: "regular", measurements: [{ id: "chest", valueMm: chest + d, method: "supplier-chart" }, { id: "shoulder", valueMm: shoulder + 20, method: "supplier-chart" }] }));
    expect(recommendSizes(sizes, base.passport)[0].size).toBe("M");
  });
});

describe("BI-15 passports stay exportable across schema versions", () => {
  it("1.0 files import and migrate to 1.1", () => {
    const p = snap(1, 0).passport;
    const old = { ...p, schemaVersion: "1.0" };
    expect(validatePassport(old).ok).toBe(true);
    expect(parsePassport(JSON.stringify(old)).schemaVersion).toBe("1.1");
    expect(migratePassport(p)).toBe(p);
    const ue = unrealPassport(p);
    expect(ue.Measurements.length).toBe(p.measurements.length);
    expect(unrealDataTableCsv(p).split("\n")[0]).toBe("---,ValueCm,UncertaintyCm,Confidence,Method,Status");
  });
});

describe("composition, appearance, shoes, Unreal axes, zip", () => {
  it("BMI and U.S. Navy body fat (known value)", () => {
    expect(navyBodyFat("male", 178, 38, 85)!).toBeCloseTo(16.44, 1);
    const c = computeComposition({ weightKg: 80, heightMm: 1800, sex: "male", neckMm: 380, waistMm: 850 });
    expect(c.bmi!.value).toBeCloseTo(80 / 3.24, 3);
    expect(c.bodyFatPct!.method).toBe("estimated");
    expect(c.ffmiNormalized!.value).toBeGreaterThan(10);
  });
  it("mannequin volume is in the human range", () => {
    const v = meshVolumeL(buildMannequin(snap(1, 0, 0, "precision").passport));
    expect(v).toBeGreaterThan(45);
    expect(v).toBeLessThan(120);
  });
  it("sRGB → CIELAB, ITA, Monk, white balance", () => {
    const red = srgbToLab([255, 0, 0]);
    expect(red[0]).toBeCloseTo(53.24, 1);
    expect(red[1]).toBeCloseTo(80.09, 0);
    expect(red[2]).toBeCloseTo(67.2, 0);
    expect(srgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 1);
    expect(nearestMonk(srgbToLab(fromHex(MONK[6]))).index).toBe(7);
    expect(ita([60, 10, 10])).toBeCloseTo(45, 0);
    // a blue colour cast on both skin and paper is removed by the paper reference
    const cast = (v: [number, number, number]) => [v[0] * 0.7, v[1] * 0.85, v[2] * 1.2] as [number, number, number];
    const skinLin: [number, number, number] = [0.35, 0.22, 0.15];
    const t = skinToneFrom(cast(skinLin), cast([0.85, 0.85, 0.85]), "photo", "inner forearm", "2026-01-01");
    expect(t.linear[0]).toBeCloseTo(0.35, 3);
    expect(t.whiteBalanced).toBe(true);
  });
  it("shoe size ⇄ foot length round trip", () => {
    expect(footLengthFromSize("EU", 42)).toBeCloseTo(265, 0);
    expect(sizeFromFootLength("EU", footLengthFromSize("EU", 42))).toBe(42);
    expect(sizeFromFootLength("UK", 265)).toBe(8);
  });
  it("Unreal axes: X forward, Y right, Z up, cm", () => {
    expect(bodyToUe({ x: 0.1, y: 1, z: 0.2 })).toEqual({ X: 20, Y: 10, Z: 100 });
  });
  it("zip writer (CRC32 check value)", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const z = zipStore([{ name: "a.txt", data: new TextEncoder().encode("hi") }]);
    expect(new DataView(z.buffer).getUint32(0, true)).toBe(0x04034b50);
  });
});
