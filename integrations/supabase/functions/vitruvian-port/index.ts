// Supabase Edge Function `vitruvian-port` — the Faberland Port endpoint.
//   POST   /vitruvian-port/packages          { package, }            → 201 { code, profileId, expiresAt, deleteToken, owned }
//   GET    /vitruvian-port/packages/:code                            → the AvatarPackage (what Unreal loads)
//   DELETE /vitruvian-port/packages/:code    header x-delete-token  → removes an anonymous upload
// If the caller sends a signed-in user's JWT, the package is stored as OWNED (no expiry),
// otherwise as an anonymous claim code valid for 30 days.
import { createClient } from "npm:@supabase/supabase-js@2"

const ALLOWED = (Deno.env.get("VITRUVIAN_ALLOWED_ORIGINS") ?? "https://djoek47.github.io,http://localhost:5173,https://localhost:5173").split(",").map((s) => s.trim())
const TTL_DAYS = 30
const MAX_BYTES = 1_000_000
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,x-delete-token",
    Vary: "Origin",
  }
}
const json = (body: unknown, status: number, h: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { ...h, "content-type": "application/json", "cache-control": "no-store" } })
const code8 = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => CROCKFORD[b % 32]).join("")
const token = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("")
async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("")
}
function check(p: any): string | null {
  if (!p || p.format !== "faberland.avatar-package" || p.version !== 1) return "not a faberland.avatar-package@1"
  if (typeof p.profileId !== "string" || p.passport?.profileId !== p.profileId) return "profileId missing or mismatched"
  if (!Array.isArray(p.passport?.measurements)) return "passport.measurements missing"
  return null
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"))
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h })
  const m = new URL(req.url).pathname.match(/\/packages(?:\/([0-9A-Za-z]{6,12}))?\/?$/)
  if (!m) return json({ error: "Not found" }, 404, h)
  const code = m[1]?.toUpperCase()
  try {
    if (req.method === "POST" && !code) {
      const text = await req.text()
      if (text.length > MAX_BYTES) return json({ error: "Package too large" }, 413, h)
      const pkg = JSON.parse(text)?.package
      const problem = check(pkg)
      if (problem) return json({ error: problem }, 400, h)
      // signed-in user? (Authorization: Bearer <user JWT>; the anon key is not a user)
      const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
      const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } }
      const owner = u?.user?.id ?? null
      const deleteToken = owner ? null : token()
      const row = {
        code: code8(), profile_id: pkg.profileId, owner_user_id: owner, package: pkg, digest: pkg.integrity?.digest ?? null,
        simulated: !!pkg.simulated, passport_updated_at: pkg.passportUpdatedAt ?? null,
        expires_at: owner ? null : new Date(Date.now() + TTL_DAYS * 864e5).toISOString(),
        delete_token_hash: deleteToken ? await sha256(deleteToken) : null,
      }
      const { error } = await admin.from("vitruvian_avatar_packages").insert(row)
      if (error) throw error
      return json({ code: row.code, profileId: row.profile_id, expiresAt: row.expires_at, deleteToken, owned: !!owner }, 201, h)
    }
    if (req.method === "GET" && code) {
      const { data, error } = await admin.from("vitruvian_avatar_packages").select("package, expires_at").eq("code", code).maybeSingle()
      if (error) throw error
      if (!data || (data.expires_at && new Date(data.expires_at) < new Date())) return json({ error: "Unknown or expired code" }, 404, h)
      return json(data.package, 200, h)
    }
    if (req.method === "DELETE" && code) {
      const { data } = await admin.from("vitruvian_avatar_packages").select("id, delete_token_hash").eq("code", code).maybeSingle()
      if (!data) return json({ error: "Unknown code" }, 404, h)
      if (!data.delete_token_hash || data.delete_token_hash !== (await sha256(req.headers.get("x-delete-token") ?? ""))) return json({ error: "Invalid delete token" }, 403, h)
      await admin.from("vitruvian_avatar_packages").delete().eq("id", data.id)
      return json({ deleted: code }, 200, h)
    }
    return json({ error: "Method not allowed" }, 405, h)
  } catch (e) {
    console.error("vitruvian-port", e)
    return json({ error: "Port error" }, 500, h)
  }
})
