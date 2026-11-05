# Physical headset test checklist (you + Quest)

Record the answers in `VITRUVIAN_CYCLE_1_ACCEPTANCE_REPORT.md`. Screenshot in the headset with Meta + trigger, or cast to phone and record.

## A. Launch (Test 02)
- [ ] Quest model + OS version (Settings ▸ System ▸ About): ________
- [ ] Open the URL in Meta Quest Browser. The landing page shows **✅ VR ✅ Mixed Reality**
- [ ] Tick consent ▸ Enter Mixed Reality: passthrough + gold Vitruvian hologram + panel appear
- [ ] (APK path) app installs and launches from the library. See QUEST_APK.md

- [ ] First entry shows the boot sequence, then the 4-page tutorial (A = next, B = back, Skip). Second entry goes straight to Home
- [ ] Exit asks for confirmation ("Leave Vitruvian?") and returns to the page with your passport

## B. Tracking (Test 03)
- [ ] Status pills **L R HMD** are green
- [ ] Move each controller: tip reticle follows, no lag
- [ ] Hide one controller behind your back for 3 s: its pill turns ember and the beam says TRACKING LOST
- [ ] Bring it back: recovers. Exit ▸ Validation ▸ *Tracking log (.csv)* shows `lost` / `recovered` rows
- [ ] Top-right never shows "SIMULATOR" (that label only appears with `?emulate=`)

## C. Ruler (Test 04): see VALIDATION.md §1
- [ ] Tip calibration residual shown after 3 touches: ____ mm
- [ ] 15+ readings logged with references. MAE ____ mm, SD ____ mm
- [ ] cm/mm toggle works (Menu ▸ Units)

## D. Capture & persistence (Test 05)
- [ ] Order is Ground (gold ring appears on the floor) → Head → Instrument → body
- [ ] Each step shows STAND / HOLD / WHY. The beam chip shows the distance and X / Y / Z
- [ ] After a capture, X (+ Sample) averages a second placement: "2 samples averaged", and the uncertainty shrinks in the Editor
- [ ] Quick Fit: each step only captures when steady. Moving during the hold resets it
- [ ] Review card ▸ Retake works. Accept advances
- [ ] Body Editor: select a value ▸ +1/−1 mm (becomes MANUAL), Revert, Lock, Re-measure, Delete
- [ ] Quit the browser completely, reopen: passport and history are still there; an unfinished session resumes

## E. Export (Test 06)
- [ ] Download passport JSON ▸ re-import it ▸ "Imported and validated ✓"

## F. Comfort
- [ ] Panel text readable without leaning. No discomfort during 8 min Precision Fit
- [ ] Note any step whose instruction was unclear: ________
