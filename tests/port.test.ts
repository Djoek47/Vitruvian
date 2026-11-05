// Faberland Port: avatar package build / seal / verify, MetaHuman base body, skeleton, history.
import { describe, expect, it } from "vitest";
import { runSession, passportFrom } from "./synthetic";
import { buildAvatarPackage, buildHistoryPackage, canonicalJson, metahumanBaseBody, sealPackage, skeletonSegments, verifyPackage } from "../src/port";

const passport = (profile: "simple" | "intermediate" | "ultra" = "intermediate", extra = {}) => passportFrom(runSession(profile), "2026-11-05T09:00:00.000Z", extra);

describe("Faberland Port", () => {
  it("builds a package with passport, MetaHuman, Unreal and quick sections", () => {
    const p = passport("intermediate", { subject: { weightKg: 78, sex: "male" } });
    const pkg = buildAvatarPackage({ ...p, composition: { bmi: { value: 24.6, unit: "kg/m²", uncertainty: 0.5, method: "derived", procedure: "" }, notes: [] } });
    expect(pkg.format).toBe("faberland.avatar-package");
    expect(pkg.profileId).toBe(p.profileId);
    expect(pkg.quick.height).toBeCloseTo(178, 0);
    expect(pkg.unreal.Units).toBe("cm");
    expect(pkg.metahuman.targets.find((t) => t.target === "stature")!.valueCm).toBeCloseTo(178, 0);
    expect(pkg.metahuman.baseBody.preset).toBe("m_med_nrw");
    expect(pkg.metahuman.skeleton.find((s) => s.from === "upperarm_r")!.lengthCm).toBeCloseTo(33, 0);
    expect(pkg.simulated).toBe(true);
  });
  it("seals with SHA-256 and detects tampering", async () => {
    const sealed = await sealPackage(buildAvatarPackage(passport()));
    expect((await verifyPackage(sealed)).integrity).toBe("valid");
    expect((await verifyPackage(sealed)).ok).toBe(true);
    const tampered = JSON.parse(JSON.stringify(sealed));
    tampered.quick.height = 190;
    const chk = await verifyPackage(tampered);
    expect(chk.integrity).toBe("invalid");
    expect(chk.ok).toBe(false);
    expect((await verifyPackage({ format: "nope" })).ok).toBe(false);
  });
  it("canonical JSON is key-order independent", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(canonicalJson({ a: [2, { c: 4, d: 3 }], b: 1 }));
  });
  it("MetaHuman base body bands", () => {
    expect(metahumanBaseBody(190, "male", 22).preset).toBe("m_tal_nrw");
    expect(metahumanBaseBody(155, "female", 31).preset).toBe("f_srt_ovw");
    expect(metahumanBaseBody(170, undefined, 22).preset).toBeNull();
    expect(metahumanBaseBody(170, "female", undefined).weight).toBeNull();
  });
  it("skeleton segments use UE5 / MetaHuman bone names", () => {
    const seg = skeletonSegments(passport("ultra"));
    const names = seg.map((s) => s.from);
    for (const b of ["upperarm_l", "upperarm_r", "lowerarm_r", "thigh_r", "calf_r"]) expect(names).toContain(b);
    expect(seg.find((s) => s.from === "thigh_r")!.lengthCm).toBeCloseTo(32, 0); // inseam 82 − knee 50
  });
  it("history package carries every snapshot", () => {
    const h = buildHistoryPackage([{ snapshotId: 1, passport: passport("simple") }, { snapshotId: 2, passport: passport("intermediate") }]);
    expect(h.snapshots.length).toBe(2);
    expect(h.format).toBe("faberland.body-history");
  });
});
