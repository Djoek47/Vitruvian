# VITRUVIAN: Cycle 1 Acceptance Report

Report date: 2026-11-05 · Build: see the landing page footer · Statuses: NOT STARTED / IN PROGRESS / IMPLEMENTED — NOT VERIFIED / VERIFIED / BLOCKED

**Cycle 1 is NOT complete.** No test below is VERIFIED, because each one requires the physical headset, a real participant or Marvelous Designer, and none of these has been used yet. Software evidence is listed separately and is not physical verification.

## Evidence produced so far (software only)

| Evidence | Location | What it proves | What it does NOT prove |
|---|---|---|---|
| 47 unit tests, all passing (`npm test`) | `tests/engine.test.ts`, `tests/intelligence.test.ts` | Geometry, rotation-invariant body frame, stabiliser rejects motion and tracking loss, tip-offset solver recovers a known offset, circumference model, full Quick/Precision capture on a synthetic body recovers ground truth, manual override + conflict flags, passport round-trip + schema validation, CSV/MD/OBJ exports, mannequin girth = passport girth, T-shirt ease | Anything about real tracking accuracy |
| E2E on **emulated** Quest 3 (Meta IWER), see `evidence/emulator/report.json` for the check list and results (`npm run e2e`) | `evidence/emulator/report.json`, `evidence/emulator/*.png` | Real WebXR code path: consent gate, boot, tutorial, immersive session, live distance + XYZ (300 mm emulated → "30.0 cm"), studio capture, a complete Quick Fit in VR in the ground → head → instrument order, About you / Settings / step map, save, 8 exports, encrypted persistence, Body Evolution / wardrobe / check-in pages | That it runs on *your* headset, or real accuracy. All emulator data is flagged `simulated: true` |
| Sample passport | `evidence/emulator/sample-passport.SIMULATED.json` | Schema shape | Not a real person. Never use for fit |

## Acceptance tests

| # | Requirement | Status | Test procedure | Actual result | Evidence location | Remaining limitations / your action |
|---|---|---|---|---|---|---|
| 01 | Existing design preserved | IMPLEMENTED — NOT VERIFIED | Compare headset/emulator screens with the Figma Make design | Original logos and wordmark used; exact colour tokens, Chakra Petch / Inter, panel chrome, confidence badges, Body Editor and Measurement Studio structure taken from the archive (`docs/DESIGN_INVENTORY.md`); the Figma Touch Plus line-art and hotspot states (`QuestController.tsx`) are rendered verbatim in the tutorial, the floating in-headset hint cards and the Controls page. Emulator screenshots captured | `evidence/emulator/*.png`, `design/figma-make/` | **You** review against Figma. Assistant star, palm menu and HUD are not in scope. In VR the Touch Plus 3D model shows the physical controller; the Figma artwork drives the hint cards |
| 02 | Installs & launches on physical Quest | IMPLEMENTED — NOT VERIFIED | (a) Open hosted URL in Quest Browser → Enter MR; (b) bubblewrap APK → `adb install` | Not yet run on hardware. APK not built: this cloud session has no USB/ADB or Android SDK | `docs/QUEST_APK.md`, `docs/HEADSET_TEST_CHECKLIST.md` §A | **You**: open the URL on the headset. On your PC, run `/hz-store-pwa` (bubblewrap) for the APK, and record `adb devices -l` + install log |
| 03 | Real-time tracking of both controllers | IMPLEMENTED — NOT VERIFIED | Checklist §B | Real poses read from `XRFrame.getPose` (no smoothing); `emulatedPosition` ⇒ untracked; lost/recovered events logged and exportable; "SIMULATOR" banner only with `?emulate=` | `src/tracking/webxr.ts`, tracking-log CSV | **You** run checklist §B on the headset |
| 04 | Real spatial distance vs physical reference | IMPLEMENTED — NOT VERIFIED | `docs/VALIDATION.md` §1, ≥ 15 ruler readings in 3 orientations | Studio live readout (cm/mm), stable capture, reference keypad, MAE/RMSE/bias/SD on the landing page, CSV export | ruler-log CSV (to produce) | **You**: ~10 min with a ruler. No accuracy figure is claimed until then |
| 05 | Capture, review, persist | IMPLEMENTED — NOT VERIFIED | Checklist §D | Capture only after stable hold; review Accept/Retake; Editor adjust/lock/revert/delete/re-measure; metadata (method, timestamp, uncertainty, confidence, sources, procedure, history); AES-GCM IndexedDB with version history; draft checkpoint after every capture. Reload persistence passed in the emulator | `e2e/out/report.json` | Physical restart test on the headset (checklist §D) |
| 06 | Body Passport export | IMPLEMENTED — NOT VERIFIED | Export JSON → re-import → "validated ✓" | v1.0 JSON with ids, mm units, provenance, calibration, body frame, 4 classifications + conflicted status, confidence, uncertainty; JSON Schema; CSV; import with validation. Passes with emulated data | `schemas/body-passport.schema.json`, `e2e/out/*passport*.json` | Must be repeated with a **real** (non-simulated) passport from the headset |
| 07 | Marvelous Designer compatibility | IMPLEMENTED — NOT VERIFIED | `docs/MARVELOUS_DESIGNER.md` Routes A and B on your MD version | Mapping sheet (cm), worksheet, measured mannequin OBJ (mm; girths = passport, unit-tested). Proprietary `.AVS/.AVT/.MEA` deliberately not written (undocumented). Avatar Editor field labels to confirm on your install | exports from the landing page | **You / designer**: import into MD, tape-check on the avatar, fill `validation/md-check.csv`. Compatibility not claimed until then |
| 08 | Real participant + T-shirt fit | NOT STARTED | `docs/VALIDATION.md` §2–4 | — | `validation/*.csv` templates | Needs a participant, consent form, tape measure, a garment, an MD project and a real try-on |

## Known limitations (honest)
* **Circumferences are derived, not measured.** Two points give a straight line. Girths come from measured breadth × depth through an uncalibrated superellipse model (±3 %), until it is fitted on tape-measured participants.
* Arm span includes an estimated palm-to-fingertip offset (2 × 95 mm), so it is labelled derived.
* Accuracy depends on landmark placement by the user (bony landmarks are more repeatable than soft tissue). Uncertainty terms for placement are engineering estimates in `src/anatomy/landmarks.ts`, to be replaced by measured repeatability.
* Tracking noise floor (2 mm) is assumed until Test 04 measures it.
* Three modes: Simple (10 body points; girths ESTIMATED from breadth with a population depth ratio), Intermediate (~48 points; girths derived from measured breadth × depth), Ultra (~67 points + repeats, capped at 120). Straight-line tailor measures (across front/back, shoulder length) read shorter than a tape laid over the body's curve, and are labelled "straight".
* Upper arm, forearm and wrist girths cannot be measured alone with two controllers (the measured arm holds one), so they are tape/manual entries.
* Body-composition values (BMI, US Navy body fat, FFMI, density) are estimates, not medical measurements. Skin tone is estimated (white-balanced only when a white reference is tapped).
* GitHub Pages must be enabled once by the repo owner (Settings ▸ Pages ▸ Source: GitHub Actions).
* The "99 % accuracy" target (≤ 1 % error) is plausible for direct linear measures but **unproven**. Circumference accuracy is unknown until validation.
* The T-shirt size chart in the app is an **example**, clearly labelled. Use real supplier garment specs.

## Budget ledger
No paid services, APIs or subscriptions were used. All work is local, open-source tooling (three.js, Vite, Vitest, Meta IWER emulator). AI usage cost for this session isn't visible from inside the session. Check your Claude usage page.
