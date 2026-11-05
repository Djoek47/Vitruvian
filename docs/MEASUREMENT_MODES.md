# Measurement modes

_Generated from `src/measurement/procedures.ts` and `src/measurement/registry.ts` by `scripts/gen-modes.ts`. Do not edit by hand._

| Mode | Body points | Point cap (incl. repeat samples) | Time | Notes |
|---|---|---|---|---|
| **Simple** | 10 (+ ground & head) | 20 | ~3 min | 10 points · quick sizing · girths estimated |
| **Intermediate** | 46 (+ ground & head) | 80 | ~12 min | ≈ 50 points · tailor essentials · girths measured |
| **Ultra** | 65 (+ ground & head) | 120 | ~18 min | ≈ 65 points + repeats (max 120) · full tailoring set |

Every mode starts with the same calibration: **Ground** (floor plane), **Head** (headset and body axes), **Instrument** (tip-to-tip ×3).

## Capture steps
| # | Step | Section | Points | Simple | Intermediate | Ultra |
|---|---|---|---|---|---|---|
| 1 | Ground | Calibrate | Floor | ● | ● | ● |
| 2 | Head | Calibrate | headset | ● | ● | ● |
| 3 | Instrument | Calibrate | 3 tip touches | ● | ● | ● |
| 4 | Height | Head & neck | Top of head (vertex) | ● | ● | ● |
| 5 | Neck breadth | Head & neck | Neck side, left · Neck side, right |  | ● | ● |
| 6 | Neck depth · nape | Head & neck | Neck front (below Adam's apple) · Nape (C7 vertebra) |  | ● | ● |
| 7 | Neck base | Head & neck | Suprasternal notch · C7 (neck base capture) |  |  | ● |
| 8 | Neck-shoulder points | Head & neck | Left neck-shoulder point (HPS) · Right neck-shoulder point (HPS) |  | ● | ● |
| 9 | Shoulder width | Shoulders & arms | Right acromion · Left acromion | ● | ● | ● |
| 10 | Arm · shoulder | Shoulders & arms | Right acromion, arm hanging |  | ● | ● |
| 11 | Arm · elbow | Shoulders & arms | Right elbow (lateral epicondyle) |  | ● | ● |
| 12 | Arm · wrist | Shoulders & arms | Right wrist (ulnar styloid) | ● | ● | ● |
| 13 | Left arm · shoulder | Shoulders & arms | Left acromion, arm hanging |  |  | ● |
| 14 | Left arm · elbow | Shoulders & arms | Left elbow (lateral epicondyle) |  |  | ● |
| 15 | Left arm · wrist | Shoulders & arms | Left wrist (ulnar styloid) |  |  | ● |
| 16 | Arm span | Shoulders & arms | Left hand (grip centre), arms out · Right hand (grip centre), arms out |  | ● | ● |
| 17 | Across front | Torso | Front armpit crease, left · Front armpit crease, right |  | ● | ● |
| 18 | Across back | Torso | Back armpit crease, left · Back armpit crease, right |  | ● | ● |
| 19 | Armhole depth | Torso | Right armpit (axilla) |  | ● | ● |
| 20 | Bust points | Torso | Bust point, left · Bust point, right |  |  | ● |
| 21 | Chest breadth | Torso | Chest side, left (nipple level) · Chest side, right (nipple level) | ● | ● | ● |
| 22 | Chest depth | Torso | Chest front (sternum, nipple level) · Back at chest level (spine) |  | ● | ● |
| 23 | Underbust breadth | Torso | Underbust side, left · Underbust side, right |  |  | ● |
| 24 | Underbust depth | Torso | Underbust front · Back at underbust level |  |  | ● |
| 25 | Waist breadth | Torso | Waist side, left (narrowest) · Waist side, right (narrowest) | ● | ● | ● |
| 26 | Waist depth | Torso | Waist front (navel) · Waist back (spine) |  | ● | ● |
| 27 | High hip breadth | Torso | High hip (iliac crest), left · High hip (iliac crest), right |  | ● | ● |
| 28 | High hip depth | Torso | High hip front · Lower back at high hip |  |  | ● |
| 29 | Hip breadth | Torso | Hip side, left (widest) · Hip side, right (widest) | ● | ● | ● |
| 30 | Hip depth | Torso | Hip front (same height) · Buttocks (most prominent) |  | ● | ● |
| 31 | Inseam | Legs & feet | Crotch (top of inner thigh) |  | ● | ● |
| 32 | Thigh breadth | Legs & feet | Right thigh, outside (fullest) · Right thigh, inside (fullest) |  | ● | ● |
| 33 | Thigh depth | Legs & feet | Right thigh, front · Right thigh, back |  | ● | ● |
| 34 | Knee height | Legs & feet | Right knee (joint line, side) |  | ● | ● |
| 35 | Knee breadth | Legs & feet | Right knee, outside · Right knee, inside |  |  | ● |
| 36 | Knee depth | Legs & feet | Right kneecap · Back of right knee |  |  | ● |
| 37 | Left knee height | Legs & feet | Left knee (joint line, side) |  |  | ● |
| 38 | Calf breadth | Legs & feet | Right calf, outside (widest) · Right calf, inside (widest) |  | ● | ● |
| 39 | Calf depth | Legs & feet | Right shin, front · Right calf, back |  | ● | ● |
| 40 | Ankle height | Legs & feet | Right ankle (lateral malleolus) |  | ● | ● |
| 41 | Left ankle height | Legs & feet | Left ankle (lateral malleolus) |  |  | ● |
| 42 | Foot length | Legs & feet | Right heel (back, on floor) · Right longest toe tip (on floor) |  | ● | ● |

## Measurements (tailor / designer reference)
Method in each mode: **D** direct (geometric) · **De** derived (model from direct values) · **E** estimated (population prior) · *tape* = manual entry only. A girth is *estimated* when a mode has no depth points for it.

| Measurement | Group | Fit tolerance | Modes | T-shirt |
|---|---|---|---|---|
| Height (`height`) | Global | ±1.5 cm | Simple, Intermediate, Ultra | ● |
| Shoulder width (biacromial) (`shoulder_width`) | Torso | ±1 cm | Simple, Intermediate, Ultra | ● |
| Chest breadth (`chest_width`) | Torso | ±1 cm | Simple, Intermediate, Ultra | ● |
| Chest depth (`chest_depth`) | Torso | ±1 cm | Intermediate, Ultra | ● |
| Chest circumference (`chest_circumference`) | Torso | ±2 cm | Simple, Intermediate, Ultra | ● |
| Waist breadth (`waist_width`) | Torso | ±1 cm | Simple, Intermediate, Ultra | ● |
| Waist depth (`waist_depth`) | Torso | ±1 cm | Intermediate, Ultra | ● |
| Waist circumference (`waist_circumference`) | Torso | ±2 cm | Simple, Intermediate, Ultra | ● |
| Hip breadth (`hip_width`) | Torso | ±1 cm | Simple, Intermediate, Ultra | ● |
| Hip depth (`hip_depth`) | Torso | ±1 cm | Intermediate, Ultra | ● |
| Hip circumference (`hip_circumference`) | Torso | ±2 cm | Simple, Intermediate, Ultra | ● |
| Arm length (shoulder → wrist) (`arm_length`) | Arms | ±1.5 cm | Simple, Intermediate, Ultra | ● |
| Shoulder height (`shoulder_height`) | Torso | ±1.5 cm | Simple, Intermediate, Ultra |  |
| Waist height (`waist_height`) | Torso | ±1.5 cm | Simple, Intermediate, Ultra | ● |
| Back length (nape → waist) (`back_length`) | Torso | ±1.5 cm | Intermediate, Ultra | ● |
| Neck breadth (`neck_width`) | Head/neck | ±0.8 cm | Intermediate, Ultra | ● |
| Neck depth (`neck_depth`) | Head/neck | ±0.8 cm | Intermediate, Ultra | ● |
| Neck circumference (`neck_circumference`) | Head/neck | ±1.5 cm | Intermediate, Ultra | ● |
| Inseam (`inseam`) | Legs | ±1.5 cm | Intermediate, Ultra |  |
| Outseam (waist → floor) (`outseam`) | Legs | ±1.5 cm | Intermediate, Ultra |  |
| Knee height (`knee_height`) | Legs | ±1.5 cm | Intermediate, Ultra |  |
| Arm span (`arm_span`) | Arms | ±2 cm | Intermediate, Ultra |  |
| Eye height (headset) (`eye_height`) | Global | ±1.5 cm | Simple, Intermediate, Ultra |  |
| Upper arm (shoulder → elbow) (`upper_arm_length`) | Arms | ±1.2 cm | Intermediate, Ultra | ● |
| Forearm (elbow → wrist) (`forearm_length`) | Arms | ±1.2 cm | Intermediate, Ultra |  |
| Front waist length (neck → waist) (`front_waist_length`) | Torso | ±1.5 cm | Intermediate, Ultra | ● |
| Rise (waist → crotch) (`rise`) | Legs | ±1.2 cm | Intermediate, Ultra |  |
| Ankle height (`ankle_height`) | Legs | ±1 cm | Intermediate, Ultra |  |
| Foot length (`foot_length`) | Feet | ±0.5 cm | Intermediate, Ultra |  |
| Thigh breadth (`thigh_width`) | Legs | ±0.8 cm | Intermediate, Ultra |  |
| Thigh depth (`thigh_depth`) | Legs | ±0.8 cm | Intermediate, Ultra |  |
| Thigh circumference (`thigh_circumference`) | Legs | ±1.5 cm | Intermediate, Ultra |  |
| Calf breadth (`calf_width`) | Legs | ±0.6 cm | Intermediate, Ultra |  |
| Calf depth (`calf_depth`) | Legs | ±0.6 cm | Intermediate, Ultra |  |
| Calf circumference (`calf_circumference`) | Legs | ±1 cm | Intermediate, Ultra |  |
| Upper arm circumference (tape) (`upper_arm_circumference`) | Arms | ±1 cm | Intermediate, Ultra | ● |
| Forearm circumference (tape) (`forearm_circumference`) | Arms | ±0.8 cm | Intermediate, Ultra |  |
| Wrist circumference (tape) (`wrist_circumference`) | Arms | ±0.5 cm | Intermediate, Ultra |  |
| Shoulder length, right (HPS → shoulder point) (`shoulder_length_r`) | Torso | ±0.8 cm | Intermediate, Ultra | ● |
| Shoulder length, left (`shoulder_length_l`) | Torso | ±0.8 cm | Intermediate, Ultra | ● |
| Shoulder drop, right (HPS − acromion height) (`shoulder_slope_r`) | Torso | ±0.8 cm | Intermediate, Ultra | ● |
| Shoulder drop, left (`shoulder_slope_l`) | Torso | ±0.8 cm | Intermediate, Ultra | ● |
| Neck base breadth (HPS ↔ HPS) (`neck_base_width`) | Head/neck | ±0.8 cm | Intermediate, Ultra | ● |
| Across front (straight) (`across_front`) | Torso | ±1 cm | Intermediate, Ultra | ● |
| Across back (straight) (`across_back`) | Torso | ±1 cm | Intermediate, Ultra | ● |
| Armhole depth (nape → armpit) (`armhole_depth`) | Torso | ±1 cm | Intermediate, Ultra | ● |
| Front length (HPS → waist, vertical) (`front_length_hps`) | Torso | ±1.2 cm | Intermediate, Ultra | ● |
| Nape to floor (`nape_to_floor`) | Global | ±1.5 cm | Intermediate, Ultra |  |
| Waist to hip (vertical) (`waist_to_hip`) | Torso | ±1 cm | Intermediate, Ultra |  |
| Waist to knee (`waist_to_knee`) | Legs | ±1.2 cm | Intermediate, Ultra |  |
| High hip breadth (`high_hip_width`) | Torso | ±1 cm | Intermediate, Ultra |  |
| High hip depth (`high_hip_depth`) | Torso | ±1 cm | Ultra |  |
| High hip circumference (`high_hip_circumference`) | Torso | ±2 cm | Intermediate, Ultra |  |
| Neck base depth (notch → C7) (`neck_base_depth`) | Head/neck | ±0.8 cm | Ultra | ● |
| Neck base circumference (`neck_base_circumference`) | Head/neck | ±1.5 cm | Intermediate, Ultra | ● |
| Bust point to bust point (`apex_to_apex`) | Torso | ±0.8 cm | Ultra |  |
| Neck-shoulder point to bust point (`hps_to_apex`) | Torso | ±1 cm | Ultra |  |
| Underbust breadth (`underbust_width`) | Torso | ±1 cm | Ultra |  |
| Underbust depth (`underbust_depth`) | Torso | ±1 cm | Ultra |  |
| Underbust circumference (`underbust_circumference`) | Torso | ±1.5 cm | Ultra |  |
| Arm length, left (`arm_length_left`) | Arms | ±1.5 cm | Ultra | ● |
| Upper arm, left (`upper_arm_length_left`) | Arms | ±1.2 cm | Ultra | ● |
| Forearm, left (`forearm_length_left`) | Arms | ±1.2 cm | Ultra |  |
| Knee height, left (`knee_height_left`) | Legs | ±1.5 cm | Ultra |  |
| Ankle height, left (`ankle_height_left`) | Legs | ±1 cm | Ultra |  |
| Knee breadth (`knee_width`) | Legs | ±0.6 cm | Ultra |  |
| Knee depth (`knee_depth`) | Legs | ±0.6 cm | Ultra |  |
| Knee circumference (`knee_circumference`) | Legs | ±1 cm | Ultra |  |
