# VITRUVIAN: Body Intelligence Acceptance Report

Statuses: NOT STARTED · IN PROGRESS · IMPLEMENTED — NOT VERIFIED · VERIFIED · BLOCKED

These are **software** acceptance tests. Every number comes from synthetic bodies with known ground truth (`tests/intelligence.test.ts`) or from **simulated test fixtures** in the emulated end-to-end run (`e2e/quest-emulated.mjs`, all data flagged `simulated: true`). No real person's measurements, scans, garment fits or videos are presented as evidence. Physical meaning (real bodies changing, real garments fitting) needs the field validation in `docs/VALIDATION.md`.

"VERIFIED (software)" means the stated software test was actually run and passed, with the evidence listed. It says nothing about real-world accuracy.

| # | Requirement | Status | Test procedure | Actual result | Evidence | Limitations |
|---|---|---|---|---|---|---|
| 1 | Multiple measurement snapshots can be saved | VERIFIED (software) | E2E: 1 VR Quick Fit + 3 seeded fixture snapshots saved to encrypted IndexedDB | 4 snapshots listed | `evidence/body-intelligence/report.json` (“Multiple snapshots saved”) | Real multi-session use not yet performed |
| 2 | Historical measurements remain unchanged | VERIFIED (software) | Unit: compare/report never mutate inputs. E2E: first snapshot JSON identical after 3 later saves | identical | `tests/intelligence.test.ts` BI-1/2; e2e “immutable” | User-initiated deletion is allowed (privacy); editing is not |
| 3 | Two snapshots can be compared | VERIFIED (software) | Unit + E2E change report between chosen snapshots | report rendered with per-measurement rows | BI-3/4/5/6; e2e “Change report” | — |
| 4 | Change calculations correct | VERIFIED (software) | Known +60 mm breadth change over 4 weeks | Δ = 60 mm, % = 20.7, 15 mm/week | BI-3/4/5/6 “computes previous, current…” | — |
| 5 | Measurement uncertainty considered | VERIFIED (software) | `u_Δ` from random uncertainty + biological variation; z thresholds | significant / possible / stable assigned by z | BI-3/4/5/6 | Uncertainty priors must be replaced by measured repeatability |
| 6 | False changes from tracking noise filtered | VERIFIED (software) | 3 mm change → “stable”; borderline → “possible” unless trend-confirmed | as specified | BI-3/4/5/6 | Thresholds are priors |
| 7 | Historical body models can be compared | VERIFIED (software) | Overlay and side-by-side of first vs last snapshot in the Transformation Studio | rendered | `evidence/body-intelligence/14-transformation-studio.png` | Mannequin = measurement model, not a photo scan |
| 8 | Mesh interpolation stable | VERIFIED (software) | Topology check, exact endpoints, finite midpoints, refusal of incompatible topology | pass | BI-7/8/9 | — |
| 9 | Interpolated states labelled | VERIFIED (software) | `frameAt(0/1)` = ACTUAL SCAN, `0.5` = INTERPOLATED VISUAL STATE, scenario = HYPOTHETICAL; labels burned into frames | pass | BI-7/8/9; filmstrip/video files | — |
| 10 | Transformation video can be rendered | VERIFIED (software) | E2E: 2 s recording via local MediaRecorder (headless Chromium) + filmstrip | file produced (see report.json for size/format) | `evidence/body-intelligence/` | Format depends on the browser (MP4 where supported, else WebM) |
| 11 | Garment ≠ body dimensions | VERIFIED (software) | Garment stored with its own measurements; assessment reports body, garment and ease separately | pass | BI-11/12/13 | — |
| 12 | Ease calculations correct | VERIFIED (software) | garment − body = 90 mm exactly | pass | BI-11/12/13 | Ease ranges unvalidated |
| 13 | Garment-specific assessments | VERIFIED (software) | Category, fit intent and stretch change the verdict (compression accepts negative ease); missing data → “requires information”; size ranking per garment chart | pass | BI-11/12/13; e2e wardrobe | Real try-on validation = cycle-1 Test 08 |
| 14 | Reports reproducible | VERIFIED (software) | Same stored snapshots → identical report text; engine version in report | pass | BI-14 | — |
| 15 | Historical passports remain exportable | VERIFIED (software) | 1.0 → 1.1 migration; JSON/CSV/MD/OBJ/MetaHuman/Unreal exports from saved snapshots | pass | BI-15; e2e exports | — |

## Stages
| Stage | Status |
|---|---|
| A: snapshots + comparison engine | IMPLEMENTED; software tests pass |
| B: Body Evolution dashboard + trends | IMPLEMENTED: overview, change map, timeline (W/M/Q/Y/custom), proportions, report |
| C: 3D before/after | IMPLEMENTED: overlay, side by side, synchronised views, 4 styles |
| D: interpolation + video export | IMPLEMENTED: MP4/WebM, PNG sequence, filmstrip, report |
| E: wardrobe + garment model | IMPLEMENTED |
| F: fit assessments + MD integration | IMPLEMENTED (assessments, MD project reference per garment). MD validation is NOT STARTED (needs designer + MD) |
| G: marketplace | IN PROGRESS: host contract + garment-specific size ranking. Checkout not started |

## What must still happen in the real world
1. Repeatability study: same person, 5 sessions, same day. This replaces the uncertainty priors.
2. Longitudinal use over weeks, comparing against tape check-ins.
3. Real garments: measure garments, record try-on verdicts, compare with engine statuses, then tune the ease ranges.
