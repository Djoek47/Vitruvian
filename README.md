# Faberland Vitruvian

**VR body-measurement instrument and the Body Passport foundation for Faberland's personalised digital and physical fashion.**

Your two Meta Quest controllers become a measuring instrument. You touch anatomical landmarks with the controller tips, the engine turns those tracked points into body measurements (each one labelled *measured*, *derived*, *estimated* or *manual*, with an uncertainty), and the result becomes a persistent, versioned **Body Passport**. That passport feeds the avatar (MetaHuman), Marvelous Designer garment simulation and the Faberland store.

```
Quest controllers ─▶ tracking adapter ─▶ measurement engine ─▶ Body Passport (JSON v1.0)
                                                                   ├─▶ Marvelous Designer bridge (sheet + mannequin OBJ)
                                                                   ├─▶ MetaHuman targets (Unreal)
                                                                   ├─▶ T-shirt fit engine (body · garment · ease)
                                                                   └─▶ Faberland host app (postMessage / UE binding / deep link)
```

## Run it on your Quest (no PC, no APK needed)

1. Put on the headset, open **Meta Quest Browser**.
2. Go to **https://djoek47.github.io/Vitruvian/** (after enabling GitHub Pages once, see *Deploy*) or your PC's dev server (below).
3. Tick consent → **Enter Mixed Reality** (recommended: you see your body) or **Enter VR**.
4. First time: boot sequence → 4-page tutorial (how it works, how to hold the controllers, buttons, your space).
5. Home → **Measurement Studio** (ruler test) → choose a mode:
   * **Simple**: 10 body points, ~3 min. Height, shoulders, chest/waist/hip breadth and arm; girths are *estimated*.
   * **Intermediate**: ≈ 50 points, ~12 min. Every girth measured (breadth × depth), plus the tailor's essentials: neck-shoulder point, across front/back, armhole depth, high hip, legs, feet.
   * **Ultra**: ≈ 67 points plus repeat samples, **capped at 120**. Adds bust points, underbust, high-hip and neck-base girths, knee girth and left/right symmetry.

   Full list: [`docs/MEASUREMENT_MODES.md`](docs/MEASUREMENT_MODES.md), generated from the code. Order: **Ground → Head → Instrument** calibration, then head & neck → shoulders & arms → torso → legs & feet. Every step tells you how to stand, how to hold the controllers and why it matters. The beam shows the live distance and its **X / Y / Z** components.
6. After a capture: **A** accept · **X** add another sample (averaged: more points = more established) · **B** retake. A hint card with the Figma Touch Plus artwork floats above each controller and lights the button to press.
7. **About you** (weight → BMI and composition estimates, shoe size), **Settings** (units, hold time, stability, twin style, panel distance, haptics, XYZ), **Step map** (jump to any step).
8. Exit (confirmation) → the page shows tabs: **Body Passport** (exports), **Body Evolution**, **Wardrobe**, **Check-in**, **Validation**.
9. Optional: Browser menu → *Install app* puts Vitruvian in your Quest library (PWA).

## Deploy (one-time)
Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**. Every push to `main` then runs the tests and publishes to `https://djoek47.github.io/Vitruvian/`.

### Controls

| Input | Action |
|---|---|
| Trigger (pointing at panel) | Select |
| **Hold A / X** (or trigger off-panel) | Capture — only commits after ~0.9 s of *stable* tracking |
| A / X after capture | Accept |
| B / Y | Retake / back |
| Thumbstick click | Recenter panels in front of you |

## Develop

```bash
npm install
```

```bash
npm run dev        # https://<your-pc-ip>:5173 — open on the Quest (accept the self-signed cert once)
```

```bash
npm test           # 47 unit tests (engine + Body Intelligence)
```

```bash
npm run build && npm run e2e   # full flow on an EMULATED Quest 3 (Meta IWER) + screenshots in e2e/out/
```

Desktop preview with an emulated headset: `http://localhost:5173/?emulate=quest3` (everything produced is flagged **simulated**).

## Repository map

| Path | What |
|---|---|
| `src/core` | Vector math, units (no dependencies — portable to Unreal C++) |
| `src/tracking` | Tracking abstraction + WebXR/OpenXR adapter |
| `src/measurement` | Stabiliser, tip calibration, landmark procedures, registry, engine, capture session |
| `src/anatomy` | Landmark catalogue |
| `src/body` | Circumference model, parametric measurement mannequin |
| `src/passport` | Body Passport build / validate / CSV / encrypted local store with history |
| `src/bridge` | Marvelous Designer + MetaHuman adapters |
| `src/fit` | T-shirt fit engine (body, garment and ease kept separate) |
| `src/integration` | Faberland host contract (extension mode) |
| `src/intelligence` | Body Intelligence: history and change detection, wardrobe fit engine, interpolation, zip |
| `src/evolution` | Body Evolution dashboard, Transformation Studio, wardrobe and check-in pages, 3D viewer |
| `src/appearance`, `src/body/composition.ts`, `src/body/shoe.ts` | Skin tone, body-composition estimates, shoe sizes |
| `unreal/VitruvianPassport` | Unreal Engine plugin: Body Passport USTRUCTs + Blueprint loader |
| `src/app`, `src/scene`, `src/ui` | VR presentation: panels, Vitruvian hologram, measurement beam |
| `schemas/` | Body Passport JSON Schema |
| `design/figma-make/` | The original Figma Make project, recovered intact (source of truth for visuals) |
| `docs/` | Architecture, MD workflow, MetaHuman, validation protocol, headset checklist, APK |
| `VITRUVIAN_CYCLE_1_ACCEPTANCE_REPORT.md` | Definition-of-done status, evidence-only |
| `VITRUVIAN_BODY_INTELLIGENCE_ACCEPTANCE_REPORT.md` | Body Intelligence acceptance suite status |
