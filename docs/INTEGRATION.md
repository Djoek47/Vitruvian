# Faberland integration: MetaHuman, store, metaverse extension

## Target pipeline
```
Vitruvian (measure once) → Body Passport → MetaHuman (UE) → store garment in pre-made sizes
  → cloth simulation on the person's MetaHuman → fit verdict → recommendation → checkout → production
```

## 1. Vitruvian as an extension of the Faberland metaverse app

Vitruvian already runs standalone. To launch it **from** the Faberland Unreal app:

| Mechanism | How |
|---|---|
| Launch | Open `https://<host>/index.html?host=faberland&profile=quick&return=faberland://vitruvian/passport` in the Quest Browser (Android intent from UE), or embed it in a UE Web Browser widget |
| Return: postMessage | `{ type: "faberland.vitruvian.passport", version: 1, passport }` to `window.parent` / `window.opener` |
| Return: UE JS binding | If the UE widget binds `window.ue.faberland.onpassport(json)`, it is called with the passport JSON |
| Return: deep link | Navigates to `return?profileId=…&updatedAt=…&contract=1`. The app then imports the exported JSON or pulls from the future sync service |
| Pull | Host sends `{ type: "faberland.vitruvian.request" }` and receives the current passport |

The contract lives in `src/integration/faberland.ts` (version 1). The payload is always the canonical Body Passport, so data "compatibilisation" later happens in one place: a passport → Faberland account mapper.

## 2. Unreal Engine plugin
`unreal/VitruvianPassport/` is a runtime plugin with USTRUCTs that match `*-unreal.json` (`ue-passport-1.0`: cm, X forward / Y right / Z up, floor origin) field-for-field, and Blueprint nodes `Load Vitruvian Passport`, `Get Measurement Cm` and `Get Landmark Location`, plus a DataTable row struct for `*-unreal-datatable.csv`. It is written against documented UE APIs but **not compiled here**. Build it in your project.

## 3. MetaHuman

`*-metahuman-targets.json` (`mh-targets-1.0`): ISO 8559-1-style target names in **cm**. Each target carries method, uncertainty and a solver **weight** (conflicted = 0, estimated down-weighted).

UE-side importer (to build in the Faberland project):
1. Read the targets JSON.
2. Map each `target` to the MetaHuman Creator body measurement field for your engine version (the Creator's parametric body accepts measurement constraints. Verify exact field names in your UE 5.x MetaHuman Creator before coding the mapping; this repo does not invent them).
3. Fit the body, then re-measure the resulting MetaHuman mesh (girth at the same heights). Store the residuals back in the passport (`avatar.reference` = MetaHuman asset id).
4. **Traceability rule:** every avatar stores the `profileId` + `updatedAt` of the passport that produced it.

### In-app preview
* **Vitruvian twin**: the person's measured body (exact chest, waist, hip, neck, thigh and calf girths at the measured heights) is shown inside the hologram as gold lines, a hologram or a skin-tone shell (Settings ▸ Your twin).
* **Avatar slot**: load a rigged `.glb` (a MetaHuman body exported from Unreal at a low LOD, or UE5 Manny/Quinn). The skeleton is fitted to the passport: uniform height scale, then upper arm, forearm, thigh, shin and shoulder-joint spacing (UE5/MetaHuman bone names, with Mixamo fallbacks). Girth shaping happens in Unreal from the exported targets. MetaHuman assets come from your Epic account; they are not bundled in this repo.

## 4. Store garments in pre-made sizes
Each product size stores its **garment** measurements (not just S/M/L labels). The fit engine compares body, garment and ease per area and returns per-area verdicts. The cloth simulation on the MetaHuman is the visual confirmation, and the passport numbers are the quantitative one.

## 5. Meta VR Developer Hub MCP & Horizon skills (on your PC)
This cloud session cannot reach your PC or headset. On your Windows PC:
1. Clone this repo, open it in VS Code with Claude Code.
2. Meta VR Developer Hub ▸ Settings ▸ AI Tools ▸ *Add to VS Code* (MCP server).
3. Use the installed skills: `/hz-store-pwa` (package this WebXR app as a Quest APK with `@meta-quest/bubblewrap-cli`), `/hz-vr-debug` (logs, screenshots), `/hz-perfetto-debug` (frame timing), `/hz-immersive-designer` (comfort review).
