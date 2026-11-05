# Design inventory: `AR to VR App.make`

The `.make` file is a Figma Make export (zip): `canvas.fig`, `ai_chat.json` (thread metadata), `thumbnail.png`, `images/`, a chat blob store, and `make_repos/ww01l2.zip`, a git object store (packs + LFS) of the Make code project. The repo was rebuilt from the packs at commit `8394ff6` (30 commits, "prompt: 10 … 210"), and the LFS images were restored. It is preserved unmodified in `design/figma-make/`.

| Asset / spec | Location | Used in Vitruvian |
|---|---|---|
| Faberland star (gold, ember edge) | `design/figma-make/src/assets/faberland-logo-3.png` | `public/brand/faberland-star.png`: panel header, landing hero, PWA icons |
| Faberland wordmark | `…/assets/faberland-wordmark.png` | `public/brand/faberland-wordmark.png`: home panel, landing |
| Other logo variants, preview drawings | `…/assets/*`, `…/imports/*` | preserved, not yet used |
| Colour tokens (`faber/gold #FFC61A`, amber, ember, panel, surface, text, state) | `imports/pasted_text/faberland-vr-ui-spec.md`, `src/index.css` | `src/ui/theme.ts`, `index.html` CSS vars (exact values) |
| Typography: Chakra Petch italic display, Inter UI | `faberland-vr-ui-spec.md` | self-hosted (@fontsource), same faces and weights |
| Panel chrome: glass, 2 dmm gold top edge, 16/24 radius, no shadows | ui-spec | `CanvasPanel.chrome()` (+ corner brackets from the manipulation spec) |
| Confidence system: ● measured, ○ derived, gray estimated, ember manual, ▲ conflicted | `faberland-xr-design-system.md` Part 4 | `CanvasPanel.badge()`, landing badges, engine classifications |
| Vitruvian Body Editor: list / viewport / detail, ±1/±10 mm steppers, lock, "where this comes from", re-measure | design-system Part 4 | `VitruvianApp.drawEditor()` + hologram as viewport |
| Measurement Studio: beam, endpoint markers, particles, capture progress, lock, history, re-measure | `src/ScreenMeasurementStudio.tsx` | `scene/beam.ts`, `drawStudio()`, `drawCapture()` |
| 6 designed measures (arm span, shoulder, torso, hip, reach, chest depth) | `ScreenMeasurementStudio.tsx` | all mapped to registry procedures (torso → chest breadth, reach → height) |
| Controller bindings: A confirm, B back, trigger select, Meta/Menu never bound | design-system Part 1 | input mapping in `app.ts` (Meta/Menu unused) |
| Touch Plus controller artwork | `src/QuestController.tsx` (2D SVG) | in VR the real Touch Plus glTF from WebXR input profiles is rendered; the 2D art remains for flat UI |
| HUD constraints (≤ 6 head-locked, nothing in central 20°) | design-system Part 3 | Vitruvian uses **no** head-locked UI; all panels are world- and body-placed |
| Command registry (EN/FR) | `imports/faberland_command_registry.csv` | French labels reused in steps and landmarks; voice not in cycle 1 |

Not yet implemented from the design: assistant star states and voice, palm menu, manipulation handles, HUD layer. These are outside the measurement MVP.
