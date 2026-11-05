/**
 * FABERLAND PORT (`faberland.avatar-package@1`)
 *
 * The one object that leaves Vitruvian for the rest of Faberland: the metaverse
 * app (Unreal), the website (Vercel) and any future client. It carries the
 * canonical Body Passport plus everything needed to build the person's avatar
 * immediately, like a character creator, without re-measuring:
 *
 *   passport   — canonical Body Passport (schema 1.1), provenance included
 *   metahuman  — MetaHuman targets (cm), suggested base body, skeleton segments, skin tone
 *   unreal     — `ue-passport-1.0` (cm, X forward / Y right / Z up) for the UE plugin
 *   quick      — flat { id: cm } map for simple consumers
 *   integrity  — SHA-256 of the canonical payload (tamper / corruption check)
 *
 * Pure TypeScript, no DOM: the same file runs in the app, a Next.js route, Node or a worker.
 * Built to `/port/vitruvian-port.js` on GitHub Pages for other projects to import.
 */
import type { BodyPassport } from "../passport/passport";
import { validatePassport, migratePassport } from "../passport/passport";
import { metahumanTargets } from "../bridge/metahuman";
import { unrealPassport } from "../bridge/unreal";

export const PACKAGE_FORMAT = "faberland.avatar-package";
export const PACKAGE_VERSION = 1;
export const HISTORY_FORMAT = "faberland.body-history";

export type MetaHumanBaseBody = {
  /** Legacy MetaHuman body naming: `{m|f}_{srt|med|tal}_{unw|nrw|ovw}` (e.g. `m_tal_nrw`). */
  preset: string | null;
  gender: "m" | "f" | null;
  height: "srt" | "med" | "tal";
  weight: "unw" | "nrw" | "ovw" | null;
  note: string;
};

export type SkeletonSegment = { from: string; to: string; lengthCm: number; source: string };

export type AvatarPackage = {
  format: typeof PACKAGE_FORMAT;
  version: typeof PACKAGE_VERSION;
  createdAt: string;
  profileId: string;
  displayName: string;
  passportUpdatedAt: string;
  simulated: boolean;
  passport: BodyPassport;
  metahuman: ReturnType<typeof metahumanTargets> & {
    baseBody: MetaHumanBaseBody;
    skeleton: SkeletonSegment[];
    skin: { hex: string; linear: [number, number, number]; monk: number; whiteBalanced: boolean } | null;
  };
  unreal: ReturnType<typeof unrealPassport>;
  quick: Record<string, number>;
  integrity?: { algorithm: "SHA-256"; digest: string };
};

/**
 * Suggested base body for MetaHuman (before fitting to targets). Height bands are
 * broad adult bands, weight bands are WHO BMI classes. It only picks a starting
 * body; the measured targets do the real fitting.
 */
export function metahumanBaseBody(heightCm: number | undefined, sex: string | undefined, bmi: number | undefined): MetaHumanBaseBody {
  const gender = sex === "male" ? "m" : sex === "female" ? "f" : null;
  const [lo, hi] = gender === "f" ? [160, 172] : gender === "m" ? [172, 185] : [166, 179];
  const h = heightCm ?? (lo + hi) / 2;
  const height = h < lo ? "srt" : h >= hi ? "tal" : "med";
  const weight = bmi === undefined ? null : bmi < 18.5 ? "unw" : bmi < 25 ? "nrw" : "ovw";
  return {
    preset: gender && weight ? `${gender}_${height}_${weight}` : null,
    gender, height, weight,
    note: "Starting body only (MetaHuman legacy body naming). Fit to `targets` afterwards; null parts need sex/weight in About you.",
  };
}

/** Skeleton segment lengths keyed by UE5 / MetaHuman bone names (cm). */
export function skeletonSegments(p: BodyPassport): SkeletonSegment[] {
  const m = Object.fromEntries(p.measurements.filter((x) => x.status !== "conflicted").map((x) => [x.id, x.value / 10]));
  const out: SkeletonSegment[] = [];
  const add = (from: string, to: string, v: number | undefined, source: string) => v && v > 0 && out.push({ from, to, lengthCm: +v.toFixed(1), source });
  for (const side of ["l", "r"] as const) {
    const L = side === "l" && m.upper_arm_length_left ? "_left" : "";
    add(`upperarm_${side}`, `lowerarm_${side}`, m[`upper_arm_length${L}`] ?? m.upper_arm_length, `upper_arm_length${L}`);
    add(`lowerarm_${side}`, `hand_${side}`, m[`forearm_length${L}`] ?? m.forearm_length, `forearm_length${L}`);
    if (m.inseam && m.knee_height) add(`thigh_${side}`, `calf_${side}`, m.inseam - m.knee_height, "inseam − knee_height");
    if (m.knee_height && m.ankle_height) add(`calf_${side}`, `foot_${side}`, m.knee_height - m.ankle_height, "knee_height − ankle_height");
  }
  if (m.shoulder_width) add("upperarm_l", "upperarm_r", Math.max(20, m.shoulder_width - 5), "shoulder_width − 2 × 2.5 cm joint inset");
  if (m.shoulder_height && m.waist_height) add("pelvis", "neck_01", m.shoulder_height - m.waist_height + 4, "shoulder_height − waist_height (+ pelvis offset, approx.)");
  return out;
}

export function buildAvatarPackage(passport: BodyPassport, now = new Date().toISOString()): AvatarPackage {
  const p = migratePassport(passport);
  const mh = metahumanTargets(p);
  const height = p.measurements.find((x) => x.id === "height")?.value;
  const st = p.appearance?.skinTone;
  return {
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    createdAt: now,
    profileId: p.profileId,
    displayName: p.displayName,
    passportUpdatedAt: p.updatedAt,
    simulated: p.hardware.simulated,
    passport: p,
    metahuman: {
      ...mh,
      baseBody: metahumanBaseBody(height ? height / 10 : undefined, p.subject?.sex, p.composition?.bmi?.value),
      skeleton: skeletonSegments(p),
      skin: st ? { hex: st.hex, linear: st.linear, monk: st.monk, whiteBalanced: st.whiteBalanced } : null,
    },
    unreal: unrealPassport(p),
    quick: Object.fromEntries(p.measurements.map((m) => [m.id, +(m.value / 10).toFixed(1)])),
  };
}

/** Deterministic JSON (sorted keys) so the digest is stable across platforms. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canonicalJson(o[k])).join(",") + "}";
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Adds the integrity digest (over everything except `integrity`). */
export async function sealPackage(pkg: AvatarPackage): Promise<AvatarPackage> {
  const { integrity: _ignored, ...body } = pkg;
  void _ignored;
  return { ...body, integrity: { algorithm: "SHA-256", digest: await sha256Hex(canonicalJson(body)) } };
}

export type PackageCheck = { ok: boolean; errors: string[]; integrity: "valid" | "invalid" | "absent" };

/** Validate a package received from anywhere (file, KV, postMessage). */
export async function verifyPackage(input: unknown): Promise<PackageCheck> {
  const e: string[] = [];
  const p = input as AvatarPackage;
  if (!p || typeof p !== "object") return { ok: false, errors: ["not an object"], integrity: "absent" };
  if (p.format !== PACKAGE_FORMAT) e.push(`format must be "${PACKAGE_FORMAT}"`);
  if (p.version !== PACKAGE_VERSION) e.push(`unsupported version ${p.version}`);
  if (typeof p.profileId !== "string" || !p.profileId) e.push("profileId missing");
  const v = validatePassport(p.passport);
  if (!v.ok) e.push(...v.errors.map((x) => "passport: " + x));
  if (p.passport && p.profileId !== p.passport.profileId) e.push("profileId does not match passport");
  let integrity: PackageCheck["integrity"] = "absent";
  if (p.integrity) {
    const { integrity: claimed, ...body } = p;
    integrity = claimed.digest === (await sha256Hex(canonicalJson(body))) ? "valid" : "invalid";
    if (integrity === "invalid") e.push("integrity digest mismatch (modified or corrupted)");
  }
  return { ok: e.length === 0, errors: e, integrity };
}

/** Full longitudinal history for the metaverse (body evolution, avatar over time). */
export function buildHistoryPackage(snapshots: { snapshotId: number | string; passport: BodyPassport }[], now = new Date().toISOString()) {
  return {
    format: HISTORY_FORMAT,
    version: 1,
    createdAt: now,
    profileId: snapshots.at(-1)?.passport.profileId ?? null,
    snapshots: snapshots.map((s) => ({ snapshotId: s.snapshotId, takenAt: s.passport.updatedAt, simulated: s.passport.hardware.simulated, quick: Object.fromEntries(s.passport.measurements.map((m) => [m.id, +(m.value / 10).toFixed(1)])), passport: migratePassport(s.passport) })),
  };
}

// ── transport: Supabase (integrations/supabase) ──────────────────────────────
/**
 * Supabase connection. `url` = https://<project-ref>.supabase.co, `anonKey` = the project's
 * public (anon / publishable) key. `accessToken` = a signed-in Faberland user's JWT — when
 * present, the package is stored as owned by that user (no expiry, readable via RLS).
 */
export type PortConfig = { url: string; anonKey: string; accessToken?: string };
export type PortReceipt = { code: string; profileId: string; expiresAt: string | null; deleteToken: string | null; owned: boolean };

const fnUrl = (c: PortConfig) => c.url.replace(/\/$/, "") + "/functions/v1/vitruvian-port";
const authHeaders = (c: PortConfig) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken ?? c.anonKey}` });

/** Headset → Faberland: upload the sealed package; returns a claim code (anonymous) or an owned record. */
export async function sendToFaberland(pkg: AvatarPackage, c: PortConfig): Promise<PortReceipt> {
  const r = await fetch(fnUrl(c) + "/packages", { method: "POST", headers: { ...authHeaders(c), "content-type": "application/json" }, body: JSON.stringify({ package: pkg }) });
  if (!r.ok) throw new Error(`Faberland port: ${r.status} ${await r.text().catch(() => "")}`);
  return r.json();
}

/** Metaverse / website: load a package by claim code, verified (structure + integrity). */
export async function fetchByCode(code: string, c: PortConfig): Promise<AvatarPackage> {
  const r = await fetch(fnUrl(c) + "/packages/" + encodeURIComponent(code.trim().toUpperCase()), { headers: authHeaders(c) });
  if (!r.ok) throw new Error(`Faberland port: ${r.status}`);
  return verified(await r.json());
}

/** Metaverse / website: the signed-in user's latest avatar (RLS: only their own rows). */
export async function fetchMyLatest(c: PortConfig & { accessToken: string }): Promise<AvatarPackage | null> {
  const r = await fetch(c.url.replace(/\/$/, "") + "/rest/v1/vitruvian_latest_avatar?select=package&limit=1", { headers: authHeaders(c) });
  if (!r.ok) throw new Error(`Faberland port: ${r.status}`);
  const rows = (await r.json()) as { package: AvatarPackage }[];
  return rows.length ? verified(rows[0].package) : null;
}

export async function deleteByCode(code: string, deleteToken: string, c: PortConfig): Promise<boolean> {
  const r = await fetch(fnUrl(c) + "/packages/" + encodeURIComponent(code), { method: "DELETE", headers: { ...authHeaders(c), "x-delete-token": deleteToken } });
  return r.ok || r.status === 404;
}

async function verified(pkg: AvatarPackage): Promise<AvatarPackage> {
  const chk = await verifyPackage(pkg);
  if (!chk.ok) throw new Error("Invalid avatar package: " + chk.errors.join("; "));
  return pkg;
}
