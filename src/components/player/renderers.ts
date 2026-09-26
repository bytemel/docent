import { Marker, type Map as MLMap } from "maplibre-gl";
import { MODES } from "@/lib/modes";
import type { Tier } from "@/lib/tier";
import type { TimelineSample } from "@/lib/timeline";
import type { Mode, Walker } from "@/lib/types";
import { vehicleSvg, walkerSvg } from "./props2d";
import type { PropPose } from "./transfer";

export interface PropRenderer {
  readonly kind: Tier;
  update(s: TimelineSample, pose: PropPose, dt: number, playing: boolean): void;
  destroy(): void;
}

export class BasicRenderer implements PropRenderer {
  readonly kind = "basic" as const;
  private marker: Marker;
  private dot: HTMLDivElement;
  private lastMode: Mode | null = null;

  constructor(map: MLMap, casing: string) {
    const root = document.createElement("div");
    root.className = "dp-prop";
    root.style.zIndex = "3";
    this.dot = document.createElement("div");
    this.dot.className = "dp-dot";
    this.dot.style.borderColor = casing;
    root.appendChild(this.dot);
    this.marker = new Marker({ element: root });
    this.marker.setLngLat([0, 0]).addTo(map);
  }

  update(s: TimelineSample) {
    this.marker.setLngLat(s.pos);
    if (s.mode !== this.lastMode) {
      this.lastMode = s.mode;
      this.dot.style.background = MODES[s.mode].color;
      this.dot.style.setProperty("--dp-halo", MODES[s.mode].color);
    }
  }

  destroy() {
    this.marker.remove();
  }
}

const KERB_PX = 26;
const VEH: Exclude<Mode, "walk">[] = ["car", "matatu", "boda", "bike"];

export class FlatRenderer implements PropRenderer {
  readonly kind = "2d" as const;
  private map: MLMap;
  private marker: Marker;
  private veh: HTMLDivElement;
  private walk: HTMLDivElement;
  private flip: HTMLDivElement;
  private svgs = new Map<Mode, Element>();
  private shown: Mode | null = null;
  private heading = 0;
  private has = false;
  private facingLeft = false;
  private walking = false;
  private disc: HTMLDivElement;
  private discMode: Mode | null = null;

  constructor(map: MLMap, walker: Walker) {
    this.map = map;
    const root = document.createElement("div");
    root.className = "dp-prop";
    root.style.zIndex = "3";
    this.veh = document.createElement("div");
    this.veh.className = "dp-veh";
    this.veh.innerHTML = VEH.map((v) => vehicleSvg(v)).join("");
    VEH.forEach((v, i) => this.svgs.set(v, this.veh.children[i]));
    this.walk = document.createElement("div");
    this.walk.className = "dp-walk";
    this.flip = document.createElement("div");
    this.flip.innerHTML = walkerSvg(walker);
    this.walk.appendChild(this.flip);
    this.disc = document.createElement("div");
    this.disc.className = "dp-disc";
    root.append(this.disc, this.veh, this.walk);
    this.marker = new Marker({ element: root, rotationAlignment: "viewport", pitchAlignment: "viewport" });
    this.marker.setLngLat([0, 0]).addTo(map);
  }

  update(s: TimelineSample, pose: PropPose, dt: number) {
    const k = this.has ? 1 - Math.exp(-dt / 0.12) : 1;
    let d = (s.bearing - this.heading) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    this.heading = (this.heading + d * k + 360) % 360;
    this.has = true;
    this.marker.setLngLat(s.pos);
    const screen = this.heading - this.map.getBearing();
    const r = (screen * Math.PI) / 180;
    const lx = -Math.cos(r);
    const ly = -Math.sin(r);

    const discMode = pose.vehicle ?? "walk";
    if (discMode !== this.discMode) {
      this.discMode = discMode;
      this.disc.style.background = MODES[discMode].color;
    }
    const want = pose.vehicle && pose.vehicleAlpha > 0.02 ? pose.vehicle : null;
    if (want !== this.shown) {
      if (this.shown) this.svgs.get(this.shown)?.classList.remove("dp-on");
      if (want) this.svgs.get(want)?.classList.add("dp-on");
      this.shown = want;
    }
    if (want) {
      const o = pose.vehicleOffset * KERB_PX;
      const sc = 0.55 + 0.45 * pose.vehicleAlpha;
      this.veh.style.opacity = String(pose.vehicleAlpha);
      this.veh.style.transform = `translate(${lx * o}px,${ly * o}px) rotate(${screen}deg) scale(${sc}) translate(-50%,-50%)`;
    }

    const showWalker = pose.walker && pose.walkerAlpha > 0.02;
    this.walk.style.display = showWalker ? "block" : "none";
    if (showWalker) {
      const o = pose.walkerOffset * KERB_PX;
      const face = screen + pose.walkerTurn;
      const left = Math.sin((face * Math.PI) / 180) < -0.05;
      if (left !== this.facingLeft) {
        this.facingLeft = left;
        this.flip.style.transform = left ? "scaleX(-1)" : "";
      }
      this.walk.style.opacity = String(pose.walkerAlpha);
      this.walk.style.transform = `translate(${lx * o}px,${ly * o}px) scale(${pose.walkerScale}) translate(-50%,-92%)`;
    }
    if (pose.walkerMoving !== this.walking) {
      this.walking = pose.walkerMoving;
      this.walk.classList.toggle("dp-walking", this.walking);
    }
  }

  destroy() {
    this.marker.remove();
  }
}
