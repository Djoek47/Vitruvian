# UI review & visual rework

Scope: the headset panels, the Vitruvian hologram, the controller hints and the companion page. References:
* **faberland.online** (repo `Djoek47/Berland`): near-black gradient background, Inter, glass cards with rounded-xl corners, gold emblem, green and teal calls to action, amber icons.
* **The Figma Make design** (`design/figma-make`): gold-led XR system, ember edge, panel chrome, confidence badges, Touch Plus artwork.
* **Brand:** the Faberland emblem and wordmark are byte-identical in the site and the app. The wordmark lettering is **Planet Kosmos**.

## Design decisions
| Topic | Decision |
|---|---|
| Display face | **Planet Kosmos** for titles (falls back to Chakra Petch with a synthetic slant until the licensed file is installed; see `public/fonts/README.md`) |
| Text face | **Inter**, the same as faberland.online |
| Accent | Gold stays the single accent (Figma XR rule, and the emblem's colour). The site's green (`#22C55E`) is adopted as the **success / confirm** state, so states match the website |
| Canon | Leonardo's proportions on φ: navel at H/φ, the circle centred on it touching the feet, φ-section marks, a golden spiral from the navel |
| Type scale | √φ steps on Fibonacci numbers: **21 · 27 · 34 · 43 · 55 · 70 · 89 · 113**. Every canvas text snaps to it (`snapType`), and line height is never under size × √φ |
| Spacing | Fibonacci: **8 · 13 · 21 · 34 · 55 · 89 · 144** (companion page CSS tokens) |

## Findings → fixes
| # | Finding | Fix | Status |
|---|---|---|---|
| 1 | About 20 different font sizes across VR screens; tiny 20–24 px help text | Single type scale enforced centrally in `CanvasPanel` | Done |
| 2 | VR body text ≈ 20–25 dmm, below the design system's 32 dmm body / 28 dmm floor | Panel enlarged 1.3 → 1.5 m (≈ 1110 dmm at 1.35 m). New **Settings ▸ Panel ▸ Large** (×1.25) gives ≈ 30–33 dmm body text | Done. **Verify comfort on the headset** |
| 3 | Display font did not match the wordmark | Planet Kosmos pipeline (license-safe: git-ignored, optional CI secret) | Done; **needs the font file** |
| 4 | Ghost buttons (Menu, Exit, Skip, Step map) unreadable as buttons at distance | Ghost variant keeps a visible outline | Done |
| 5 | Not-yet-measured items in tertiary grey, nearly invisible in the headset | Secondary text colour | Done |
| 6 | Hologram figure built from straight polylines | Smooth centripetal Catmull-Rom contours, H/8 head with a √φ aspect, golden canon frame, spiral | Done |
| 7 | Twin read as a solid blob | Particle constellation on every mesh vertex + contour rings (reference: holographic particle figure) | Done |
| 8 | Projector base had arbitrary rings and ticks | Rings in φ proportion, Fibonacci tick counts (21 · 34 · 55 · 89), spin speeds in ratio φ, floor spiral | Done |
| 9 | Callout labels small | Label height +18 % | Done |
| 10 | Companion page: double-bordered cards, muddy disabled primary button, unstyled file inputs, emoji status, footer said "schema v1.0" | Site-style glass cards, a gold hairline, clear disabled state, styled file pickers, status pills, footer fixed, Fibonacci spacing, focus rings, reduced-motion support | Done |
| 11 | Save toast covered titles | Moved into the header strip | Done (previous pass) |
| 12 | Hint cards re-uploaded textures 12×/s | Redraw only on change | Done (previous pass) |

## Still to check on the headset
* Text comfort at Normal vs Large, and at the lens edges.
* Hologram line weights in passthrough (Mixed Reality) vs VR.
* Planet Kosmos legibility at the smallest title size it is used for (43 px).
