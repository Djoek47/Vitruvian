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
2. Go to the hosted URL (GitHub Pages, see *Deploy*), or to your PC's dev server (below).
3. Tick consent → **Enter Mixed Reality** (recommended: you see your body) or **Enter VR**.
4. Run **Measurement Studio** first (ruler test, Test 001), then **Quick Fit**.
5. Exit VR → export the Body Passport and the Marvelous Designer / MetaHuman files.
6. Optional: Browser menu → *Install app* puts Vitruvian in your Quest library (PWA).

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
npm test           # 21 engine unit tests
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
| `src/app`, `src/scene`, `src/ui` | VR presentation: panels, Vitruvian hologram, measurement beam |
| `schemas/` | Body Passport JSON Schema |
| `design/figma-make/` | The original Figma Make project, recovered intact (source of truth for visuals) |
| `docs/` | Architecture, MD workflow, MetaHuman, validation protocol, headset checklist, APK |
| `VITRUVIAN_CYCLE_1_ACCEPTANCE_REPORT.md` | Definition-of-done status, evidence-only |
