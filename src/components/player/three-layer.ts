import { AmbientLight, Camera, DirectionalLight, Matrix4, Scene, Vector3, WebGLRenderer } from "three";
import { MercatorCoordinate, type CustomLayerInterface, type Map as MLMap } from "maplibre-gl";
import type { Timeline, TimelineSample } from "@/lib/timeline";
import type { Walker } from "@/lib/types";
import { buildProps, SCALE, type Props3D, type Vehicle } from "./props3d";
import type { PropPose } from "./transfer";
import type { PropRenderer } from "./renderers";

const LAYER_ID = "dp-three";
const KERB_M = 16;
const TAU_HEADING = 0.12;
const VEHICLES: Vehicle[] = ["car", "matatu", "boda", "bike"];

const toRad = Math.PI / 180;

function angleDiff(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export class ThreeRenderer implements PropRenderer {
  readonly kind = "3d" as const;
  private map: MLMap;
  private renderer: WebGLRenderer | null = null;
  private scene = new Scene();
  private camera = new Camera();
  private props: Props3D;
  private origin: { x: number; y: number; s: number };
  private originMatrix = new Matrix4();
  private mainMatrix = new Matrix4();
  private heading = 0;
  private walkHeading = 0;
  private walkPhase = 0;
  private hasHeading = false;
  private removed = false;
  private layer: CustomLayerInterface;
  failed = false;

  constructor(map: MLMap, tl: Timeline, walker: Walker, dark: boolean, onFail: () => void) {
    this.map = map;
    const start = tl.coords[0] ?? [0, 0];
    const mc = MercatorCoordinate.fromLngLat({ lng: start[0], lat: start[1] }, 0);
    const s = mc.meterInMercatorCoordinateUnits();
    this.origin = { x: mc.x, y: mc.y, s };
    this.originMatrix
      .makeTranslation(mc.x, mc.y, mc.z)
      .scale(new Vector3(s, -s, s))
      .multiply(new Matrix4().makeRotationAxis(new Vector3(1, 0, 0), Math.PI / 2));

    this.props = buildProps(walker, dark);
    this.scene.add(this.props.shadow, this.props.walker.root);
    for (const v of VEHICLES) {
      this.props.vehicles[v].visible = false;
      this.scene.add(this.props.vehicles[v]);
    }
    const amb = new AmbientLight(0xffffff, dark ? 1.5 : 1.8);
    const sun = new DirectionalLight(0xffffff, dark ? 1.6 : 2.2);
    sun.position.set(-40, 100, 60);
    this.scene.add(amb, sun);

    this.layer = {
      id: LAYER_ID,
      type: "custom",
      renderingMode: "3d",
      onAdd: (m, gl) => {
        try {
          this.renderer = new WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
          this.renderer.autoClear = false;
        } catch {
          this.failed = true;
          onFail();
        }
      },
      render: (_gl, args) => {
        if (!this.renderer || this.removed) return;
        this.mainMatrix.fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]);
        this.camera.projectionMatrix.multiplyMatrices(this.mainMatrix, this.originMatrix);
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
      },
      onRemove: () => this.disposeGl(),
    };
    map.addLayer(this.layer);
  }

  private toScene(lng: number, lat: number, out: Vector3) {
    const mx = (180 + lng) / 360;
    const my = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
    out.set((mx - this.origin.x) / this.origin.s, 0, (my - this.origin.y) / this.origin.s);
  }

  private tmp = new Vector3();

  update(s: TimelineSample, pose: PropPose, dt: number, playing: boolean) {
    if (this.removed) return;
    const k = this.hasHeading ? 1 - Math.exp(-dt / TAU_HEADING) : 1;
    this.heading = (this.heading + angleDiff(this.heading, s.bearing) * k + 360) % 360;
    const wantWalk = s.bearing + pose.walkerTurn;
    this.walkHeading = (this.walkHeading + angleDiff(this.walkHeading, wantWalk) * (this.hasHeading ? Math.min(1, k * 1.5) : 1) + 360) % 360;
    this.hasHeading = true;

    this.toScene(s.pos[0], s.pos[1], this.tmp);
    const b = s.bearing * toRad;
    const lx = -Math.cos(b);
    const lz = -Math.sin(b);

    for (const v of VEHICLES) {
      const g = this.props.vehicles[v];
      const on = pose.vehicle === v && pose.vehicleAlpha > 0.02;
      g.visible = on;
      if (!on) continue;
      const off = pose.vehicleOffset * KERB_M;
      g.position.set(this.tmp.x + lx * off, 0, this.tmp.z + lz * off);
      g.rotation.y = -this.heading * toRad;
      g.scale.setScalar(SCALE[v] * (0.55 + 0.45 * pose.vehicleAlpha));
    }

    const w = this.props.walker;
    w.root.visible = pose.walker && pose.walkerAlpha > 0.02;
    if (w.root.visible) {
      const off = pose.walkerOffset * KERB_M;
      w.root.position.set(this.tmp.x + lx * off, 0, this.tmp.z + lz * off);
      w.root.rotation.y = -this.walkHeading * toRad;
      w.root.scale.setScalar(SCALE.walker * pose.walkerScale * (0.5 + 0.5 * pose.walkerAlpha));
      if (pose.walkerMoving && playing) this.walkPhase += dt * Math.PI * 2 * 1.9;
      const swing = pose.walkerMoving ? Math.sin(this.walkPhase) : 0;
      w.legA.rotation.x = swing * 0.6;
      w.legB.rotation.x = -swing * 0.6;
      w.armA.rotation.x = -swing * 0.5;
      w.armB.rotation.x = swing * 0.5;
    }

    const shadow = this.props.shadow;
    const main = pose.vehicle && pose.vehicle !== "walk" ? this.props.vehicles[pose.vehicle] : w.root;
    shadow.position.set(main.position.x, 0.3, main.position.z);
    const r = pose.vehicle ? (pose.vehicle === "matatu" ? 16 : pose.vehicle === "car" ? 13 : 9) : 4.5;
    shadow.scale.setScalar(r);
    this.map.triggerRepaint();
  }

  private disposeGl() {
    this.props.dispose();
    this.scene.clear();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }

  destroy() {
    if (this.removed) return;
    this.removed = true;
    try {
      if (this.map.getLayer(LAYER_ID)) this.map.removeLayer(LAYER_ID);
      else this.disposeGl();
    } catch {
      this.disposeGl();
    }
  }
}
