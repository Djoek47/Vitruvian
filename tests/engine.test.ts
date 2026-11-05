import { describe, expect, it } from "vitest";
import { bodyFrameFromHead, distance, rotate, toBody, v3, type Quat } from "../src/core/math";
import { convert, formatMm } from "../src/core/units";
import { Stabilizer } from "../src/measurement/stabilizer";
import { solveTipOffset, type TipSample } from "../src/measurement/tip";
import { circumferenceFromBreadthDepth, fitShapeExponent, ramanujanEllipse, superellipsePerimeter } from "../src/body/circumference";
import { CaptureSession } from "../src/measurement/session";
import { MEASUREMENTS, PROFILE_PRIMARY } from "../src/measurement/registry";
import { bodyPointsFor, POINT_CAP } from "../src/measurement/procedures";
import { buildPassport, parsePassport, passportToCsv, validatePassport } from "../src/passport/passport";
import { mdMannequinObj, mdSheetRows, mdWorksheet } from "../src/bridge/marvelous";
import { buildMannequin, ringPerimeterAt } from "../src/body/mannequin";
import { evaluateTshirt, recommendSize, EXAMPLE_TSHIRT_CHART } from "../src/fit/tshirt";
import { errorStats } from "../src/validation/stats";
import { SyntheticBody, frameFor, runSession } from "./synthetic";

const yaw = (deg: number): Quat => {
  const h = (deg * Math.PI) / 360;
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) };
};

describe("geometry", () => {
  it("euclidean distance", () => {
    expect(distance(v3(0, 0, 0), v3(3, 4, 12))).toBeCloseTo(13, 9);
  });
  it("quaternion rotation", () => {
    const r = rotate(yaw(90), v3(0, 0, -1)); // turn left 90° → forward becomes -X
    expect(r.x).toBeCloseTo(-1, 9);
    expect(r.z).toBeCloseTo(0, 9);
  });
  it("body frame from head yaw", () => {
    const f = bodyFrameFromHead(v3(1, 1.7, 2), yaw(90), 0.01);
    expect(f.forward.x).toBeCloseTo(-1);
    expect(f.lateral.z).toBeCloseTo(-1); // user's right when facing -X is -Z
    const p = toBody(f, v3(1, 1.01, 1)); // 1 m to the right of the user
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(1);
    expect(p.z).toBeCloseTo(0);
  });
  it("unit conversion + formatting", () => {
    expect(convert(254, "mm", "in")).toBeCloseTo(10);
    expect(convert(1.5, "m", "cm")).toBeCloseTo(150);
    expect(formatMm(1234.56, "cm")).toBe("123.5 cm");
    expect(formatMm(1234.56, "mm")).toBe("1235 mm");
  });
});

describe("stabilizer", () => {
  it("requires full window, steady points and tracking", () => {
    const s = new Stabilizer(2, { windowMs: 500, maxSpreadM: 0.002, minSamples: 10 });
    for (let i = 0; i < 5; i++) s.push(i * 14, [v3(0, 1, 0), v3(0.3, 1, 0)]);
    expect(s.report().reason).toBe("filling");
    for (let i = 5; i < 40; i++) s.push(i * 14, [v3(0.0005 * Math.sin(i), 1, 0), v3(0.3, 1, 0)]);
    const r = s.report();
    expect(r.stable).toBe(true);
    expect(distance(r.median[0]!, r.median[1]!)).toBeCloseTo(0.3, 3);
    s.push(41 * 14, [null, v3(0.3, 1, 0)]);
    expect(s.report().reason).toBe("tracking-lost");
  });
  it("rejects motion", () => {
    const s = new Stabilizer(1, { windowMs: 500, maxSpreadM: 0.002, minSamples: 10 });
    for (let i = 0; i < 40; i++) s.push(i * 14, [v3(i * 0.002, 1, 0)]);
    expect(s.report().reason).toBe("moving");
  });
  it("median rejects a tracking spike", () => {
    const s = new Stabilizer(1, { windowMs: 1000, maxSpreadM: 0.05, minSamples: 5 });
    for (let i = 0; i < 30; i++) s.push(i * 10, [i === 15 ? v3(0.5, 1, 0) : v3(0, 1, 0)]);
    expect(s.report().median[0]!.x).toBe(0);
  });
});

describe("tip calibration", () => {
  it("recovers the tip offset from touching tips at varied angles", () => {
    const d = 0.045;
    const meet = v3(0.1, 1.2, -0.4);
    const dirs = [
      [v3(1, 0, 0), v3(-1, 0, 0)],
      [v3(0, 0, -1), v3(0.7071, 0, 0.7071)],
      [v3(0, 1, 0), v3(0, -0.6, -0.8)],
      [v3(0.6, 0, -0.8), v3(-0.6, 0.8, 0)],
    ];
    const samples: TipSample[] = dirs.map(([l, r]) => ({
      leftDir: l, rightDir: r,
      leftOrigin: v3(meet.x - d * l.x, meet.y - d * l.y, meet.z - d * l.z),
      rightOrigin: v3(meet.x - d * r.x, meet.y - d * r.y, meet.z - d * r.z),
    }));
    const sol = solveTipOffset(samples)!;
    expect(sol.offsetM).toBeCloseTo(d, 6);
    expect(sol.residualRmsM).toBeLessThan(1e-9);
  });
  it("refuses when orientations do not vary", () => {
    const s: TipSample = { leftDir: v3(1, 0, 0), rightDir: v3(1, 0, 0), leftOrigin: v3(0, 0, 0), rightOrigin: v3(0, 0, 0) };
    expect(solveTipOffset([s, s, s])).toBeNull();
  });
});

describe("circumference model", () => {
  it("superellipse n=2 equals the ellipse (Ramanujan)", () => {
    expect(superellipsePerimeter(320, 240, 2, 4000)).toBeCloseTo(ramanujanEllipse(320, 240), 0);
    expect(superellipsePerimeter(200, 200, 2, 4000)).toBeCloseTo(Math.PI * 200, 0);
  });
  it("perimeter grows monotonically toward the rectangle", () => {
    const p2 = superellipsePerimeter(320, 240, 2);
    const p3 = superellipsePerimeter(320, 240, 3);
    const p20 = superellipsePerimeter(320, 240, 20);
    expect(p3).toBeGreaterThan(p2);
    expect(p20).toBeGreaterThan(p3);
    expect(p20).toBeLessThan(2 * (320 + 240));
  });
  it("propagates uncertainty", () => {
    const a = circumferenceFromBreadthDepth(320, 240, 5, 5, 2.4, 0);
    const b = circumferenceFromBreadthDepth(320, 240, 10, 10, 2.4, 0);
    expect(b.uncertaintyMm).toBeCloseTo(a.uncertaintyMm * 2, 1);
  });
  it("fits the shape exponent from tape data", () => {
    const rows = [[300, 220], [340, 250], [280, 210]].map(([b, d]) => ({ breadthMm: b, depthMm: d, tapeMm: superellipsePerimeter(b, d, 2.7) }));
    const fit = fitShapeExponent(rows);
    expect(fit.exponent).toBeCloseTo(2.7, 2);
    expect(fit.rmseMm).toBeLessThan(0.5);
  });
});

describe("full guided capture on a synthetic body", () => {
  const body = new SyntheticBody();
  const run = (profile: "simple" | "intermediate" | "ultra") => runSession(profile, body);

  it("simple mode: 10 body points, every primary measurement, girths honestly ESTIMATED", () => {
    const s = run("simple");
    expect(s.calibration.tipCalibrated).toBe(true);
    expect(s.calibration.tipOffsetM).toBeCloseTo(body.tipOffset, 3);
    for (const id of PROFILE_PRIMARY.simple) expect(s.measurements[id], id).toBeDefined();
    expect(s.measurements.height.value).toBeCloseTo(body.height * 1000, 0);
    expect(s.measurements.shoulder_width.value).toBeCloseTo(body.shoulder * 1000, 0);
    expect(s.measurements.chest_width.value).toBeCloseTo(body.chestB * 1000, 0);
    expect(s.measurements.chest_depth).toBeUndefined(); // Simple has no depth points
    expect(s.measurements.arm_length.value).toBeCloseTo(body.arm * 1000, 0);
    expect(s.measurements.arm_length.method).toBe("derived"); // crossed-arm acromion → wrist
    expect(s.measurements.height.method).toBe("direct");
    expect(s.measurements.chest_circumference.method).toBe("estimated");
    expect(bodyPointsFor("simple")).toBe(10);
    expect(s.measurements.chest_circumference.value).toBeCloseTo(superellipsePerimeter(body.chestB * 1000, body.chestD * 1000, 2.4), -1);
    for (const m of Object.values(s.measurements)) expect(m.status, m.id + " " + (m.conflicts ?? []).join()).not.toBe("conflicted");
  });

  it("intermediate mode: ≈50 points, girths derived from measured breadth × depth", () => {
    const s = run("intermediate");
    expect(s.measurements.inseam.value).toBeCloseTo(body.inseam * 1000, 0);
    expect(s.measurements.foot_length.value).toBeCloseTo(265, 0);
    expect(s.measurements.thigh_width.value).toBeCloseTo(160, 0);
    expect(s.measurements.thigh_depth.value).toBeCloseTo(170, 0);
    expect(s.measurements.calf_circumference.method).toBe("derived");
    expect(s.measurements.upper_arm_length.value).toBeCloseTo(330, 0);
    expect(s.measurements.forearm_length.value).toBeCloseTo(250, 0);
    expect(s.measurements.eye_height).toBeDefined();
    expect(s.measurements.upper_arm_circumference).toBeUndefined(); // tape-only
    expect(s.measurements.chest_circumference.method).toBe("derived");
    expect(s.measurements.across_front.value).toBeCloseTo(310, 0);
    expect(s.measurements.across_back.value).toBeCloseTo(340, 0);
    expect(s.measurements.armhole_depth.value).toBeCloseTo(220, 0);
    expect(s.measurements.shoulder_slope_r.value).toBeCloseTo(40, 0);
    expect(s.measurements.high_hip_circumference.method).toBe("estimated"); // depth only in Ultra
    const pts = bodyPointsFor("intermediate") + 2;
    expect(pts).toBeGreaterThanOrEqual(45);
    expect(pts).toBeLessThanOrEqual(55);
    expect(s.measurements.neck_circumference).toBeDefined();
    expect(s.measurements.arm_span.method).toBe("derived");
    expect(Object.keys(s.measurements).length).toBeGreaterThanOrEqual(20);
  });

  it("ultra mode: tailor's set, symmetry, capped points", () => {
    const s = run("ultra");
    expect(s.measurements.apex_to_apex.value).toBeCloseTo(190, 0);
    expect(s.measurements.underbust_circumference.method).toBe("derived");
    expect(s.measurements.high_hip_circumference.method).toBe("derived");
    expect(s.measurements.arm_length_left.value).toBeCloseTo(580, 0);
    expect(s.measurements.knee_circumference.method).toBe("derived");
    expect(s.measurements.neck_base_circumference.method).toBe("derived");
    for (const m of Object.values(s.measurements)) expect(m.status, m.id + " " + (m.conflicts ?? []).join()).not.toBe("conflicted");
    expect(s.totalSamples()).toBeLessThanOrEqual(POINT_CAP.ultra);
    expect(bodyPointsFor("ultra")).toBeGreaterThan(bodyPointsFor("intermediate"));
  });

  it("manual override wins, and is flagged when it conflicts", () => {
    const s = run("simple");
    s.setManual("height", body.height * 1000 + 3);
    expect(s.measurements.height.method).toBe("manual");
    expect(s.measurements.height.status).not.toBe("conflicted");
    s.setManual("height", body.height * 1000 + 120);
    expect(s.measurements.height.status).toBe("conflicted");
    expect(s.measurements.height.history.length).toBeGreaterThan(0);
  });

  it("capture never commits while moving or untracked", () => {
    const s = new CaptureSession("simple");
    for (let i = 0; i < 200; i++) {
      const f = frameFor(body, s.step!, i * 14, 0);
      f.right!.aim!.position.x += i * 0.003; // drifting (first step = ground, right tip)
      s.update(f, true);
    }
    expect(s.phase).not.toBe("review");
    const s2 = new CaptureSession("simple");
    for (let i = 0; i < 200; i++) {
      const f = frameFor(body, s2.step!, i * 14, 0);
      f.right!.aim!.tracked = false;
      s2.update(f, true);
    }
    expect(s2.phase).not.toBe("review");
    expect(s2.lastReport?.reason).toBe("tracking-lost");
  });

  it("passport round-trips, validates, exports CSV / MD sheet / OBJ", () => {
    const s = run("intermediate");
    const p = buildPassport({ displayName: "Synthetic", profile: "intermediate", device: "test", simulated: true, calibration: s.calibration, measurements: s.measurements, landmarks: s.landmarks, captures: s.captures, consentTimestamp: "2026-01-01T00:00:00Z", now: "2026-01-01T00:00:00Z" });
    expect(validatePassport(p).ok).toBe(true);
    const back = parsePassport(JSON.stringify(p));
    expect(back.measurements.length).toBe(p.measurements.length);
    expect(() => parsePassport(JSON.stringify({ ...p, units: "cm" }))).toThrow();
    const csv = passportToCsv(p);
    expect(csv.split("\n")[0]).toContain("value_mm");
    expect(csv).toContain("chest_circumference");
    const rows = mdSheetRows(p);
    expect(rows.find((r) => r.faberlandId === "height")!.valueCm).toBeCloseTo(body.height * 100, 0);
    expect(mdWorksheet(p)).toContain("SIMULATED DATA");
    const obj = mdMannequinObj(p);
    expect(obj.startsWith("# Faberland")).toBe(true);
    // Mannequin girths equal the passport circumferences.
    const mesh = buildMannequin(p);
    const chestY = ((s.landmarks.chest_side_l.body.y + s.landmarks.chest_side_r.body.y) / 2) * 1000;
    expect(ringPerimeterAt(mesh, chestY)).toBeCloseTo(s.measurements.chest_circumference.value, -1);
    const maxY = Math.max(...mesh.vertices.map((v) => v[1]));
    expect(maxY).toBeCloseTo(body.height * 1000, -1);
  });

  it("t-shirt fit separates body, garment and ease", () => {
    const s = run("simple");
    const p = buildPassport({ displayName: "x", profile: "simple", device: "t", simulated: true, calibration: s.calibration, measurements: s.measurements, landmarks: s.landmarks, captures: s.captures, consentTimestamp: "x" });
    const chest = s.measurements.chest_circumference.value;
    const r = evaluateTshirt(p, { name: "t", size: "M", chestMm: chest + 90, shoulderMm: s.measurements.shoulder_width.value + 20, bodyLengthMm: 720, sleeveLengthMm: 210 });
    const c = r.lines.find((l) => l.area === "Chest")!;
    expect(c.easeMm).toBeCloseTo(90, 5);
    expect(c.verdict).toBe("good");
    const tight = evaluateTshirt(p, { name: "t", size: "XS", chestMm: chest - 50, shoulderMm: 400, bodyLengthMm: 700, sleeveLengthMm: 200 });
    expect(tight.lines.find((l) => l.area === "Chest")!.verdict).toBe("too-tight");
    expect(recommendSize(p, EXAMPLE_TSHIRT_CHART).length).toBe(4);
  });
});

describe("step order and calibration", () => {
  it("ground first, then head, then instrument; earlier tip points are re-projected after calibration", () => {
    const s = runSession("simple");
    expect(s.steps.slice(0, 3).map((x) => x.id)).toEqual(["cal_floor", "cal_stance", "cal_tip"]);
    const body = new SyntheticBody();
    // floor was captured with an uncalibrated tip (offset 0) — after calibration it must sit on the true floor
    expect(s.calibration.floorY!).toBeCloseTo(body.floorY, 4);
    expect(s.landmarks.head_device).toBeDefined();
  });
  it("more samples = more established: averaging repeated placements shrinks uncertainty", () => {
    const body = new SyntheticBody();
    let now = 0;
    const s = new CaptureSession("simple", () => new Date(1767225600000 + now).toISOString());
    const capture = () => {
      for (let i = 0; i < 200 && s.phase !== "review"; i++) {
        now += 14;
        s.update(frameFor(body, s.step!, now, s.step!.kind === "tip-calibration" ? s.tipSamples.length : 0), true);
      }
    };
    while (s.step!.id !== "acromions") {
      capture();
      s.accept();
    }
    capture();
    s.accept();
    const u1 = s.measurements.shoulder_width.uncertaintyMm;
    s.goTo(s.steps.findIndex((x) => x.id === "acromions"));
    capture();
    s.acceptAndRefine(); // stays, marks refining
    capture();
    s.acceptAndRefine();
    capture();
    s.accept();
    expect(s.landmarks.acromion_l.samples).toBe(3);
    expect(s.measurements.shoulder_width.uncertaintyMm).toBeLessThan(u1);
    expect(s.measurements.shoulder_width.value).toBeCloseTo(400, 0);
  });
});

describe("validation stats", () => {
  it("MAE / RMSE / bias", () => {
    const s = errorStats([{ vrMm: 101, refMm: 100 }, { vrMm: 99, refMm: 100 }, { vrMm: 103, refMm: 100 }]);
    expect(s.meanErrorMm).toBeCloseTo(1);
    expect(s.maeMm).toBeCloseTo(5 / 3);
    expect(s.rmseMm).toBeCloseTo(Math.sqrt(11 / 3));
    expect(s.ci95Mm).not.toBeNull();
  });
});

describe("registry integrity", () => {
  it("unique ids, sane tolerances", () => {
    const ids = MEASUREMENTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MEASUREMENTS) expect(m.plausibleMm[0]).toBeLessThan(m.plausibleMm[1]);
  });
});
