# Validation protocol

Four separate stages. Passing one does **not** imply the next:
1. **Spatial**: does a tip-to-tip reading match a ruler? (Test 04)
2. **Anatomical**: does a Vitruvian body measurement match a tape measurement? (Test 08 part 1)
3. **Model**: does the derived circumference match the tape? (fit the shape exponent)
4. **Garment**: does the recommended or simulated T-shirt actually fit? (Test 08 part 2)

## 1. Ruler test: Test 001 (Measurement Studio)
Equipment: steel ruler or tape, 1 mm graduations; a rigid object of known length (e.g. a 297 mm A4 sheet edge).
1. Run Quick Fit step 1 (tip calibration) first, then Menu ▸ Measurement Studio.
2. For each of **100, 200, 300, 500, 800 mm**: place both tips on the ruler marks, hold A, then key the true value in mm ▸ *Log reference*.
3. Repeat each distance in 3 orientations: tips facing (180°), parallel (0°), crossed (~90°). That's 15 readings minimum.
4. Repeat one distance 10× without moving the ruler (repeatability SD).
5. Exit VR ▸ Validation ▸ *Ruler log (.csv)*. The page shows MAE, RMSE, bias and SD.

Engineering target (not a guarantee): MAE ≤ 3 mm, SD ≤ 2 mm. If bias is constant, the tip calibration is off. Re-run it.

## 2. Anatomical comparison: tape (ISO 8559-1 landmarks)
Participant: light clothing, standing, relaxed breathing. Measurer: the same person for all tape values.

| Measurement | Tape procedure |
|---|---|
| Height | Stadiometer or wall + set square, barefoot, head in Frankfurt plane |
| Shoulder width | Caliper or straight ruler between acromion points (straight line, *not* over the curve) |
| Chest circumference | Horizontal at nipple level under the arms, end of normal exhale |
| Waist circumference | Horizontal at the narrowest point between ribs and iliac crest |
| Hip circumference | Horizontal at maximum buttock prominence |
| Arm length | Acromion to ulnar styloid, arm hanging straight |
| Inseam | Crotch to floor, standing |
| Neck circumference | Just below the Adam's apple, perpendicular to the neck axis |

Do each tape measurement **3×** and record the median. Enter values on the landing page ▸ Validation ▸ *Tape-measure comparison* ▸ *Save tape values* ▸ *Comparison report (.csv)*.

"Within 99 %" = |error| ≤ 1 % of the tape value: about ±18 mm on height, ±4 mm on shoulder width, ±10 mm on chest circumference. The CSV reports `abs_error_pct` per row. Expect linear (direct) values to be closest. Circumferences need stage 3.

## 3. Fit the circumference model
After ≥ 5 participants with tape girths, fit the shape exponent per region:
```ts
fitShapeExponent(rows /* { breadthMm, depthMm, tapeMm }[] from passports + tape */)
```
Put the result in `CaptureSession.shape` (per-dataset) or update `SHAPE_PRIORS`. Report the RMSE. Never fit on the same participants you report accuracy on (hold-out).

## 4. T-shirt fit
| Step | Record |
|---|---|
| Garment | Name, size, fabric, and the measured garment: chest (flat × 2), shoulder seam to seam, HPS to hem, sleeve |
| Body | Passport JSON (profileId) |
| Simulation | MD project `.zprj`, screenshots front/side/back + strain map |
| Real try-on | Participant wears the same garment. Rate chest, shoulder, waist, sleeve, length: tight / good / loose |
| Comparison | Does the fit engine's verdict per area match the real try-on? |

## Participant consent
Use the in-app consent (stored with timestamp in the passport) **plus** a signed paper or e-form for test sessions: purpose, data captured (no images), storage, retention, right to delete.

## Worksheet template
`validation/worksheet.csv`, one row per participant × measurement.
