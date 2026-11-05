# Architecture

## Principle: a body-data platform, not a VR demo

Each layer only depends on the layer below it. The VR app is one *client* of the measurement engine and the Body Passport.

| Layer | Modules | Depends on | Replaceable by |
|---|---|---|---|
| Tracking source | `tracking/webxr.ts` | WebXR | native OpenXR (Unreal), other headsets, phone AR |
| Measurement engine | `core`, `measurement`, `anatomy`, `body/circumference` | nothing (pure TS) | port to Unreal C++ 1:1 |
| Body Passport | `passport/*`, `schemas/` | engine types | — (the canonical asset) |
| Avatar / garment adapters | `bridge/marvelous.ts`, `bridge/metahuman.ts`, `body/mannequin.ts`, `fit/tshirt.ts` | Body Passport only | CLO, other avatar systems |
| Host integration | `integration/faberland.ts` | Body Passport only | Faberland account sync service |
| Presentation | `app`, `scene`, `ui`, `landing.ts`, `main.ts` | everything above | Unreal UMG widgets |

## Why WebXR for cycle 1

* The session runs in a cloud container: no USB to the headset, no Unreal Engine install.
* The Quest Browser exposes the **same OpenXR controller poses** a native app receives (`XRFrame.getPose` on the controller's target-ray and grip spaces, in `local-floor` space).
* It deploys by URL in seconds, runs standalone on the headset, and installs as a PWA or packages as an APK (Meta `bubblewrap`, see `QUEST_APK.md`).
* The engine is dependency-free TypeScript, so moving into the Faberland Unreal app means porting about 1,500 lines of math. Or keep Vitruvian as a web extension launched from the app (`INTEGRATION.md`).

## Measurement method

### The tip
A controller's *measuring tip* is a point on its aim ray, `offset` metres ahead of the aim-pose origin. **Tip calibration** (step 1): touch both tips together three times at different angles. Each touch gives `Δo + d·Δr = 0`; least squares gives `d = −Σ(Δo·Δr)/Σ|Δr|²`. The RMS residual is the real tip and tracking error, and it feeds every measurement's uncertainty.

### Capture
`Stabilizer`: a 600 ms window. A capture commits only if both points are tracked (`emulatedPosition === false`), the window is full, and each point's RMS jitter is ≤ 2 mm, held for 0.9 s. Value = per-axis median of the window. Losing stability resets the hold. After a capture the user must **Accept** or **Retake**.

### Body frame
Set at the *Stance* step from the headset's horizontal gaze: `forward`, `lateral = forward × up`, origin on the calibrated floor. Breadths project onto `lateral`, depths onto `forward`, heights are `y − floorY`. Rotation-invariant (unit-tested with the user rotated 35° and offset).

### Classifications

| Class | Meaning | Examples |
|---|---|---|
| **direct** | Geometric distance between tracked landmarks | height, shoulder width, breadths, depths, arm length, inseam |
| **derived** | Computed from direct values with a model | chest / waist / hip / neck circumference (superellipse), arm span (+ hand offset) |
| **estimated** | Population or model fill-in | mannequin limb girths (never written to the passport as measurements) |
| **manual** | User override (always wins, flagged *conflicted* if far from measured) | Body Editor ± steppers |
| *conflicted* (status) | Fails a plausibility or ratio check | e.g. arm span / height outside 0.92–1.12 |

### Circumference: the hard part, stated honestly
Two points give a straight line, never a girth. We measure **breadth** and **depth** directly and model the cross-section as a superellipse `|x/a|ⁿ+|y/b|ⁿ=1`. The priors (`n` = 2.4 chest, 2.25 waist, 2.35 hip, 2.0 neck) are uncalibrated. `fitShapeExponent()` re-fits `n` from tape-measured participants (VALIDATION.md). Until that is done, circumferences carry ±3 % model uncertainty and are labelled *derived*.

### Uncertainty
`u = √(placement² + tipResidual² + trackingFloor² + jitter²)` per point, combined in quadrature, plus a sequential-motion term for two-step captures. Confidence = `tol²/(tol²+u²)` with a fit tolerance per measurement.

## Persistence
IndexedDB, AES-GCM-256 with a non-extractable device key. Every save appends a version under the same `profileId` (history). An in-progress session is checkpointed after every accepted capture, so it survives crash or restart. "Delete all my body data" wipes the database and the key.

## Performance on Quest
Fat lines are re-aimed by transform (no per-frame geometry). Canvas panels redraw only when their state signature changes. Additive glow sprites instead of post-processing bloom. Foveation 0.4.
