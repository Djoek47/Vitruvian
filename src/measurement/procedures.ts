import type { ProfileKind } from "./types";

/**
 * Guided capture steps, in the order the user performs them:
 *   GROUND → HEAD → INSTRUMENT → head/neck → shoulders → arms → torso → hips → legs → feet
 *
 * Every step captures 1–2 landmarks SIMULTANEOUSLY (both points in the same
 * stable window), which removes body sway between the two endpoints. Steps
 * that must be sequential are marked so their uncertainty includes a movement term.
 *
 * Each step carries the full coaching text: how to stand, how to hold the
 * controllers, what to press, and why the step matters.
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
  /** Section header in the step list. */
  section: "Calibrate" | "Head & neck" | "Shoulders & arms" | "Torso" | "Legs & feet";
  /** Figure pose key used by the body-figure renderer. */
  pose: string;
};

const BOTH: ProfileKind[] = ["quick", "precision"];
const PRE: ProfileKind[] = ["precision"];
const STAND = "Stand straight, feet together, weight on both feet, breathe normally.";

export const STEPS: CaptureStep[] = [
  // ── CALIBRATE ──────────────────────────────────────────────────────────────
  {
    id: "cal_floor", kind: "floor", section: "Calibrate", title: "Ground", titleFr: "Sol",
    instruction: "Crouch and touch the floor beside your feet with the RIGHT controller tip. Hold A until the ring fills.",
    stand: "Crouch or bend down — your feet stay where you will stand for the whole session.",
    hold: "Point the right controller straight down so its tip rests on the floor.",
    why: "Every height (you, your waist, your inseam) is measured from this ground plane.",
    cue: "Right tip on the floor", points: [{ landmark: "floor", controller: "right", use: "tip" }], profiles: BOTH, pose: "floor",
  },
  {
    id: "cal_stance", kind: "stance", section: "Calibrate", title: "Head", titleFr: "Tête",
    instruction: "Stand up straight on the same spot and look straight ahead at the horizon. Hold A.",
    stand: STAND + " Chin level, eyes on the horizon.",
    hold: "Let your arms relax at your sides with the controllers in your hands.",
    why: "Locates your headset and sets your body axes: left–right (X), up (Y), front–back (Z).",
    cue: "Stand tall · look ahead", points: [], profiles: BOTH, pose: "stand",
  },
  {
    id: "cal_tip", kind: "tip-calibration", section: "Calibrate", title: "Instrument", titleFr: "Instrument",
    instruction: "Touch the front tips of both controllers together and hold A. Do it 3 times, turning the controllers to a different angle each time.",
    stand: "Hold your hands in front of your chest.",
    hold: "Tip touches tip, like clinking glasses. Change the angle between touches.",
    why: "Finds the exact measuring point on your controllers — this makes every later point precise.",
    cue: "Tip to tip · vary the angle", points: [], profiles: BOTH, pose: "tips",
  },
  // ── HEAD & NECK ────────────────────────────────────────────────────────────
  {
    id: "crown", kind: "landmarks", section: "Head & neck", title: "Height", titleFr: "Taille",
    instruction: "Lay the RIGHT controller flat on the very top of your head so the tip touches your crown.",
    stand: STAND + " Heels down, don't stretch upward.",
    hold: "Right controller lying flat on your head, pointing forward.",
    why: "Your full height, measured from the ground you set.",
    cue: "Right tip on crown", points: [{ landmark: "top_of_head", controller: "right", use: "tip" }], profiles: BOTH, pose: "crown",
  },
  {
    id: "neck_sides", kind: "landmarks", section: "Head & neck", title: "Neck breadth", titleFr: "Largeur du cou",
    instruction: "Lightly touch both sides of your neck, halfway up, with the two controller tips.",
    stand: STAND + " Head straight, don't tilt.",
    hold: "Left tip on the left side of your neck, right tip on the right side. Don't press in.",
    why: "Neck width (X) for collars and the neck circumference.",
    cue: "Tips on neck sides",
    points: [{ landmark: "neck_side_l", controller: "left", use: "tip" }, { landmark: "neck_side_r", controller: "right", use: "tip" }], profiles: PRE, pose: "neck_sides",
  },
  {
    id: "neck_fb", kind: "landmarks", section: "Head & neck", title: "Neck depth · nape", titleFr: "Profondeur du cou · nuque",
    instruction: "LEFT tip on the front of your neck just below the Adam's apple. RIGHT tip on the bony bump at the base of the back of your neck (C7).",
    stand: STAND,
    hold: "Left hand in front, right hand reaches behind your neck.",
    why: "Neck depth (Z), and the nape point that starts your back length.",
    cue: "Left throat · right nape",
    points: [{ landmark: "neck_front", controller: "left", use: "tip" }, { landmark: "nape", controller: "right", use: "tip" }], profiles: PRE, pose: "neck_fb",
  },
  // ── SHOULDERS & ARMS ───────────────────────────────────────────────────────
  {
    id: "acromions", kind: "landmarks", section: "Shoulders & arms", title: "Shoulder width", titleFr: "Largeur d'épaules",
    instruction: "Cross your arms. Put the LEFT tip on the bony point at the top of your RIGHT shoulder and the RIGHT tip on your LEFT shoulder.",
    stand: STAND + " Shoulders relaxed — don't shrug.",
    hold: "Arms crossed in an X. Find the bony knob where the shoulder top ends (acromion).",
    why: "Shoulder width is the most important T-shirt measurement.",
    cue: "Cross arms · tips on shoulder bones",
    points: [{ landmark: "acromion_r", controller: "left", use: "tip" }, { landmark: "acromion_l", controller: "right", use: "tip" }], profiles: BOTH, pose: "cross",
  },
  {
    id: "arm_top", kind: "landmarks", section: "Shoulders & arms", title: "Arm · shoulder", titleFr: "Bras · épaule",
    instruction: "Let your RIGHT arm hang straight and relaxed. Touch the LEFT tip to the bony point of your RIGHT shoulder.",
    stand: STAND,
    hold: "Right arm hangs straight down, palm facing your thigh. Left controller does the touching.",
    why: "Start of the arm and sleeve length.",
    cue: "Right arm hangs · left tip on shoulder",
    points: [{ landmark: "arm_acromion_r", controller: "left", use: "tip" }], profiles: BOTH, pose: "arm_top",
  },
  {
    id: "arm_elbow", kind: "landmarks", section: "Shoulders & arms", title: "Arm · elbow", titleFr: "Bras · coude",
    instruction: "Keep the RIGHT arm exactly where it is. Move the LEFT tip to the bony point on the outside of your RIGHT elbow.",
    stand: STAND, hold: "Don't move the right arm.",
    why: "Splits the arm into upper arm and forearm.",
    cue: "Don't move the right arm", sequentialWith: "arm_top",
    points: [{ landmark: "elbow_r", controller: "left", use: "tip" }], profiles: PRE, pose: "arm_elbow",
  },
  {
    id: "arm_wrist", kind: "landmarks", section: "Shoulders & arms", title: "Arm · wrist", titleFr: "Bras · poignet",
    instruction: "Keep the RIGHT arm exactly where it is. Move the LEFT tip to the bony bump on the outside of your RIGHT wrist.",
    stand: STAND, hold: "Don't move the right arm.",
    why: "Completes arm length — long-sleeve and jacket fit.",
    cue: "Don't move the right arm", sequentialWith: "arm_top",
    points: [{ landmark: "wrist_r", controller: "left", use: "tip" }], profiles: BOTH, pose: "arm_wrist",
  },
  {
    id: "span", kind: "landmarks", section: "Shoulders & arms", title: "Arm span", titleFr: "Envergure",
    instruction: "Extend both arms straight out to the sides at shoulder height, like the Vitruvian Man.",
    stand: STAND, hold: "Hold the controllers normally, arms fully straight.",
    why: "Da Vinci's check: arm span ≈ height. Catches errors in other steps.",
    cue: "Arms out · T-pose",
    points: [{ landmark: "hand_l", controller: "left", use: "grip" }, { landmark: "hand_r", controller: "right", use: "grip" }], profiles: PRE, pose: "tpose",
  },
  // ── TORSO ──────────────────────────────────────────────────────────────────
  {
    id: "chest_sides", kind: "landmarks", section: "Torso", title: "Chest breadth", titleFr: "Largeur poitrine",
    instruction: "Press each controller tip against the side of your ribcage at nipple level, just under the armpits.",
    stand: STAND + " Breathe out normally, then hold.",
    hold: "Elbows out, tips pointing inward at your sides.",
    why: "Chest width (X). With chest depth it gives the chest circumference.",
    cue: "Tips on ribcage sides",
    points: [{ landmark: "chest_side_l", controller: "left", use: "tip" }, { landmark: "chest_side_r", controller: "right", use: "tip" }], profiles: BOTH, pose: "sides_chest",
  },
  {
    id: "chest_fb", kind: "landmarks", section: "Torso", title: "Chest depth", titleFr: "Profondeur poitrine",
    instruction: "LEFT tip on your breastbone at nipple level. Reach the RIGHT hand behind your back and touch your spine at the same height.",
    stand: STAND,
    hold: "Left hand in front, right hand behind your back.",
    why: "Chest depth (Z) — front to back.",
    cue: "Left front · right behind back",
    points: [{ landmark: "chest_front", controller: "left", use: "tip" }, { landmark: "chest_back", controller: "right", use: "tip" }], profiles: BOTH, pose: "fb_chest",
  },
  {
    id: "waist_sides", kind: "landmarks", section: "Torso", title: "Waist breadth", titleFr: "Largeur taille",
    instruction: "Tips on the sides of your waist at its narrowest point (usually just above the navel).",
    stand: STAND + " Don't suck in.",
    hold: "Tips pointing inward at your sides.",
    why: "Waist width (X) and your waist height above the ground (Y).",
    cue: "Tips on waist sides",
    points: [{ landmark: "waist_side_l", controller: "left", use: "tip" }, { landmark: "waist_side_r", controller: "right", use: "tip" }], profiles: BOTH, pose: "sides_waist",
  },
  {
    id: "waist_fb", kind: "landmarks", section: "Torso", title: "Waist depth", titleFr: "Profondeur taille",
    instruction: "LEFT tip on the front of your waist, RIGHT tip on your spine behind, same height.",
    stand: STAND, hold: "Left hand in front, right hand behind.",
    why: "Waist depth (Z) → waist circumference, and front/back waist length.",
    cue: "Left front · right behind",
    points: [{ landmark: "waist_front", controller: "left", use: "tip" }, { landmark: "waist_back", controller: "right", use: "tip" }], profiles: BOTH, pose: "fb_waist",
  },
  {
    id: "hip_sides", kind: "landmarks", section: "Torso", title: "Hip breadth", titleFr: "Largeur hanches",
    instruction: "Tips on the outside of your hips at the widest point (over the hip bones).",
    stand: STAND, hold: "Tips pointing inward at your hips.",
    why: "Hip width (X) for trousers, skirts and tops.",
    cue: "Tips on widest hip point",
    points: [{ landmark: "hip_side_l", controller: "left", use: "tip" }, { landmark: "hip_side_r", controller: "right", use: "tip" }], profiles: BOTH, pose: "sides_hip",
  },
  {
    id: "hip_fb", kind: "landmarks", section: "Torso", title: "Hip depth", titleFr: "Profondeur hanches",
    instruction: "LEFT tip on the front of your hips, RIGHT tip on the most prominent point of the buttocks, same height.",
    stand: STAND, hold: "Left hand in front, right hand behind.",
    why: "Hip depth (Z) → hip circumference.",
    cue: "Left front · right on buttocks",
    points: [{ landmark: "hip_front", controller: "left", use: "tip" }, { landmark: "hip_back", controller: "right", use: "tip" }], profiles: BOTH, pose: "fb_hip",
  },
  // ── LEGS & FEET ────────────────────────────────────────────────────────────
  {
    id: "crotch", kind: "landmarks", section: "Legs & feet", title: "Inseam", titleFr: "Entrejambe",
    instruction: "Hold the RIGHT controller upright with its tip touching the top of your inner thigh at the crotch.",
    stand: STAND + " Feet slightly apart.", hold: "Right controller vertical, tip pointing up.",
    why: "Inside-leg length (Y) for trousers.",
    cue: "Right tip at crotch", points: [{ landmark: "crotch", controller: "right", use: "tip" }], profiles: PRE, pose: "crotch",
  },
  {
    id: "thigh_sides", kind: "landmarks", section: "Legs & feet", title: "Thigh breadth", titleFr: "Largeur de cuisse",
    instruction: "At the fullest part of your RIGHT thigh (just below the crotch): RIGHT tip on the outside, LEFT tip on the inside.",
    stand: STAND + " Feet hip-width apart, weight on both legs.", hold: "Left hand reaches between your legs; tips pointing at each other.",
    why: "Thigh width (X) → thigh circumference for trousers and jeans.",
    cue: "Right outside · left inside the thigh",
    points: [{ landmark: "thigh_out_r", controller: "right", use: "tip" }, { landmark: "thigh_in_r", controller: "left", use: "tip" }], profiles: PRE, pose: "thigh_sides",
  },
  {
    id: "thigh_fb", kind: "landmarks", section: "Legs & feet", title: "Thigh depth", titleFr: "Profondeur de cuisse",
    instruction: "Same height: LEFT tip on the front of your RIGHT thigh, RIGHT tip on the back of it.",
    stand: STAND + " Don't tense the leg.", hold: "Left in front, right reaching behind.",
    why: "Thigh depth (Z) → thigh circumference.",
    cue: "Left front · right back of thigh",
    points: [{ landmark: "thigh_front_r", controller: "left", use: "tip" }, { landmark: "thigh_back_r", controller: "right", use: "tip" }], profiles: PRE, pose: "thigh_fb",
  },
  {
    id: "calf_sides", kind: "landmarks", section: "Legs & feet", title: "Calf breadth", titleFr: "Largeur du mollet",
    instruction: "Bend down. At the widest part of your RIGHT calf: RIGHT tip on the outside, LEFT tip on the inside.",
    stand: "Stand on both feet; bend at the hips, keep the right leg straight and relaxed.", hold: "Tips pointing at each other across the calf.",
    why: "Calf width (X) → calf circumference for boots, socks and slim trousers.",
    cue: "Right outside · left inside the calf",
    points: [{ landmark: "calf_out_r", controller: "right", use: "tip" }, { landmark: "calf_in_r", controller: "left", use: "tip" }], profiles: PRE, pose: "calf_sides",
  },
  {
    id: "calf_fb", kind: "landmarks", section: "Legs & feet", title: "Calf depth", titleFr: "Profondeur du mollet",
    instruction: "Same height: LEFT tip on your shin, RIGHT tip on the back of the calf muscle.",
    stand: "Bend at the hips, right leg straight.", hold: "Left in front, right behind.",
    why: "Calf depth (Z) → calf circumference.",
    cue: "Left shin · right calf",
    points: [{ landmark: "calf_front_r", controller: "left", use: "tip" }, { landmark: "calf_back_r", controller: "right", use: "tip" }], profiles: PRE, pose: "calf_fb",
  },
  {
    id: "knee", kind: "landmarks", section: "Legs & feet", title: "Knee height", titleFr: "Hauteur du genou",
    instruction: "Touch the RIGHT tip to the outside of your right knee at the joint line.",
    stand: STAND + " Leg straight.", hold: "Bend at the waist if needed — keep the knee straight.",
    why: "Knee position for shorts, skirts and trouser shaping.",
    cue: "Right tip on knee joint", points: [{ landmark: "knee_r", controller: "right", use: "tip" }], profiles: PRE, pose: "knee",
  },
  {
    id: "ankle", kind: "landmarks", section: "Legs & feet", title: "Ankle height", titleFr: "Hauteur de cheville",
    instruction: "Touch the RIGHT tip to the bony bump on the outside of your right ankle.",
    stand: STAND, hold: "Crouch; keep the foot flat.",
    why: "Where trousers break and socks end.",
    cue: "Right tip on ankle bone", points: [{ landmark: "ankle_r", controller: "right", use: "tip" }], profiles: PRE, pose: "ankle",
  },
  {
    id: "foot", kind: "landmarks", section: "Legs & feet", title: "Foot length", titleFr: "Longueur du pied",
    instruction: "Crouch. RIGHT tip on the floor touching the back of your right heel, LEFT tip on the floor at the tip of your longest toe.",
    stand: "Right foot flat on the floor, weight on it.", hold: "Both controllers pointing down to the floor.",
    why: "Foot length → shoe size (or type your shoe size in About you).",
    cue: "Heel and toe on the floor",
    points: [{ landmark: "heel_r", controller: "right", use: "tip" }, { landmark: "toe_r", controller: "left", use: "tip" }], profiles: PRE, pose: "foot",
  },
];

export const stepsFor = (p: ProfileKind) => STEPS.filter((s) => s.profiles.includes(p));
