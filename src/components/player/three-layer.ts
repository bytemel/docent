import { Camera, HemisphereLight, DirectionalLight, Matrix4, Scene, Vector3, WebGLRenderer } from "three";
import { MercatorCoordinate, type CustomLayerInterface, type Map as MLMap } from "maplibre-gl";
import type { Timeline, TimelineSample } from "@/lib/timeline";
import type { Walker } from "@/lib/types";
import { buildProps, SCALE, type Props3D, type Vehicle } from "./props3d";
import type { PropPose } from "./transfer";
import type { PropRenderer } from "./renderers";

const LAYER_ID = "dp-three";
const KERB_M = 15.5;
const REF_ZOOM = 17;
const DISC_M = { walker: 11, car: 18, matatu: 21, two: 15 };
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
  private wheelAngle = 0;
  private speed = 0;
  private lastAt = 0;
  private hasAt = false;
  private hasHeading = false;
  private removed = false;
  private layer: CustomLayerInterface;
  failed = false;
  private screen = 1;
  private onResize = () => {
    const c = this.map.getContainer();
    this.screen = Math.min(1.6, Math.max(1, Math.min(c.clientWidth, c.clientHeight) / 450));
  };

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
    this.scene.add(this.props.contact, this.props.shadow, this.props.walkerRoot);
    for (const v of VEHICLES) {
      this.props.vehicles[v].root.visible = false;
      this.scene.add(this.props.vehicles[v].root);
    }
    const amb = new HemisphereLight(0xffffff, dark ? 0x30343a : 0xd9dcd5, dark ? 1.6 : 1.9);
    const sun = new DirectionalLight(0xffffff, dark ? 2.2 : 2.6);
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
    this.onResize();
    map.on("resize", this.onResize);
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

    const z = this.map.getZoom();
    const zm = Math.min(3, Math.max(0.35, Math.pow(2, REF_ZOOM - z))) * this.screen;
    const kerb = KERB_M * zm;
    const moved = this.hasAt ? Math.abs(s.atM - this.lastAt) : 0;
    this.lastAt = s.atM;
    this.hasAt = true;
    const instant = dt > 0 ? Math.min(400, moved / dt) : 0;
    this.speed += (instant - this.speed) * (1 - Math.exp(-dt / 0.2));

    for (const v of VEHICLES) {
      const rig = this.props.vehicles[v];
      const g = rig.root;
      const on = pose.vehicle === v && pose.vehicleAlpha > 0.02;
      g.visible = on;
      if (!on) continue;
      const off = pose.vehicleOffset * kerb;
      const scale = SCALE[v] * zm;
      g.position.set(this.tmp.x + lx * off, 0, this.tmp.z + lz * off);
      g.rotation.y = -this.heading * toRad;
      g.scale.setScalar(scale * (0.55 + 0.45 * pose.vehicleAlpha));
      const spin = moved / (rig.wheelR * scale);
      this.wheelAngle = (this.wheelAngle - spin) % (Math.PI * 2);
      for (const wheel of rig.wheels) wheel.rotation.x = this.wheelAngle;
      if (rig.crank) {
        rig.crank.rotation.x = this.wheelAngle * 0.5;
        rig.rider?.setCrank(-this.wheelAngle * 0.5);
      }
      if (playing) rig.rider?.update(dt, 0, false);
    }

    const w = this.props.walkerRoot;
    w.visible = pose.walker && pose.walkerAlpha > 0.02;
    if (w.visible) {
      const off = pose.walkerOffset * kerb;
      const scale = SCALE.walker * zm;
      w.position.set(this.tmp.x + lx * off, 0, this.tmp.z + lz * off);
      w.rotation.y = -this.walkHeading * toRad;
      w.scale.setScalar(scale * pose.walkerScale * (0.5 + 0.5 * pose.walkerAlpha));
      const moving = pose.walkerMoving && playing;
      const figureSpeed = s.phase === "transfer" ? 1.4 : this.speed / scale;
      if (playing) this.props.walker.update(dt, moving ? figureSpeed : 0, moving);
    }

    const shadow = this.props.shadow;
    const main = pose.vehicle && pose.vehicle !== "walk" ? this.props.vehicles[pose.vehicle].root : w;
    shadow.position.set(main.position.x, 0.3, main.position.z);
    const r = pose.vehicle
      ? pose.vehicle === "matatu"
        ? DISC_M.matatu
        : pose.vehicle === "car"
          ? DISC_M.car
          : DISC_M.two
      : DISC_M.walker;
    shadow.scale.setScalar(r * zm);
    const contact = this.props.contact;
    contact.position.set(main.position.x, 0.5, main.position.z);
    contact.scale.setScalar(r * zm * 0.62);
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
    this.map.off("resize", this.onResize);
    try {
      if (this.map.getLayer(LAYER_ID)) this.map.removeLayer(LAYER_ID);
      else this.disposeGl();
    } catch {
      this.disposeGl();
    }
  }
}
