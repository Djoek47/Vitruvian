import type { BodyPassport } from "./passport";

/**
 * Local, user-controlled Body Passport store (IndexedDB).
 *  - Passports are encrypted at rest with AES-GCM 256. The key is generated on
 *    the device as a NON-EXTRACTABLE CryptoKey and kept in IndexedDB, so the
 *    stored blob is unreadable outside this browser profile.
 *  - Every save appends a version (profile history); the latest is "current".
 *  - Nothing leaves the device unless the user exports it.
 *  - deleteAll() removes passports, history, drafts and the key.
 */
const DB = "faberland-vitruvian";
/** v1: keys, versions (immutable passport snapshots), kv. v2 (Body Intelligence): encrypted collections. */
const VER = 2;
export const COLLECTIONS = ["checkins", "wardrobe", "programs", "sequences"] as const;
export type Collection = (typeof COLLECTIONS)[number];

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = (ev) => {
      const db = r.result;
      const old = (ev as IDBVersionChangeEvent).oldVersion;
      // Migrations are additive: existing snapshots are never rewritten.
      if (old < 1) {
        db.createObjectStore("keys");
        const v = db.createObjectStore("versions", { keyPath: "vid", autoIncrement: true });
        v.createIndex("profileId", "profileId");
        db.createObjectStore("kv");
      }
      if (old < 2) for (const c of COLLECTIONS) if (!db.objectStoreNames.contains(c)) db.createObjectStore(c);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((res, rej) => {
        const t = db.transaction(store, mode);
        const q = fn(t.objectStore(store));
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      }),
  );
}

async function key(): Promise<CryptoKey> {
  const k = await tx<CryptoKey | undefined>("keys", "readonly", (s) => s.get("main"));
  if (k) return k;
  const nk = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await tx("keys", "readwrite", (s) => s.put(nk, "main"));
  return nk;
}

async function enc(obj: unknown): Promise<{ iv: Uint8Array; data: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(JSON.stringify(obj)));
  return { iv, data };
}
async function dec<T>(b: { iv: Uint8Array; data: ArrayBuffer }): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.iv as BufferSource }, await key(), b.data);
  return JSON.parse(new TextDecoder().decode(pt));
}

export type VersionMeta = { vid: number; profileId: string; savedAt: string; displayName: string; count: number; simulated: boolean };

export const store = {
  async savePassport(p: BodyPassport): Promise<number> {
    const blob = await enc(p);
    return tx<IDBValidKey>("versions", "readwrite", (s) =>
      s.add({ profileId: p.profileId, savedAt: p.updatedAt, displayName: p.displayName, count: p.measurements.length, simulated: p.hardware.simulated, blob }),
    ) as Promise<number>;
  },
  async listVersions(): Promise<VersionMeta[]> {
    const all = await tx<{ vid: number; profileId: string; savedAt: string; displayName: string; count: number; simulated: boolean }[]>("versions", "readonly", (s) => s.getAll());
    return all.map(({ vid, profileId, savedAt, displayName, count, simulated }) => ({ vid, profileId, savedAt, displayName, count, simulated })).reverse();
  },
  async loadVersion(vid: number): Promise<BodyPassport | null> {
    const r = await tx<{ blob: { iv: Uint8Array; data: ArrayBuffer } } | undefined>("versions", "readonly", (s) => s.get(vid));
    return r ? dec<BodyPassport>(r.blob) : null;
  },
  async latest(): Promise<BodyPassport | null> {
    const v = await this.listVersions();
    return v.length ? this.loadVersion(v[0].vid) : null;
  },
  async deleteVersion(vid: number) {
    await tx("versions", "readwrite", (s) => s.delete(vid));
  },
  /** Draft = in-progress session state (encrypted), so a crash/restart loses nothing. */
  async saveDraft(d: unknown) {
    const b = await enc(d); // encrypt first: IDB transactions can't span an await
    await tx("kv", "readwrite", (s) => s.put(b, "draft"));
  },
  async loadDraft<T>(): Promise<T | null> {
    const r = await tx<{ iv: Uint8Array; data: ArrayBuffer } | undefined>("kv", "readonly", (s) => s.get("draft"));
    return r ? dec<T>(r) : null;
  },
  async clearDraft() {
    await tx("kv", "readwrite", (s) => s.delete("draft"));
  },
  async setKv(k: string, v: unknown) {
    await tx("kv", "readwrite", (s) => s.put(v, k));
  },
  async getKv<T>(k: string): Promise<T | undefined> {
    return tx<T | undefined>("kv", "readonly", (s) => s.get(k));
  },
  // ── encrypted collections (Body Intelligence) ───────────────────────────────
  async put<T extends { id: string }>(c: Collection, rec: T) {
    const b = await enc(rec);
    await tx(c, "readwrite", (s) => s.put(b, rec.id));
  },
  async list<T>(c: Collection): Promise<T[]> {
    const all = await tx<{ iv: Uint8Array; data: ArrayBuffer }[]>(c, "readonly", (s) => s.getAll());
    return Promise.all(all.map((b) => dec<T>(b)));
  },
  async remove(c: Collection, id: string) {
    await tx(c, "readwrite", (s) => s.delete(id));
  },
  /** All immutable snapshots, oldest first (decrypted). */
  async snapshots(): Promise<{ snapshotId: number; passport: BodyPassport }[]> {
    const v = await this.listVersions();
    const out: { snapshotId: number; passport: BodyPassport }[] = [];
    for (const x of [...v].reverse()) {
      const p = await this.loadVersion(x.vid);
      if (p) out.push({ snapshotId: x.vid, passport: p });
    }
    return out;
  },
  async deleteAll() {
    await new Promise<void>((res, rej) => {
      const r = indexedDB.deleteDatabase(DB);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
      r.onblocked = () => res();
    });
  },
};

