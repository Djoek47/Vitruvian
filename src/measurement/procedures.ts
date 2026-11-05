import type { ProfileKind } from "./types";

/**
 * Guided capture steps, in the order the user performs them:
 *   GROUND → HEAD → INSTRUMENT → head/neck → shoulders → arms → torso → hips → legs → feet
 *
 * THREE MODES (body points exclude the ground & head calibration points):
 *   SIMPLE        10 body points: height, shoulders, chest/waist/hip breadth, wrist.
 *                 Girths are ESTIMATED from breadth (no depth points), clearly labelled.
 *   INTERMEDIATE  ≈ 46 body points (≈ 48 with ground + head): every girth derived from
 *                 measured breadth × depth, plus the tailor's essentials (neck-shoulder
 *                 point, across front/back, armhole depth, high hip, legs, feet).
 *   ULTRA         ≈ 65 body points + repeat samples, CAPPED (see POINT_CAP) so a session
 *                 stays reasonable: bust points, underbust, high-hip depth, neck base,
 *                 knee girth and left-side symmetry chains.
 *
 * Every step captures 1–2 landmarks SIMULTANEOUSLY (both points in the same
 * stable window), which removes body sway between the two endpoints. Steps that
 * must be sequential are marked so their uncertainty includes a movement term.
 */
export type CapturePoint = { landmark: string; controller: "left" | "right"; use: "tip" | "grip" };

export type CaptureStep = {
  id: string;
  kind: "tip-calibration" | "floor" | "stance" | "landmarks";
  title: string;
  titleFr: string;
  /** Where to put the tips. */
  instruction: string;
  /** How to stand. */
  stand: string;
  /** How to hold the controllers. */
  hold: string;
  /** Why this matters (shown as a one-liner). */
  why: string;
  /** Short pose cue shown in the chip. */
  cue: string;
  points: CapturePoint[];
  profiles: ProfileKind[];
  /** Pairs with the previous step and the user must hold still between them. */
  sequentialWith?: string;
  section: "Calibrate" | "Head & neck" | "Shoulders & arms" | "Torso" | "Legs & feet";
  pose: string;
};

/** Maximum landmark samples (points incl. repeats) per session. */
export const POINT_CAP: Record<ProfileKind, number> = { simple: 20, intermediate: 80, ultra: 120 };
export const PROFILE_INFO: Record<ProfileKind, { title: string; minutes: number; blurb: string }> = {
  simple: { title: "Simple", minutes: 3, blurb: "10 points · quick sizing · girths estimated" },
  intermediate: { title: "Intermediate", minutes: 12, blurb: "≈ 50 points · tailor essentials · girths measured" },
  ultra: { title: "Ultra", minutes: 18, blurb: "≈ 65 points + repeats (max 120) · full tailoring set" },
};

const S: ProfileKind[] = ["simple", "intermediate", "ultra"];
const I: ProfileKind[] = ["intermediate", "ultra"];
const U: ProfileKind[] = ["ultra"];
const STAND = "Stand straight, feet together, weight on both feet, breathe normally.";
const pair = (l: string, r: string): CapturePoint[] => [{ landmark: l, controller: "left", use: "tip" }, { landmark: r, controller: "right", use: "tip" }];
const one = (lm: string, controller: "left" | "right"): CapturePoint[] => [{ landmark: lm, controller, use: "tip" }];

export const STEPS: CaptureStep[] = [
  // ── CALIBRATE ──────────────────────────────────────────────────────────────
  { id: "cal_floor", kind: "floor", section: "Calibrate", title: "Ground", titleFr: "Sol",
    instruction: "Crouch and touch the floor beside your feet with the RIGHT controller tip. Hold A until the ring fills.",
    stand: "Crouch or bend down — your feet stay where you will stand for the whole session.",
    hold: "Point the right controller straight down so its tip rests on the floor.",
    why: "Every height (you, your waist, your inseam) is measured from this ground plane.",
    cue: "Right tip on the floor", points: one("floor", "right"), profiles: S, pose: "floor" },
  { id: "cal_stance", kind: "stance", section: "Calibrate", title: "Head", titleFr: "Tête",
    instruction: "Stand up straight on the same spot and look straight ahead at the horizon. Hold A.",
    stand: STAND + " Chin level, eyes on the horizon.", hold: "Let your arms relax at your sides with the controllers in your hands.",
    why: "Locates your headset and sets your body axes: left–right (X), up (Y), front–back (Z).",
    cue: "Stand tall · look ahead", points: [], profiles: S, pose: "stand" },
  { id: "cal_tip", kind: "tip-calibration", section: "Calibrate", title: "Instrument", titleFr: "Instrument",
    instruction: "Touch the front tips of both controllers together and hold A. Do it 3 times, turning the controllers to a different angle each time.",
    stand: "Hold your hands in front of your chest.", hold: "Tip touches tip, like clinking glasses. Change the angle between touches.",
    why: "Finds the exact measuring point on your controllers — this makes every later point precise.",
    cue: "Tip to tip · vary the angle", points: [], profiles: S, pose: "tips" },

  // ── HEAD & NECK ────────────────────────────────────────────────────────────
  { id: "crown", kind: "landmarks", section: "Head & neck", title: "Height", titleFr: "Taille",
    instruction: "Lay the RIGHT controller flat on the very top of your head so the tip touches your crown.",
    stand: STAND + " Heels down, don't stretch upward.", hold: "Right controller lying flat on your head, pointing forward.",
    why: "Your full height, measured from the ground you set.", cue: "Right tip on crown", points: one("top_of_head", "right"), profiles: S, pose: "crown" },
  { id: "neck_sides", kind: "landmarks", section: "Head & neck", title: "Neck breadth", titleFr: "Largeur du cou",
    instruction: "Lightly touch both sides of your neck, halfway up, with the two controller tips.",
    stand: STAND + " Head straight, don't tilt.", hold: "Left tip on the left side, right tip on the right side. Don't press in.",
    why: "Neck width (X) for collars and the neck circumference.", cue: "Tips on neck sides", points: pair("neck_side_l", "neck_side_r"), profiles: I, pose: "neck_sides" },
  { id: "neck_fb", kind: "landmarks", section: "Head & neck", title: "Neck depth · nape", titleFr: "Profondeur du cou · nuque",
    instruction: "LEFT tip on the front of your neck just below the Adam's apple. RIGHT tip on the bony bump at the base of the back of your neck (C7).",
    stand: STAND, hold: "Left hand in front, right hand reaches behind your neck.",
    why: "Neck depth (Z), and the nape point that starts your back length.", cue: "Left throat · right nape",
    points: [{ landmark: "neck_front", controller: "left", use: "tip" }, { landmark: "nape", controller: "right", use: "tip" }], profiles: I, pose: "neck_fb" },
  { id: "neck_base_fb", kind: "landmarks", section: "Head & neck", title: "Neck base", titleFr: "Base du cou",
    instruction: "LEFT tip in the notch at the top of your breastbone (between the collarbones). RIGHT tip on the C7 bump at the back of your neck.",
    stand: STAND, hold: "Left in front at the notch, right behind.",
    why: "Neck-base depth for shirt collars (a tailor's neck size).", cue: "Breastbone notch · C7",
    points: [{ landmark: "neck_base_front", controller: "left", use: "tip" }, { landmark: "nape_base", controller: "right", use: "tip" }], profiles: U, pose: "neck_base" },
  { id: "hps", kind: "landmarks", section: "Head & neck", title: "Neck-shoulder points", titleFr: "Points d'encolure",
    instruction: "Tips on top of each shoulder right where it meets the neck — where a shirt's shoulder seam starts.",
    stand: STAND + " Shoulders relaxed.", hold: "Cross your arms if it's easier: left tip on the right side, right tip on the left side, or each tip on its own side.",
    why: "High point shoulder (HPS): shoulder length, shoulder slope and garment length all start here.", cue: "Tips where the neck meets the shoulders",
    points: pair("hps_l", "hps_r"), profiles: I, pose: "hps" },

  // ── SHOULDERS & ARMS ───────────────────────────────────────────────────────
  { id: "acromions", kind: "landmarks", section: "Shoulders & arms", title: "Shoulder width", titleFr: "Largeur d'épaules",
    instruction: "Cross your arms. Put the LEFT tip on the bony point at the top of your RIGHT shoulder and the RIGHT tip on your LEFT shoulder.",
    stand: STAND + " Shoulders relaxed — don't shrug.", hold: "Arms crossed in an X. Find the bony knob where the shoulder top ends (acromion).",
    why: "Shoulder width is the most important T-shirt measurement.", cue: "Cross arms · tips on shoulder bones",
    points: [{ landmark: "acromion_r", controller: "left", use: "tip" }, { landmark: "acromion_l", controller: "right", use: "tip" }], profiles: S, pose: "cross" },
  { id: "arm_top", kind: "landmarks", section: "Shoulders & arms", title: "Arm · shoulder", titleFr: "Bras · épaule",
    instruction: "Let your RIGHT arm hang straight and relaxed. Touch the LEFT tip to the bony point of your RIGHT shoulder.",
    stand: STAND, hold: "Right arm hangs straight down, palm facing your thigh. Left controller does the touching.",
    why: "Start of the arm and sleeve length.", cue: "Right arm hangs · left tip on shoulder", points: one("arm_acromion_r", "left"), profiles: I, pose: "arm_top" },
  { id: "arm_elbow", kind: "landmarks", section: "Shoulders & arms", title: "Arm · elbow", titleFr: "Bras · coude",
    instruction: "Keep the RIGHT arm exactly where it is. Move the LEFT tip to the bony point on the outside of your RIGHT elbow.",
    stand: STAND, hold: "Don't move the right arm.", why: "Splits the arm into upper arm and forearm.",
    cue: "Don't move the right arm", sequentialWith: "arm_top", points: one("elbow_r", "left"), profiles: I, pose: "arm_elbow" },
  { id: "arm_wrist", kind: "landmarks", section: "Shoulders & arms", title: "Arm · wrist", titleFr: "Bras · poignet",
    instruction: "Let your RIGHT arm hang straight. Touch the LEFT tip to the bony bump on the outside of your RIGHT wrist.",
    stand: STAND, hold: "Right arm hangs still; the left controller does the touching.",
    why: "Arm length — long sleeves and jackets.", cue: "Right arm hangs · left tip on wrist", sequentialWith: "arm_top", points: one("wrist_r", "left"), profiles: S, pose: "arm_wrist" },
  { id: "arm_top_l", kind: "landmarks", section: "Shoulders & arms", title: "Left arm · shoulder", titleFr: "Bras gauche · épaule",
    instruction: "Now the other side: LEFT arm hangs straight. Touch the RIGHT tip to the bony point of your LEFT shoulder.",
    stand: STAND, hold: "Left arm hangs straight; the right controller does the touching.",
    why: "Left/right symmetry — many people's arms differ by 1–2 cm.", cue: "Left arm hangs · right tip on shoulder", points: one("arm_acromion_l", "right"), profiles: U, pose: "arm_top_l" },
  { id: "arm_elbow_l", kind: "landmarks", section: "Shoulders & arms", title: "Left arm · elbow", titleFr: "Bras gauche · coude",
    instruction: "Keep the LEFT arm still. RIGHT tip on the outside of your LEFT elbow.", stand: STAND, hold: "Don't move the left arm.",
    why: "Left upper arm and forearm.", cue: "Don't move the left arm", sequentialWith: "arm_top_l", points: one("elbow_l", "right"), profiles: U, pose: "arm_elbow_l" },
  { id: "arm_wrist_l", kind: "landmarks", section: "Shoulders & arms", title: "Left arm · wrist", titleFr: "Bras gauche · poignet",
    instruction: "Keep the LEFT arm still. RIGHT tip on the bony bump on the outside of your LEFT wrist.", stand: STAND, hold: "Don't move the left arm.",
    why: "Left arm length (symmetry).", cue: "Don't move the left arm", sequentialWith: "arm_top_l", points: one("wrist_l", "right"), profiles: U, pose: "arm_wrist_l" },
  { id: "span", kind: "landmarks", section: "Shoulders & arms", title: "Arm span", titleFr: "Envergure",
    instruction: "Extend both arms straight out to the sides at shoulder height, like the Vitruvian Man.",
    stand: STAND, hold: "Hold the controllers normally, arms fully straight.", why: "Da Vinci's check: arm span ≈ height. Catches errors in other steps.",
    cue: "Arms out · T-pose", points: [{ landmark: "hand_l", controller: "left", use: "grip" }, { landmark: "hand_r", controller: "right", use: "grip" }], profiles: I, pose: "tpose" },

  // ── TORSO ──────────────────────────────────────────────────────────────────
  { id: "across_front", kind: "landmarks", section: "Torso", title: "Across front", titleFr: "Carrure devant",
    instruction: "Arms relaxed. Tips on the front armpit creases — where your arms meet your chest when hanging.",
    stand: STAND, hold: "Tips pointing back at the creases, left on left, right on right.",
    why: "Tailor's chest width between the arms — sets the front of a jacket or shirt.", cue: "Tips on front armpit creases", points: pair("front_armpit_l", "front_armpit_r"), profiles: I, pose: "across_front" },
  { id: "across_back", kind: "landmarks", section: "Torso", title: "Across back", titleFr: "Carrure dos",
    instruction: "Reach behind you: tips on the back armpit creases, where the arms meet the back.",
    stand: STAND, hold: "Cross your arms behind you if needed; tips on the creases at shoulder-blade level.",
    why: "Tailor's back width — mobility of a jacket's back.", cue: "Tips on back armpit creases", points: pair("back_armpit_l", "back_armpit_r"), profiles: I, pose: "across_back" },
  { id: "axilla", kind: "landmarks", section: "Torso", title: "Armhole depth", titleFr: "Profondeur d'emmanchure",
    instruction: "Hold the RIGHT controller upright and touch its tip up into your RIGHT armpit (gently).",
    stand: STAND + " Arm slightly away from the body.", hold: "Right controller vertical, tip pointing up into the armpit.",
    why: "Scye depth: nape to armpit — where a sleeve's armhole sits.", cue: "Right tip up in the armpit", points: one("axilla_r", "right"), profiles: I, pose: "axilla" },
  { id: "bust_points", kind: "landmarks", section: "Torso", title: "Bust points", titleFr: "Pointes de poitrine",
    instruction: "Tips lightly on the most prominent point of each side of the chest (bust points / nipples) — over clothing is fine.",
    stand: STAND, hold: "Left tip on the left, right tip on the right.",
    why: "Apex-to-apex and shoulder-to-apex: dart and bust shaping for fitted garments.", cue: "Tips on bust points", points: pair("bust_point_l", "bust_point_r"), profiles: U, pose: "bust_points" },
  { id: "chest_sides", kind: "landmarks", section: "Torso", title: "Chest breadth", titleFr: "Largeur poitrine",
    instruction: "Press each controller tip against the side of your ribcage at nipple level, just under the armpits.",
    stand: STAND + " Breathe out normally, then hold.", hold: "Elbows out, tips pointing inward at your sides.",
    why: "Chest width (X). With chest depth it gives the chest circumference.", cue: "Tips on ribcage sides", points: pair("chest_side_l", "chest_side_r"), profiles: S, pose: "sides_chest" },
  { id: "chest_fb", kind: "landmarks", section: "Torso", title: "Chest depth", titleFr: "Profondeur poitrine",
    instruction: "LEFT tip on your breastbone at nipple level. Reach the RIGHT hand behind your back and touch your spine at the same height.",
    stand: STAND, hold: "Left hand in front, right hand behind your back.", why: "Chest depth (Z) — front to back.",
    cue: "Left front · right behind back", points: [{ landmark: "chest_front", controller: "left", use: "tip" }, { landmark: "chest_back", controller: "right", use: "tip" }], profiles: I, pose: "fb_chest" },
  { id: "underbust_sides", kind: "landmarks", section: "Torso", title: "Underbust breadth", titleFr: "Largeur sous-poitrine",
    instruction: "Tips on the sides of your ribcage directly under the bust (bra-band level).", stand: STAND + " Breathe out.", hold: "Tips pointing inward.",
    why: "Underbust girth — bras, fitted tops, dresses.", cue: "Tips under the bust, at the sides", points: pair("underbust_side_l", "underbust_side_r"), profiles: U, pose: "underbust_sides" },
  { id: "underbust_fb", kind: "landmarks", section: "Torso", title: "Underbust depth", titleFr: "Profondeur sous-poitrine",
    instruction: "Same height: LEFT tip on the front under the bust, RIGHT tip on your spine behind.", stand: STAND, hold: "Left front, right behind.",
    why: "Underbust depth → underbust circumference.", cue: "Left front · right behind",
    points: [{ landmark: "underbust_front", controller: "left", use: "tip" }, { landmark: "underbust_back", controller: "right", use: "tip" }], profiles: U, pose: "underbust_fb" },
  { id: "waist_sides", kind: "landmarks", section: "Torso", title: "Waist breadth", titleFr: "Largeur taille",
    instruction: "Tips on the sides of your waist at its narrowest point (usually just above the navel).", stand: STAND + " Don't suck in.", hold: "Tips pointing inward at your sides.",
    why: "Waist width (X) and your waist height above the ground (Y).", cue: "Tips on waist sides", points: pair("waist_side_l", "waist_side_r"), profiles: S, pose: "sides_waist" },
  { id: "waist_fb", kind: "landmarks", section: "Torso", title: "Waist depth", titleFr: "Profondeur taille",
    instruction: "LEFT tip on the front of your waist, RIGHT tip on your spine behind, same height.", stand: STAND, hold: "Left hand in front, right hand behind.",
    why: "Waist depth (Z) → waist circumference, and front/back waist length.", cue: "Left front · right behind",
    points: [{ landmark: "waist_front", controller: "left", use: "tip" }, { landmark: "waist_back", controller: "right", use: "tip" }], profiles: I, pose: "fb_waist" },
  { id: "high_hip_sides", kind: "landmarks", section: "Torso", title: "High hip breadth", titleFr: "Largeur haute des hanches",
    instruction: "Tips on the top of your hip bones (iliac crest) — where a low-rise waistband sits.", stand: STAND, hold: "Tips pointing inward.",
    why: "High hip: where jeans and trousers actually sit.", cue: "Tips on the top of the hip bones", points: pair("high_hip_side_l", "high_hip_side_r"), profiles: I, pose: "high_hip_sides" },
  { id: "high_hip_fb", kind: "landmarks", section: "Torso", title: "High hip depth", titleFr: "Profondeur haute des hanches",
    instruction: "Same height: LEFT tip on the front, RIGHT tip on your lower back.", stand: STAND, hold: "Left front, right behind.",
    why: "High hip depth → high hip circumference.", cue: "Left front · right lower back",
    points: [{ landmark: "high_hip_front", controller: "left", use: "tip" }, { landmark: "high_hip_back", controller: "right", use: "tip" }], profiles: U, pose: "high_hip_fb" },
  { id: "hip_sides", kind: "landmarks", section: "Torso", title: "Hip breadth", titleFr: "Largeur hanches",
    instruction: "Tips on the outside of your hips at the widest point (over the hip bones).", stand: STAND, hold: "Tips pointing inward at your hips.",
    why: "Hip width (X) for trousers, skirts and tops.", cue: "Tips on widest hip point", points: pair("hip_side_l", "hip_side_r"), profiles: S, pose: "sides_hip" },
  { id: "hip_fb", kind: "landmarks", section: "Torso", title: "Hip depth", titleFr: "Profondeur hanches",
    instruction: "LEFT tip on the front of your hips, RIGHT tip on the most prominent point of the buttocks, same height.", stand: STAND, hold: "Left hand in front, right hand behind.",
    why: "Hip depth (Z) → hip (seat) circumference.", cue: "Left front · right on buttocks",
    points: [{ landmark: "hip_front", controller: "left", use: "tip" }, { landmark: "hip_back", controller: "right", use: "tip" }], profiles: I, pose: "fb_hip" },

  // ── LEGS & FEET ────────────────────────────────────────────────────────────
  { id: "crotch", kind: "landmarks", section: "Legs & feet", title: "Inseam", titleFr: "Entrejambe",
    instruction: "Hold the RIGHT controller upright with its tip touching the top of your inner thigh at the crotch.",
    stand: STAND + " Feet slightly apart.", hold: "Right controller vertical, tip pointing up.",
    why: "Inside-leg length (Y) for trousers.", cue: "Right tip at crotch", points: one("crotch", "right"), profiles: I, pose: "crotch" },
  { id: "thigh_sides", kind: "landmarks", section: "Legs & feet", title: "Thigh breadth", titleFr: "Largeur de cuisse",
    instruction: "At the fullest part of your RIGHT thigh (just below the crotch): RIGHT tip on the outside, LEFT tip on the inside.",
    stand: STAND + " Feet hip-width apart, weight on both legs.", hold: "Left hand reaches between your legs; tips pointing at each other.",
    why: "Thigh width (X) → thigh circumference for trousers and jeans.", cue: "Right outside · left inside the thigh",
    points: [{ landmark: "thigh_out_r", controller: "right", use: "tip" }, { landmark: "thigh_in_r", controller: "left", use: "tip" }], profiles: I, pose: "thigh_sides" },
  { id: "thigh_fb", kind: "landmarks", section: "Legs & feet", title: "Thigh depth", titleFr: "Profondeur de cuisse",
    instruction: "Same height: LEFT tip on the front of your RIGHT thigh, RIGHT tip on the back of it.", stand: STAND + " Don't tense the leg.", hold: "Left in front, right reaching behind.",
    why: "Thigh depth (Z) → thigh circumference.", cue: "Left front · right back of thigh",
    points: [{ landmark: "thigh_front_r", controller: "left", use: "tip" }, { landmark: "thigh_back_r", controller: "right", use: "tip" }], profiles: I, pose: "thigh_fb" },
  { id: "knee", kind: "landmarks", section: "Legs & feet", title: "Knee height", titleFr: "Hauteur du genou",
    instruction: "Touch the RIGHT tip to the outside of your right knee at the joint line.", stand: STAND + " Leg straight.", hold: "Bend at the waist if needed — keep the knee straight.",
    why: "Knee position for shorts, skirts and trouser shaping.", cue: "Right tip on knee joint", points: one("knee_r", "right"), profiles: I, pose: "knee" },
  { id: "knee_sides", kind: "landmarks", section: "Legs & feet", title: "Knee breadth", titleFr: "Largeur du genou",
    instruction: "At the middle of your RIGHT knee: RIGHT tip on the outside, LEFT tip on the inside.", stand: STAND + " Leg straight.", hold: "Tips pointing at each other.",
    why: "Knee girth for slim trousers and boots.", cue: "Right outside · left inside the knee",
    points: [{ landmark: "knee_out_r", controller: "right", use: "tip" }, { landmark: "knee_in_r", controller: "left", use: "tip" }], profiles: U, pose: "knee_sides" },
  { id: "knee_fb", kind: "landmarks", section: "Legs & feet", title: "Knee depth", titleFr: "Profondeur du genou",
    instruction: "Same height: LEFT tip on the kneecap, RIGHT tip at the back of the knee.", stand: STAND, hold: "Left front, right behind.",
    why: "Knee depth → knee circumference.", cue: "Left kneecap · right back",
    points: [{ landmark: "knee_front_r", controller: "left", use: "tip" }, { landmark: "knee_back_r", controller: "right", use: "tip" }], profiles: U, pose: "knee_fb" },
  { id: "knee_l", kind: "landmarks", section: "Legs & feet", title: "Left knee height", titleFr: "Hauteur du genou gauche",
    instruction: "Touch the LEFT tip to the outside of your left knee at the joint line.", stand: STAND + " Leg straight.", hold: "Left controller does the touching.",
    why: "Left/right leg symmetry.", cue: "Left tip on left knee joint", points: one("knee_l", "left"), profiles: U, pose: "knee_l" },
  { id: "calf_sides", kind: "landmarks", section: "Legs & feet", title: "Calf breadth", titleFr: "Largeur du mollet",
    instruction: "Bend down. At the widest part of your RIGHT calf: RIGHT tip on the outside, LEFT tip on the inside.",
    stand: "Stand on both feet; bend at the hips, keep the right leg straight and relaxed.", hold: "Tips pointing at each other across the calf.",
    why: "Calf width (X) → calf circumference for boots, socks and slim trousers.", cue: "Right outside · left inside the calf",
    points: [{ landmark: "calf_out_r", controller: "right", use: "tip" }, { landmark: "calf_in_r", controller: "left", use: "tip" }], profiles: I, pose: "calf_sides" },
  { id: "calf_fb", kind: "landmarks", section: "Legs & feet", title: "Calf depth", titleFr: "Profondeur du mollet",
    instruction: "Same height: LEFT tip on your shin, RIGHT tip on the back of the calf muscle.", stand: "Bend at the hips, right leg straight.", hold: "Left in front, right behind.",
    why: "Calf depth (Z) → calf circumference.", cue: "Left shin · right calf",
    points: [{ landmark: "calf_front_r", controller: "left", use: "tip" }, { landmark: "calf_back_r", controller: "right", use: "tip" }], profiles: I, pose: "calf_fb" },
  { id: "ankle", kind: "landmarks", section: "Legs & feet", title: "Ankle height", titleFr: "Hauteur de cheville",
    instruction: "Touch the RIGHT tip to the bony bump on the outside of your right ankle.", stand: STAND, hold: "Crouch; keep the foot flat.",
    why: "Where trousers break and socks end.", cue: "Right tip on ankle bone", points: one("ankle_r", "right"), profiles: I, pose: "ankle" },
  { id: "ankle_l", kind: "landmarks", section: "Legs & feet", title: "Left ankle height", titleFr: "Hauteur de cheville gauche",
    instruction: "Touch the LEFT tip to the bony bump on the outside of your left ankle.", stand: STAND, hold: "Crouch; keep the foot flat.",
    why: "Left/right leg symmetry.", cue: "Left tip on left ankle bone", points: one("ankle_l", "left"), profiles: U, pose: "ankle_l" },
  { id: "foot", kind: "landmarks", section: "Legs & feet", title: "Foot length", titleFr: "Longueur du pied",
    instruction: "Crouch. RIGHT tip on the floor touching the back of your right heel, LEFT tip on the floor at the tip of your longest toe.",
    stand: "Right foot flat on the floor, weight on it.", hold: "Both controllers pointing down to the floor.",
    why: "Foot length → shoe size (or type your shoe size in About you).", cue: "Heel and toe on the floor",
    points: [{ landmark: "heel_r", controller: "right", use: "tip" }, { landmark: "toe_r", controller: "left", use: "tip" }], profiles: I, pose: "foot" },
];

export const stepsFor = (p: ProfileKind) => STEPS.filter((s) => s.profiles.includes(p));

/** Body points (landmark captures) per mode, excluding ground & head calibration. */
export const bodyPointsFor = (p: ProfileKind) => stepsFor(p).filter((s) => s.kind === "landmarks").reduce((a, s) => a + s.points.length, 0);
