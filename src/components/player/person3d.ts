import { CapsuleGeometry, CylinderGeometry, DoubleSide, Group, SphereGeometry } from "three";
import type { Walker } from "@/lib/types";
import type { Kit } from "./kit3d";

export type Seat = "none" | "pegs" | "pedal";

export interface PersonOptions {
  kind: Walker;
  shirt: string;
  dark: boolean;
  seat?: Seat;
}

export interface Person {
  root: Group;
  update(dt: number, speed: number, moving: boolean): void;
  setCrank(angle: number): void;
}

export const PERSON_HEIGHT = 1.75;
const HIP_Y = 0.905;
const SHOE = "#ffc61a";
const DEG = Math.PI / 180;

interface Limb {
  shoulder: Group;
  elbow: Group;
  hip: Group;
  knee: Group;
  ankle: Group;
}

function smooth(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

export function createPerson(kit: Kit, opts: PersonOptions): Person {
  const ink = opts.dark ? "#e7e8e4" : "#1b1e22";
  const inkMat = kit.mat(ink, { roughness: 0.55 });
  const shirtMat = kit.mat(opts.shirt, { roughness: 0.7 });
  const shoeMat = kit.mat(SHOE, { roughness: 0.5 });
  const skirtMat = kit.own(`skirt|${opts.shirt}`, () => {
    const m = kit.mat(opts.shirt, { roughness: 0.7 }).clone();
    m.side = DoubleSide;
    return m;
  });
  const woman = opts.kind === "woman";
  const man = opts.kind === "man";
  const shoulderX = man ? 0.215 : woman ? 0.175 : 0.19;
  const chestScale = man ? 1.3 : woman ? 1.0 : 1.12;

  const g = {
    chest: kit.geo("p-chest", () => new CapsuleGeometry(0.125, 0.12, 3, 10)),
    belly: kit.geo("p-belly", () => new CapsuleGeometry(0.1, 0.12, 3, 10)),
    hips: kit.geo("p-hips", () => new CapsuleGeometry(0.085, 0.1, 3, 8)),
    neck: kit.geo("p-neck", () => new CapsuleGeometry(0.045, 0.05, 2, 6)),
    head: kit.geo("p-head", () => new SphereGeometry(0.115, 14, 10)),
    bun: kit.geo("p-bun", () => new SphereGeometry(0.055, 8, 6)),
    upper: kit.geo("p-upper", () => new CapsuleGeometry(0.042, 0.2, 2, 6)),
    fore: kit.geo("p-fore", () => new CapsuleGeometry(0.036, 0.18, 2, 6)),
    hand: kit.geo("p-hand", () => new SphereGeometry(0.047, 6, 4)),
    thigh: kit.geo("p-thigh", () => new CapsuleGeometry(0.066, 0.29, 2, 8)),
    shin: kit.geo("p-shin", () => new CapsuleGeometry(0.052, 0.3, 2, 8)),
    foot: kit.geo("p-foot", () => new CapsuleGeometry(0.042, 0.11, 2, 6)),
    skirt: kit.geo("p-skirt", () => new CylinderGeometry(0.14, 0.32, 0.46, 18, 1, true)),
  };

  const root = new Group();
  const pelvis = new Group();
  pelvis.position.y = HIP_Y;
  root.add(pelvis);
  const hips = kit.mesh(g.hips, woman ? shirtMat : inkMat, 0, -0.01, 0);
  hips.rotation.z = Math.PI / 2;
  pelvis.add(hips);
  if (woman && (opts.seat ?? "none") === "none") pelvis.add(kit.mesh(g.skirt, skirtMat, 0, -0.17, 0));

  const torso = new Group();
  pelvis.add(torso);
  const chest = kit.mesh(g.chest, shirtMat, 0, 0.36, 0);
  chest.scale.set(chestScale, 1, 0.78);
  const belly = kit.mesh(g.belly, shirtMat, 0, 0.13, 0);
  belly.scale.set(woman ? 0.95 : 1, 1, 0.8);
  torso.add(chest, belly, kit.mesh(g.neck, inkMat, 0, 0.53, 0));
  const head = kit.mesh(g.head, inkMat, 0, 0.69, -0.01);
  torso.add(head);
  if (woman) torso.add(kit.mesh(g.bun, inkMat, 0, 0.76, 0.085));

  const limbs: Limb[] = [-1, 1].map((side) => {
    const shoulder = new Group();
    shoulder.position.set(side * shoulderX, 0.47, 0);
    shoulder.add(kit.mesh(g.upper, inkMat, 0, -0.145, 0));
    const elbow = new Group();
    elbow.position.y = -0.29;
    elbow.add(kit.mesh(g.fore, inkMat, 0, -0.125, 0), kit.mesh(g.hand, inkMat, 0, -0.265, 0));
    shoulder.add(elbow);
    torso.add(shoulder);

    const hip = new Group();
    hip.position.set(side * (woman ? 0.085 : 0.09), -0.02, 0);
    hip.add(kit.mesh(g.thigh, inkMat, 0, -0.215, 0));
    const knee = new Group();
    knee.position.y = -0.43;
    knee.add(kit.mesh(g.shin, inkMat, 0, -0.21, 0));
    const ankle = new Group();
    ankle.position.y = -0.42;
    const foot = kit.mesh(g.foot, shoeMat, 0, -0.03, -0.045);
    foot.rotation.x = Math.PI / 2;
    ankle.add(foot);
    knee.add(ankle);
    hip.add(knee);
    pelvis.add(hip);
    return { shoulder, elbow, hip, knee, ankle };
  });

  const seat: Seat = opts.seat ?? "none";
  let phase = 0;
  let clock = 0;
  let crank = 0;
  let wIdle = 1;
  let wRun = 0;

  const pose = {
    hip: [0, 0],
    knee: [0, 0],
    ankle: [0, 0],
    shoulder: [0, 0],
    elbow: [0, 0],
    lean: 0,
    twist: 0,
    bob: 0,
  };

  const apply = () => {
    for (let i = 0; i < 2; i++) {
      const l = limbs[i];
      l.hip.rotation.x = pose.hip[i] * DEG;
      l.knee.rotation.x = pose.knee[i] * DEG;
      l.ankle.rotation.x = pose.ankle[i] * DEG;
      l.shoulder.rotation.x = pose.shoulder[i] * DEG;
      l.elbow.rotation.x = pose.elbow[i] * DEG;
      l.shoulder.rotation.z = (i === 0 ? -1 : 1) * 4 * DEG;
    }
    torso.rotation.x = pose.lean * DEG;
    torso.rotation.y = pose.twist * DEG;
    pelvis.rotation.y = -pose.twist * 0.6 * DEG;
    pelvis.position.y = (seat === "none" ? HIP_Y : 0) + pose.bob;
  };

  const seated = () => {
    const breath = Math.sin(clock * 1.7) * 0.6;
    for (let i = 0; i < 2; i++) {
      if (seat === "pedal") {
        const a = crank + (i === 0 ? 0 : Math.PI);
        pose.hip[i] = 62 + 20 * Math.sin(a);
        pose.knee[i] = -(78 + 32 * Math.cos(a));
        pose.ankle[i] = 12 + 10 * Math.sin(a);
      } else {
        pose.hip[i] = 78;
        pose.knee[i] = -92;
        pose.ankle[i] = 14;
      }
      pose.shoulder[i] = 36 + breath;
      pose.elbow[i] = 26;
    }
    pose.lean = -14;
    pose.twist = 0;
    pose.bob = 0;
    torso.scale.y = 1;
  };

  const gait = (dt: number, speed: number, moving: boolean) => {
    const k = 1 - Math.exp(-dt / 0.25);
    wIdle += ((moving ? 0 : 1) - wIdle) * k;
    wRun += (smooth((speed - 2.4) / 1.8) - wRun) * k;
    const wWalk = (1 - wIdle) * (1 - wRun);
    const wR = (1 - wIdle) * wRun;
    const stride = 1.45 + 1.2 * wRun;
    if (moving && speed > 0) phase = (phase + (2 * Math.PI * speed * dt) / stride) % (Math.PI * 2);
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const breath = Math.sin(clock * 1.6);
    torso.scale.y = 1 + 0.012 * breath * wIdle;
    for (let i = 0; i < 2; i++) {
      const sg = i === 0 ? 1 : -1;
      const ss = s * sg;
      const cc = c * sg;
      const walkHip = 24 * ss + 3;
      const walkKnee = -(6 + 55 * Math.max(0, cc));
      const runHip = 40 * ss + 12;
      const runKnee = -(25 + 95 * Math.max(0, cc));
      const hip = wWalk * walkHip + wR * runHip;
      const knee = wWalk * walkKnee + wR * runKnee - wIdle * 3;
      pose.hip[i] = hip;
      pose.knee[i] = knee;
      pose.ankle[i] = -(hip + knee) * 0.8 * (1 - wIdle);
      pose.shoulder[i] = wWalk * -18 * ss + wR * -34 * ss + wIdle * (3 + breath * 0.8);
      pose.elbow[i] = wWalk * (14 + 22 * Math.max(0, -ss)) + wR * 88 + wIdle * 9;
    }
    pose.lean = wWalk * -3 + wR * -12;
    pose.twist = wWalk * 5 * s + wR * 9 * s;
    pose.bob = wWalk * 0.03 * (0.5 + 0.5 * Math.cos(2 * phase) - 0.7) + wR * (0.07 * Math.abs(s) - 0.06);
  };

  const person: Person = {
    root,
    update(dt, speed, moving) {
      clock += dt;
      if (seat === "none") gait(dt, speed, moving);
      else seated();
      apply();
    },
    setCrank(angle) {
      crank = angle;
    },
  };
  person.update(0, 0, false);
  return person;
}
