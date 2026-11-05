# Marvelous Designer workflow (adapter `md-adapter-1.0`)

## What is verified vs. not

| Fact | Status | Source |
|---|---|---|
| Avatar Editor accepts user-entered circumference, height and length values, with optional "linked" proportional adjustment | Verified (official docs) | support.marvelousdesigner.com, *Avatar Settings* |
| Avatar size saves as `.AVS` (size only, tied to its base avatar), avatar as `.AVT`, measurements as `.MEA` | Verified (official docs) | support.marvelousdesigner.com, *File Format* |
| `.AVS/.AVT/.MEA` internal layout | **Not public**. We do not write these files | — |
| OBJ / FBX import as avatar | Standard MD feature; **confirm on your installed version** | — |
| Scripting / automation API for avatar sizing | **Not assumed** | — |
| Exact Avatar Editor row labels per MD version | **To confirm** on your install; the sheet's `md_label` column is editable | — |

**Compatibility is NOT claimed until you complete the test below on your Marvelous Designer version** (Acceptance Test 07).

## Exports (Body Passport card → Export)

| File | Use |
|---|---|
| `*-marvelous-designer.csv` | One row per Avatar Editor field: category, label, **value in cm**, uncertainty, method, status |
| `*-marvelous-designer.txt` | Step-by-step worksheet for the designer |
| `*-mannequin.obj` | Measured mannequin, **millimetres**, Y-up, floor at 0, facing +Z. Chest, waist, hip and neck ring perimeters equal the passport circumferences exactly (unit-tested). Limb girths are *estimated*, listed in the OBJ header |
| `*-passport.json` | Canonical source. Always archive it with the garment project |

## Route A: Avatar Editor (recommended for production)
1. Load the base avatar that matches the person (sex, build).
2. Avatar ▸ Avatar Editor. Enter each CSV value (cm) in the matching row. Unlink proportional adjustment if you need exact individual values.
3. Save Size (`.AVS`) named with the passport `profileId`.
4. With the Tape Measure tool, re-measure chest, waist and hip on the avatar. Record them in `validation/md-check.csv`.

## Route B: Mannequin OBJ (exact girths, no rig)
1. File ▸ Import ▸ OBJ ▸ choose *Open as Avatar*. **Unit: millimetre.**
2. Check the height on the 3D grid equals the passport height.
3. Tape Measure on chest, waist and hip should match the passport within 5 mm.
4. Use for a static drape and fit check. For animation use Route A or the MetaHuman route.

## Keep three datasets separate
* **Body**: passport values (the person).
* **Garment**: measure the simulated garment in MD (flat chest × 2, shoulder seam to seam, HPS to hem, sleeve).
* **Ease** = garment − body. Enter garment values in the fit engine (`src/fit/tshirt.ts`, or the in-VR "T-shirt fit" screen) for a quantitative verdict.

## T-shirt fit validation record (Acceptance Test 08)
Use `docs/VALIDATION.md` §3. The garment project (`.zprj`), screenshots of the simulation (front, side, back, with strain map) and the filled table are the evidence.
