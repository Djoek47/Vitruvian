import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { BodyPassport } from "../passport/passport";

/**
 * AVATAR SLOT — load a rigged human .glb (e.g. a MetaHuman body exported from
 * Unreal at a low LOD, or the UE5 Manny/Quinn mannequin) and fit its skeleton
 * to the Body Passport:
 *   1. uniform scale → measured height
 *   2. bone-chain lengths → measured upper arm, forearm, thigh, shin, shoulder width
 *      (child joint offsets are rescaled along the bone, so limbs stretch without
 *      changing thickness)
 * Girths are NOT reshaped here (that needs MetaHuman Creator's body solver in
 * Unreal, driven by the exported targets); the twin shows the measured girths.
 *
 * Bone names: UE5 / MetaHuman skeleton (pelvis, spine_01…, clavicle_l, upperarm_l,
 * lowerarm_l, hand_l, thigh_l, calf_l, foot_l, head) with Mixamo fallbacks.
 */
const ALIASES: Record<string, string[]> = {
  pelvis: ["pelvis", "mixamorig:Hips", "Hips"],
  head: ["head", "mixamorig:Head", "Head"],
  neck: ["neck_01", "mixamorig:Neck", "Neck"],
  clavicle_l: ["clavicle_l", "mixamorig:LeftShoulder"],
  clavicle_r: ["clavicle_r", "mixamorig:RightShoulder"],
  upperarm_l: ["upperarm_l", "mixamorig:LeftArm", "LeftUpperArm"],
  upperarm_r: ["upperarm_r", "mixamorig:RightArm", "RightUpperArm"],
  lowerarm_l: ["lowerarm_l", "mixamorig:LeftForeArm", "LeftLowerArm"],
  lowerarm_r: ["lowerarm_r", "mixamorig:RightForeArm", "RightLowerArm"],
  hand_l: ["hand_l", "mixamorig:LeftHand", "LeftHand"],
  hand_r: ["hand_r", "mixamorig:RightHand", "RightHand"],
  thigh_l: ["thigh_l", "mixamorig:LeftUpLeg", "LeftUpperLeg"],
  thigh_r: ["thigh_r", "mixamorig:RightUpLeg", "RightUpperLeg"],
  calf_l: ["calf_l", "mixamorig:LeftLeg", "LeftLowerLeg"],
  calf_r: ["calf_r", "mixamorig:RightLeg", "RightLowerLeg"],
  foot_l: ["foot_l", "mixamorig:LeftFoot", "LeftFoot"],
  foot_r: ["foot_r", "mixamorig:RightFoot", "RightFoot"],
};

export type AvatarFit = { ok: boolean; scale: number; adjusted: { segment: string; fromCm: number; toCm: number }[]; missingBones: string[]; note: string };

export class AvatarSlot {
  readonly group = new THREE.Group();
  root: THREE.Object3D | null = null;
  private bones: Record<string, THREE.Bone> = {};
  private rest = new Map<THREE.Bone, THREE.Vector3>();
  private baseHeight = 0;
  lastFit: AvatarFit | null = null;

  async load(src: string | ArrayBuffer): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = typeof src === "string" ? await loader.loadAsync(src) : await loader.parseAsync(src, "");
    if (this.root) this.group.remove(this.root);
    this.root = gltf.scene;
    this.bones = {};
    this.rest.clear();
    const all: THREE.Bone[] = [];
    gltf.scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) all.push(o as THREE.Bone);
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.frustumCulled = false;
        m.castShadow = false;
      }
    });
    for (const [key, names] of Object.entries(ALIASES)) {
      const b = all.find((x) => names.some((n) => x.name.toLowerCase() === n.toLowerCase()));
      if (b) this.bones[key] = b;
    }
    for (const b of all) this.rest.set(b, b.position.clone());
    this.group.add(gltf.scene);
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    this.baseHeight = box.max.y - box.min.y;
    gltf.scene.position.y -= box.min.y;
  }

  private wp(key: string) {
    return this.bones[key]?.getWorldPosition(new THREE.Vector3()) ?? null;
  }

  /** Fit skeleton lengths to the passport (metres in scene). */
  fit(p: BodyPassport): AvatarFit {
    const fit: AvatarFit = { ok: false, scale: 1, adjusted: [], missingBones: Object.keys(ALIASES).filter((k) => !this.bones[k]), note: "" };
    if (!this.root) return { ...fit, note: "No avatar loaded" };
    for (const [b, v] of this.rest) b.position.copy(v);
    const m = Object.fromEntries(p.measurements.map((x) => [x.id, x.value / 1000]));
    const H = m.height ?? 1.75;
    const s = this.baseHeight > 0 ? H / this.baseHeight : 1;
    this.root.scale.setScalar(s);
    this.root.updateMatrixWorld(true);
    fit.scale = s;
    const setLen = (parent: string, child: string, target: number | undefined, label: string) => {
      const a = this.wp(parent);
      const c = this.bones[child];
      const b = this.wp(child);
      if (!a || !b || !c || !target) return;
      const cur = a.distanceTo(b);
      if (cur < 1e-4) return;
      c.position.multiplyScalar(target / cur);
      this.root!.updateMatrixWorld(true);
      fit.adjusted.push({ segment: label, fromCm: +(cur * 100).toFixed(1), toCm: +(target * 100).toFixed(1) });
    };
    const kneeY = m.knee_height;
    const thigh = m.inseam && kneeY ? m.inseam - kneeY : undefined;
    const shin = kneeY && m.ankle_height ? kneeY - m.ankle_height : undefined;
    for (const side of ["l", "r"]) {
      setLen(`upperarm_${side}`, `lowerarm_${side}`, m.upper_arm_length, `upper arm ${side}`);
      setLen(`lowerarm_${side}`, `hand_${side}`, m.forearm_length ?? (m.arm_length && m.upper_arm_length ? m.arm_length - m.upper_arm_length : undefined), `forearm ${side}`);
      setLen(`thigh_${side}`, `calf_${side}`, thigh, `thigh ${side}`);
      setLen(`calf_${side}`, `foot_${side}`, shin, `shin ${side}`);
    }
    // shoulder joints: spread the upper-arm joints to (biacromial − 2 × 2.5 cm joint inset)
    const ul = this.wp("upperarm_l");
    const ur = this.wp("upperarm_r");
    if (ul && ur && m.shoulder_width && this.bones.upperarm_l && this.bones.upperarm_r) {
      const cur = ul.distanceTo(ur);
      const target = Math.max(0.2, m.shoulder_width - 0.05);
      const k = target / cur;
      for (const side of ["l", "r"]) this.bones[`upperarm_${side}`].position.multiplyScalar(k);
      this.root.updateMatrixWorld(true);
      fit.adjusted.push({ segment: "shoulder joints", fromCm: +(cur * 100).toFixed(1), toCm: +(target * 100).toFixed(1) });
    }
    // re-ground after length changes
    const box = new THREE.Box3().setFromObject(this.root);
    this.root.position.y -= box.min.y;
    fit.ok = true;
    fit.note = fit.missingBones.length ? `Bones not found: ${fit.missingBones.join(", ")}` : "Skeleton fitted to passport lengths; girths are shown by the twin.";
    this.lastFit = fit;
    return fit;
  }
}
