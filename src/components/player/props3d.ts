import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { MODES } from "@/lib/modes";
import type { Mode, Walker } from "@/lib/types";
import { PROP } from "./props2d";

export type Vehicle = Exclude<Mode, "walk">;

export interface WalkerRig {
  root: Group;
  legA: Group;
  legB: Group;
  armA: Group;
  armB: Group;
}

export interface Props3D {
  walker: WalkerRig;
  vehicles: Record<Vehicle, Group>;
  shadow: Mesh<CircleGeometry, MeshBasicMaterial>;
  dispose(): void;
}

export const SCALE = { walker: 11.5, car: 9, matatu: 7.5, boda: 12, bike: 12 };

class Kit {
  geos: BufferGeometry[] = [];
  mats: Material[] = [];
  private matCache = new Map<string, MeshLambertMaterial>();

  mat(color: string): MeshLambertMaterial {
    let m = this.matCache.get(color);
    if (!m) {
      m = new MeshLambertMaterial({ color });
      this.matCache.set(color, m);
      this.mats.push(m);
    }
    return m;
  }

  geo<T extends BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  mesh(g: BufferGeometry, color: string, x = 0, y = 0, z = 0): Mesh {
    const m = new Mesh(g, this.mat(color));
    m.position.set(x, y, z);
    m.frustumCulled = false;
    return m;
  }

  box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0): Mesh {
    return this.mesh(this.geo(new BoxGeometry(w, h, d)), color, x, y, z);
  }

  wheel(r: number, width: number, x: number, y: number, z: number): Mesh {
    const g = this.geo(new CylinderGeometry(r, r, width, 12));
    const m = this.mesh(g, PROP.tyre, x, y, z);
    m.rotation.z = Math.PI / 2;
    return m;
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.geos = [];
    this.mats = [];
    this.matCache.clear();
  }
}

function limb(kit: Kit, radius: number, length: number, color: string, x: number, y: number): Group {
  const pivot = new Group();
  pivot.position.set(x, y, 0);
  const g = kit.geo(new CylinderGeometry(radius, radius * 0.9, length, 8));
  pivot.add(kit.mesh(g, color, 0, -length / 2, 0));
  return pivot;
}

function buildWalker(kit: Kit, kind: Walker, dark: boolean): WalkerRig {
  const ink = dark ? "#e4e4e7" : "#27272a";
  const shirt = MODES.walk.color;
  const root = new Group();
  const hip = kind === "woman" ? 0.95 : 0.9;
  const legA = limb(kit, 0.075, hip, ink, 0.11, hip);
  const legB = limb(kit, 0.075, hip, ink, -0.11, hip);
  const armA = limb(kit, 0.06, 0.62, ink, 0.25, 1.45);
  const armB = limb(kit, 0.06, 0.62, ink, -0.25, 1.45);
  root.add(legA, legB, armA, armB);
  if (kind === "man") {
    root.add(kit.box(0.46, 0.62, 0.26, shirt, 0, 1.2, 0));
  } else if (kind === "woman") {
    root.add(kit.mesh(kit.geo(new CylinderGeometry(0.12, 0.13, 0.5, 8)), shirt, 0, 1.28, 0));
    root.add(kit.mesh(kit.geo(new ConeGeometry(0.36, 0.6, 12)), shirt, 0, 0.95, 0));
  } else {
    root.add(kit.mesh(kit.geo(new CylinderGeometry(0.1, 0.1, 0.6, 8)), ink, 0, 1.2, 0));
  }
  root.add(kit.box(0.56, 0.08, 0.1, kind === "neutral" ? ink : shirt, 0, 1.47, 0));
  root.add(kit.mesh(kit.geo(new SphereGeometry(0.17, 12, 8)), ink, 0, 1.72, 0));
  return { root, legA, legB, armA, armB };
}

function buildRider(kit: Kit, shirt: string, helmet: string, y: number, z: number): Group {
  const g = new Group();
  g.position.set(0, y, z);
  g.add(kit.box(0.4, 0.55, 0.26, shirt, 0, 0.3, 0.05));
  g.add(kit.mesh(kit.geo(new SphereGeometry(0.17, 12, 8)), helmet, 0, 0.72, 0));
  const thighs = kit.box(0.34, 0.14, 0.45, PROP.rider, 0, 0.02, -0.18);
  const armL = kit.box(0.08, 0.08, 0.5, shirt, 0.2, 0.42, -0.25);
  const armR = kit.box(0.08, 0.08, 0.5, shirt, -0.2, 0.42, -0.25);
  armL.rotation.x = 0.5;
  armR.rotation.x = 0.5;
  g.add(thighs, armL, armR);
  return g;
}

function buildCar(kit: Kit): Group {
  const c = MODES.car.color;
  const g = new Group();
  g.add(kit.box(1.8, 0.6, 4.3, c, 0, 0.55, 0));
  g.add(kit.box(1.6, 0.5, 2.2, PROP.glass, 0, 1.08, 0.15));
  g.add(kit.box(1.62, 0.08, 2.0, c, 0, 1.36, 0.2));
  for (const [x, z] of [
    [0.85, -1.35],
    [-0.85, -1.35],
    [0.85, 1.35],
    [-0.85, 1.35],
  ])
    g.add(kit.wheel(0.34, 0.26, x, 0.34, z));
  g.add(kit.box(1.5, 0.12, 0.05, PROP.lamp, 0, 0.62, -2.16));
  return g;
}

function buildMatatu(kit: Kit): Group {
  const c = MODES.matatu.color;
  const g = new Group();
  g.add(kit.box(2.0, 1.9, 5.6, c, 0, 1.35, 0));
  g.add(kit.box(2.04, 0.3, 5.64, PROP.stripe, 0, 0.8, 0));
  g.add(kit.box(2.06, 0.55, 3.9, PROP.glass, 0, 1.75, 0.35));
  g.add(kit.box(1.8, 0.6, 0.06, PROP.glass, 0, 1.7, -2.81));
  g.add(kit.box(1.4, 0.06, 4.6, PROP.stripe, 0, 2.33, 0.1));
  for (const [x, z] of [
    [0.95, -1.8],
    [-0.95, -1.8],
    [0.95, 1.8],
    [-0.95, 1.8],
  ])
    g.add(kit.wheel(0.4, 0.3, x, 0.4, z));
  g.add(kit.box(1.7, 0.14, 0.05, PROP.lamp, 0, 0.75, -2.82));
  return g;
}

function buildTwoWheeler(kit: Kit, mode: "boda" | "bike", dark: boolean): Group {
  const rider = dark ? "#d4d4d8" : PROP.rider;
  const c = MODES[mode].color;
  const g = new Group();
  const r = mode === "boda" ? 0.32 : 0.34;
  const tube = mode === "boda" ? 0.09 : 0.04;
  for (const z of [-0.7, 0.7]) {
    const w = new Mesh(kit.geo(new TorusGeometry(r, tube, 6, 14)), kit.mat(PROP.tyre));
    w.position.set(0, r, z);
    w.rotation.y = Math.PI / 2;
    w.frustumCulled = false;
    g.add(w);
  }
  if (mode === "boda") {
    g.add(kit.box(0.34, 0.36, 1.2, c, 0, 0.6, 0));
    g.add(kit.box(0.3, 0.14, 0.7, PROP.helmet, 0, 0.84, 0.15));
    g.add(kit.box(0.8, 0.06, 0.06, PROP.tyre, 0, 1.0, -0.62));
    g.add(buildRider(kit, rider, PROP.helmet, 0.9, 0.2));
  } else {
    g.add(kit.box(0.07, 0.07, 1.2, c, 0, 0.62, 0));
    const down = kit.box(0.07, 0.6, 0.07, c, 0, 0.55, 0.15);
    down.rotation.x = -0.35;
    g.add(down);
    g.add(kit.box(0.6, 0.05, 0.05, PROP.tyre, 0, 0.98, -0.62));
    g.add(buildRider(kit, c, PROP.helmet, 0.92, 0.25));
  }
  return g;
}

export function buildProps(kind: Walker, dark: boolean): Props3D {
  const kit = new Kit();
  const walker = buildWalker(kit, kind, dark);
  walker.root.scale.setScalar(SCALE.walker);
  const vehicles: Record<Vehicle, Group> = {
    car: buildCar(kit),
    matatu: buildMatatu(kit),
    boda: buildTwoWheeler(kit, "boda", dark),
    bike: buildTwoWheeler(kit, "bike", dark),
  };
  for (const k of Object.keys(vehicles) as Vehicle[]) vehicles[k].scale.setScalar(SCALE[k]);
  const shadowMat = new MeshBasicMaterial({ color: MODES.walk.color, transparent: true, opacity: 0.35, depthWrite: false });
  kit.mats.push(shadowMat);
  const shadow = new Mesh(kit.geo(new CircleGeometry(1, 20)), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.frustumCulled = false;
  return { walker, vehicles, shadow, dispose: () => kit.dispose() };
}
