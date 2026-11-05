/** Anatomical landmark catalogue. `bony` landmarks are palpable and repeatable;
 * soft-tissue landmarks carry a larger placement uncertainty. */
export type LandmarkDef = { id: string; label: string; labelFr: string; placementUncMm: number; region: string };

export const LANDMARKS: Record<string, LandmarkDef> = {};
const L = (id: string, label: string, labelFr: string, placementUncMm: number, region: string) =>
  (LANDMARKS[id] = { id, label, labelFr, placementUncMm, region });

L("floor", "Floor", "Sol", 2, "global");
L("top_of_head", "Top of head (vertex)", "Sommet du crâne", 4, "global");
L("head_device", "Headset reference", "Référence casque", 2, "global");
L("acromion_l", "Left acromion", "Acromion gauche", 5, "torso");
L("acromion_r", "Right acromion", "Acromion droit", 5, "torso");
L("chest_side_l", "Chest side, left (nipple level)", "Flanc thoracique gauche", 7, "torso");
L("chest_side_r", "Chest side, right (nipple level)", "Flanc thoracique droit", 7, "torso");
L("chest_front", "Chest front (sternum, nipple level)", "Sternum", 6, "torso");
L("chest_back", "Back at chest level (spine)", "Dos niveau poitrine", 8, "torso");
L("waist_side_l", "Waist side, left (narrowest)", "Taille gauche", 7, "torso");
L("waist_side_r", "Waist side, right (narrowest)", "Taille droite", 7, "torso");
L("waist_front", "Waist front (navel)", "Taille avant", 7, "torso");
L("waist_back", "Waist back (spine)", "Taille arrière", 7, "torso");
L("hip_side_l", "Hip side, left (widest)", "Hanche gauche", 7, "torso");
L("hip_side_r", "Hip side, right (widest)", "Hanche droite", 7, "torso");
L("hip_front", "Hip front (same height)", "Hanche avant", 8, "torso");
L("hip_back", "Buttocks (most prominent)", "Fesses", 8, "torso");
L("arm_acromion_r", "Right acromion, arm hanging", "Acromion droit, bras tombant", 5, "arms");
L("wrist_r", "Right wrist (ulnar styloid)", "Poignet droit", 4, "arms");
L("neck_side_l", "Neck side, left", "Cou gauche", 5, "head_neck");
L("neck_side_r", "Neck side, right", "Cou droit", 5, "head_neck");
L("neck_front", "Neck front (below Adam's apple)", "Cou avant", 5, "head_neck");
L("nape", "Nape (C7 vertebra)", "Nuque (C7)", 5, "head_neck");
L("crotch", "Crotch (top of inner thigh)", "Entrejambe", 10, "legs");
L("knee_r", "Right knee (joint line, side)", "Genou droit", 6, "legs");
L("elbow_r", "Right elbow (lateral epicondyle)", "Coude droit", 6, "arms");
L("ankle_r", "Right ankle (lateral malleolus)", "Cheville droite", 5, "legs");
L("heel_r", "Right heel (back, on floor)", "Talon droit", 4, "feet");
L("toe_r", "Right longest toe tip (on floor)", "Orteil droit", 4, "feet");
L("thigh_out_r", "Right thigh, outside (fullest)", "Cuisse droite ext.", 7, "legs");
L("thigh_in_r", "Right thigh, inside (fullest)", "Cuisse droite int.", 8, "legs");
L("thigh_front_r", "Right thigh, front", "Cuisse droite avant", 7, "legs");
L("thigh_back_r", "Right thigh, back", "Cuisse droite arrière", 8, "legs");
L("calf_out_r", "Right calf, outside (widest)", "Mollet droit ext.", 6, "legs");
L("calf_in_r", "Right calf, inside (widest)", "Mollet droit int.", 6, "legs");
L("calf_front_r", "Right shin, front", "Tibia droit", 5, "legs");
L("calf_back_r", "Right calf, back", "Mollet droit arrière", 6, "legs");
L("hand_l", "Left hand (grip centre), arms out", "Main gauche", 3, "arms");
L("hand_r", "Right hand (grip centre), arms out", "Main droite", 3, "arms");
