import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  TorusGeometry,
  type Material,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { MODES } from "@/lib/modes";
import type { Mode, Walker } from "@/lib/types";
import { Kit } from "./kit3d";
import { createPerson, type Person, type PersonOptions } from "./person3d";
import { PROP } from "./props2d";

export type Vehicle = Exclude<Mode, "walk">;

export interface VehicleRig {
  root: Group;
  wheels: Group[];
  wheelR: number;
  crank: Group | null;
  rider: Person | null;
}

export interface Props3D {
  walker: Person;
  walkerRoot: Group;
  vehicles: Record<Vehicle, VehicleRig>;
  shadow: Mesh;
  contact: Mesh;
  triangles: Record<Vehicle | "walk", number>;
  dispose(): void;
}

export const SCALE = { walker: 17, car: 10, matatu: 8.5, boda: 15.5, bike: 16.5 };

const ACCENT = "#ffc61a";
const ACCENT_INK = "#101214";
const RIM = "#c9cdd2";
const TAIL = "#b42318";

export { createPerson };

export function createPersonModel(opts: PersonOptions): { person: Person; dispose(): void } {
  const kit = new Kit();
  return { person: createPerson(kit, opts), dispose: () => kit.dispose() };
}

function rbox(kit: Kit, w: number, h: number, d: number, r: number, mat: Material, x = 0, y = 0, z = 0, seg = 2): Mesh {
  const key = `rb|${w}|${h}|${d}|${r}|${seg}`;
  return kit.mesh(kit.geo(key, () => new RoundedBoxGeometry(w, h, d, seg, r)), mat, x, y, z);
}

function box(kit: Kit, w: number, h: number, d: number, mat: Material, x = 0, y = 0, z = 0): Mesh {
  return kit.mesh(kit.geo(`b|${w}|${h}|${d}`, () => new BoxGeometry(w, h, d)), mat, x, y, z);
}

function carWheel(kit: Kit, r: number, width: number): Group {
  const w = new Group();
  const tyre = kit.mesh(kit.geo(`tyre|${r}|${width}`, () => new CylinderGeometry(r, r, width, 16)), kit.mat(PROP.tyre, { roughness: 0.9 }));
  tyre.rotation.z = Math.PI / 2;
  const rim = kit.mesh(kit.geo(`rim|${r}|${width}`, () => new CylinderGeometry(r * 0.58, r * 0.58, width + 0.02, 10)), kit.mat(RIM, { roughness: 0.3, metalness: 0.6 }));
  rim.rotation.z = Math.PI / 2;
  const spoke = box(kit, width + 0.04, r * 1.05, r * 0.16, kit.mat(PROP.tyre, { roughness: 0.9 }));
  w.add(tyre, rim, spoke);
  return w;
}

function thinWheel(kit: Kit, r: number, tube: number): Group {
  const w = new Group();
  const tyre = kit.mesh(kit.geo(`ttyre|${r}|${tube}`, () => new TorusGeometry(r, tube, 6, 16)), kit.mat(PROP.tyre, { roughness: 0.9 }));
  tyre.rotation.y = Math.PI / 2;
  const rim = kit.mesh(kit.geo(`trim|${r}`, () => new TorusGeometry(r * 0.82, 0.018, 3, 16)), kit.mat(RIM, { roughness: 0.3, metalness: 0.6 }));
  rim.rotation.y = Math.PI / 2;
  const spokeMat = kit.mat(RIM, { roughness: 0.3, metalness: 0.6 });
  const a = box(kit, 0.02, r * 1.64, 0.02, spokeMat);
  const b = box(kit, 0.02, 0.02, r * 1.64, spokeMat);
  w.add(tyre, rim, a, b);
  return w;
}

function lamps(kit: Kit, g: Group, width: number, y: number, front: number, back: number) {
  const lamp = kit.mat(PROP.lamp, { emissive: PROP.lamp, roughness: 0.3 });
  const tail = kit.mat(TAIL, { emissive: TAIL, roughness: 0.4 });
  for (const s of [-1, 1]) {
    g.add(rbox(kit, 0.34, 0.14, 0.06, 0.03, lamp, s * width, y, front, 1));
    g.add(rbox(kit, 0.3, 0.12, 0.06, 0.03, tail, s * width, y, back, 1));
  }
}

function buildCar(kit: Kit): VehicleRig {
  const paint = kit.mat(MODES.car.color, { roughness: 0.38, metalness: 0.25 });
  const glass = kit.mat(PROP.glass, { roughness: 0.15, metalness: 0.4 });
  const root = new Group();
  root.add(rbox(kit, 1.8, 0.62, 4.4, 0.2, paint, 0, 0.58, 0));
  root.add(rbox(kit, 1.58, 0.56, 2.3, 0.22, paint, 0, 1.12, 0.18));
  root.add(rbox(kit, 1.62, 0.36, 2.36, 0.14, glass, 0, 1.14, 0.18));
  lamps(kit, root, 0.6, 0.66, -2.2, 2.2);
  const wheels: Group[] = [];
  for (const [x, z] of [
    [0.86, -1.35],
    [-0.86, -1.35],
    [0.86, 1.35],
    [-0.86, 1.35],
  ]) {
    const w = carWheel(kit, 0.34, 0.24);
    w.position.set(x, 0.34, z);
    wheels.push(w);
    root.add(w);
  }
  return { root, wheels, wheelR: 0.34, crank: null, rider: null };
}

function buildMatatu(kit: Kit): VehicleRig {
  const paint = kit.mat(MODES.matatu.color, { roughness: 0.45, metalness: 0.15 });
  const stripe = kit.mat(PROP.stripe, { roughness: 0.5 });
  const glass = kit.mat(PROP.glass, { roughness: 0.15, metalness: 0.4 });
  const rack = kit.mat(PROP.tyre, { roughness: 0.6, metalness: 0.3 });
  const root = new Group();
  root.add(rbox(kit, 2.05, 1.95, 5.9, 0.24, paint, 0, 1.36, 0));
  root.add(rbox(kit, 2.09, 0.28, 5.94, 0.1, stripe, 0, 0.86, 0));
  root.add(rbox(kit, 2.1, 0.62, 4.3, 0.12, glass, 0, 1.8, 0.4));
  root.add(rbox(kit, 1.78, 0.78, 0.12, 0.08, glass, 0, 1.72, -2.92));
  root.add(rbox(kit, 1.5, 0.6, 0.12, 0.08, glass, 0, 1.78, 2.92, 1));
  for (const s of [-1, 1]) root.add(box(kit, 0.06, 0.08, 4.4, rack, s * 0.78, 2.42, 0.2));
  for (const z of [-1.6, -0.5, 0.6, 1.7]) root.add(box(kit, 1.64, 0.05, 0.06, rack, 0, 2.44, z));
  lamps(kit, root, 0.68, 0.72, -2.96, 2.96);
  const wheels: Group[] = [];
  for (const [x, z] of [
    [0.96, -1.85],
    [-0.96, -1.85],
    [0.96, 1.85],
    [-0.96, 1.85],
  ]) {
    const w = carWheel(kit, 0.4, 0.3);
    w.position.set(x, 0.4, z);
    wheels.push(w);
    root.add(w);
  }
  return { root, wheels, wheelR: 0.4, crank: null, rider: null };
}

function buildBoda(kit: Kit, kind: Walker, dark: boolean): VehicleRig {
  const body = kit.mat(MODES.boda.color, { roughness: 0.4, metalness: 0.2 });
  const frame = kit.mat(PROP.tyre, { roughness: 0.5, metalness: 0.4 });
  const seat = kit.mat(PROP.helmet, { roughness: 0.7 });
  const lamp = kit.mat(PROP.lamp, { emissive: PROP.lamp, roughness: 0.3 });
  const root = new Group();
  root.add(rbox(kit, 0.26, 0.3, 1.15, 0.08, frame, 0, 0.58, 0.02, 1));
  root.add(rbox(kit, 0.46, 0.26, 0.5, 0.1, body, 0, 0.84, -0.22, 1));
  root.add(rbox(kit, 0.38, 0.1, 0.66, 0.05, seat, 0, 0.9, 0.3, 1));
  root.add(rbox(kit, 0.34, 0.2, 0.34, 0.06, body, 0, 0.58, 0.72, 1));
  const fork = box(kit, 0.06, 0.62, 0.06, frame, 0, 0.62, -0.62);
  fork.rotation.x = -0.35;
  root.add(fork, box(kit, 0.82, 0.05, 0.05, frame, 0, 1.02, -0.52));
  root.add(rbox(kit, 0.22, 0.16, 0.08, 0.04, lamp, 0, 0.9, -0.66, 1));
  const wheels: Group[] = [];
  for (const z of [-0.74, 0.72]) {
    const w = thinWheel(kit, 0.31, 0.075);
    w.position.set(0, 0.31, z);
    wheels.push(w);
    root.add(w);
  }
  const rider = createPerson(kit, { kind, shirt: MODES.boda.color, dark, seat: "pegs" });
  rider.root.position.set(0, 1.03, 0.22);
  rider.root.scale.set(1.25, 1, 1.1);
  root.add(rider.root);
  return { root, wheels, wheelR: 0.31, crank: null, rider };
}

function buildBike(kit: Kit, kind: Walker, dark: boolean): VehicleRig {
  const tube = kit.mat(MODES.bike.color, { roughness: 0.35, metalness: 0.35 });
  const dark2 = kit.mat(PROP.tyre, { roughness: 0.6, metalness: 0.3 });
  const root = new Group();
  const top = box(kit, 0.05, 0.05, 0.62, tube, 0, 0.92, -0.08);
  top.rotation.x = -0.12;
  const down = box(kit, 0.055, 0.78, 0.055, tube, 0, 0.6, -0.26);
  down.rotation.x = 0.72;
  const seatTube = box(kit, 0.05, 0.62, 0.05, tube, 0, 0.62, 0.16);
  seatTube.rotation.x = -0.28;
  const stay = box(kit, 0.04, 0.04, 0.58, tube, 0, 0.34, 0.4);
  const fork = box(kit, 0.04, 0.7, 0.04, tube, 0, 0.62, -0.6);
  fork.rotation.x = -0.3;
  root.add(top, down, seatTube, stay, fork);
  root.add(box(kit, 0.56, 0.035, 0.035, dark2, 0, 1.02, -0.52), rbox(kit, 0.16, 0.06, 0.28, 0.03, dark2, 0, 0.96, 0.24, 1));
  const crank = new Group();
  crank.position.set(0, 0.32, 0.08);
  const arm = box(kit, 0.03, 0.34, 0.03, dark2);
  const pedalL = box(kit, 0.12, 0.03, 0.08, dark2, -0.07, 0.17, 0);
  const pedalR = box(kit, 0.12, 0.03, 0.08, dark2, 0.07, -0.17, 0);
  crank.add(arm, pedalL, pedalR);
  root.add(crank);
  const wheels: Group[] = [];
  for (const z of [-0.72, 0.68]) {
    const w = thinWheel(kit, 0.34, 0.028);
    w.position.set(0, 0.34, z);
    wheels.push(w);
    root.add(w);
  }
  const rider = createPerson(kit, { kind, shirt: MODES.bike.color, dark, seat: "pedal" });
  rider.root.position.set(0, 1.04, 0.28);
  root.add(rider.root);
  return { root, wheels, wheelR: 0.34, crank, rider };
}

function softShadow(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(16,18,20,0.5)");
  grad.addColorStop(0.6, "rgba(16,18,20,0.22)");
  grad.addColorStop(1, "rgba(16,18,20,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

export function countTriangles(root: Group): number {
  let n = 0;
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    n += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  });
  return Math.round(n);
}

export function buildProps(kind: Walker, dark: boolean): Props3D {
  const kit = new Kit();
  const walker = createPerson(kit, { kind, shirt: MODES.walk.color, dark });
  const walkerRoot = new Group();
  walkerRoot.add(walker.root);
  walkerRoot.scale.setScalar(SCALE.walker);
  const vehicles: Record<Vehicle, VehicleRig> = {
    car: buildCar(kit),
    matatu: buildMatatu(kit),
    boda: buildBoda(kit, kind, dark),
    bike: buildBike(kit, kind, dark),
  };
  for (const k of Object.keys(vehicles) as Vehicle[]) vehicles[k].root.scale.setScalar(SCALE[k]);

  const disc = kit.own("disc", () => new MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.34, depthWrite: false }));
  const ringMat = kit.own("ring", () => new MeshBasicMaterial({ color: ACCENT_INK, transparent: true, opacity: 0.85, depthWrite: false }));
  const shadow = kit.mesh(kit.geo("disc", () => new CircleGeometry(1, 32)), disc);
  const ring = kit.mesh(kit.geo("ring", () => new RingGeometry(0.92, 1, 48)), ringMat, 0, 0, 0.002);
  shadow.add(ring);
  shadow.rotation.x = -Math.PI / 2;

  const tex = softShadow();
  const contactMat = kit.own("contact", () => new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: "#ffffff" }));
  const contact = kit.mesh(kit.geo("contact", () => new CircleGeometry(1, 24)), contactMat);
  contact.rotation.x = -Math.PI / 2;

  const triangles = {
    walk: countTriangles(walkerRoot),
    car: countTriangles(vehicles.car.root),
    matatu: countTriangles(vehicles.matatu.root),
    boda: countTriangles(vehicles.boda.root),
    bike: countTriangles(vehicles.bike.root),
  };
  return {
    walker,
    walkerRoot,
    vehicles,
    shadow,
    contact,
    triangles,
    dispose: () => {
      tex?.dispose();
      kit.dispose();
    },
  };
}
