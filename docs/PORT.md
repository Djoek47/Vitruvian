# Faberland Port: headset → Supabase → MetaHuman (Unreal)

**For the developer (or Claude) working on the Faberland metaverse.** This is everything you need to receive a person's body from the Vitruvian headset app and build their MetaHuman, like a character creator, without measuring again.

```
Vitruvian (Quest Browser)                  Supabase (Faberland DB)                 Faberland metaverse (Unreal)
─────────────────────────                  ───────────────────────                 ────────────────────────────
measure → Body Passport                    vitruvian_avatar_packages (RLS)         UVitruvianPortLibrary
  → buildAvatarPackage + sealPackage  ──▶  Edge Function `vitruvian-port`   ──▶      FetchAvatarByCode / FetchMyLatestAvatar
     (MetaHuman targets, base body,           claim code (anonymous, 30 days)        → FVitruvianAvatar
      skeleton, skin, Unreal export)          or owned row (signed-in user)          → base body preset + ComputeBoneScales + skin
```

Also available without any server: **Download avatar package (.json)** on the Body Passport tab, then load it in Unreal with `ParseAvatarPackage`. And when Vitruvian is launched from the metaverse, the host gets the package via postMessage / the UE JS binding (`docs/INTEGRATION.md`).

## 1. The data: `faberland.avatar-package@1`
Schema: `https://djoek47.github.io/Vitruvian/schemas/avatar-package.schema.json`

| Field | What it is |
|---|---|
| `passport` | Canonical Body Passport (schema 1.1). Every measurement has method (direct / derived / estimated / manual), uncertainty, status and provenance |
| `metahuman.targets` | `mh-targets-1.0`: stature, chest/waist/hip/neck girth, biacromial breadth, arm length, inside leg, heights… in **cm**, with a solver weight (conflicted = 0) |
| `metahuman.baseBody.preset` | Suggested starting body, legacy MetaHuman naming `{m\|f}_{srt\|med\|tal}_{unw\|nrw\|ovw}` (e.g. `m_tal_nrw`), from height + sex + BMI. `null` if sex or weight is unknown |
| `metahuman.skeleton` | Segment lengths keyed by UE5/MetaHuman bones: `upperarm_*→lowerarm_*`, `lowerarm_*→hand_*`, `thigh_*→calf_*`, `calf_*→foot_*`, shoulder joint spacing, pelvis→neck |
| `metahuman.skin` | Linear-light colour (material-ready), hex, Monk Skin Tone 1–10, white-balanced flag. Optional, separate consent |
| `unreal` | `ue-passport-1.0`: measurements + landmarks in **cm, X forward / Y right / Z up**, floor origin. Loads straight into `FVitruvianPassport` |
| `quick` | `{ measurementId: cm }` for simple consumers (website, store size charts) |
| `integrity` | SHA-256 over the canonical JSON. `verifyPackage()` detects modification or corruption |
| `simulated` | `true` = emulator data; never use for a real avatar or garment |

Full history (body evolution over time): `faberland.body-history@1` (Download full history).

## 2. Supabase setup (one-time)
Files: `integrations/supabase/`.

1. Apply the migration: `vitruvian_avatar_packages` table, RLS policies, `vitruvian_latest_avatar` view and `vitruvian_purge_expired()`.
   ```bash
   supabase db push
   ```
   Or paste `migrations/20261105000000_vitruvian_avatar_packages.sql` into the SQL editor.
2. Deploy the Edge Function:
   ```bash
   supabase functions deploy vitruvian-port
   ```
3. Optionally restrict the origins that may call it:
   ```bash
   supabase secrets set VITRUVIAN_ALLOWED_ORIGINS=https://djoek47.github.io,https://faberland.online
   ```
4. Optionally schedule `select public.vitruvian_purge_expired();` daily with pg_cron.

Security model:
* RLS is on. A signed-in user can only read, insert or delete **their own** rows (`owner_user_id = auth.uid()`). History is append-only: there is no update policy.
* Anonymous headset uploads go only through the Edge Function (service role). They are readable only by their 8-character claim code, expire after 30 days, and can be deleted with the uploader's delete token.
* When Faberland accounts (Supabase Auth) are ready, Vitruvian passes the user's JWT and the package is stored as **owned** (no expiry). The metaverse then loads "my latest avatar" at login, with no code needed.

## 3. Using it from TypeScript (website on Vercel, tools, Node)
```ts
import { fetchByCode, fetchMyLatest, verifyPackage } from "https://djoek47.github.io/Vitruvian/port/vitruvian-port.js"; // or vendor the file
const cfg = { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! };
const pkg = await fetchByCode("7Q4KX2MB", cfg);                                 // anonymous claim code
const mine = await fetchMyLatest({ ...cfg, accessToken: session.access_token }); // signed-in user
pkg.quick.chest_circumference;                                                  // cm
pkg.metahuman.baseBody.preset;                                                  // "m_tal_nrw"
```
Types: `https://djoek47.github.io/Vitruvian/port/types/port/index.d.ts`. With supabase-js directly: `supabase.from("vitruvian_latest_avatar").select("package").single()`.

## 4. Using it in Unreal (MetaHuman)
Plugin: `unreal/VitruvianPassport` (copy it to `Plugins/`; depends on Json, JsonUtilities, HTTP). **Not compiled in this repo's CI. Build it in the Faberland project and report errors.**

Blueprint flow at character creation:
1. **Fetch Avatar By Code** (SupabaseUrl, AnonKey, Code), or **Fetch My Latest Avatar** (SupabaseUrl, AnonKey, UserAccessToken). Both return an `FVitruvianAvatar` via the delegate.
2. Base body: pick the MetaHuman body variant matching `BaseBodyPreset` (e.g. `m_tal_nrw`; MetaHuman body assets use this naming). Fall back to `m_med_nrw` / `f_med_nrw`.
3. Lengths: measure the base body's reference bone lengths once (cm), then call **Compute Bone Scales** (Avatar, ReferenceLengthsCm). Apply the returned per-bone factors with *Transform (Modify) Bone* in the body AnimBP (scale along the bone axis) or `UPoseableMeshComponent::SetBoneScaleByName`. Factors are clamped to 0.8–1.25.
4. Girths: in the editor, MetaHuman Creator (UE 5.6+) fits the parametric body to `Passport.Measurements` (chest, waist, hip girths). At runtime use morph targets or corrective blendshapes driven by girth ÷ base girth. The exact Creator field names depend on the engine version and are not invented here.
5. Skin: if `bHasSkin`, feed `SkinLinear` to the skin material's tint parameter.
6. Store `ProfileId` + `Digest` on the saved character, so every avatar traces back to the passport that made it.

## 5. What is verified
* TypeScript port: unit-tested (build, seal, tamper detection, base-body bands, bone names, history). See `tests/port.test.ts`.
* Supabase SQL + Edge Function: written to Supabase's documented APIs (Deno `Deno.serve`, `npm:@supabase/supabase-js@2`, PostgREST, RLS). **Not deployed or run from here.** Deploy and test against your project.
* Unreal plugin: written to documented UE APIs (`FHttpModule`, `FJsonSerializer`, `FJsonObjectConverter`). **Not compiled here.**
