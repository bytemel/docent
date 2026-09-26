import { LngLatBounds, Map as MLMap, Marker, setWorkerUrl, getVersion, type GeoJSONSource } from "maplibre-gl";
import { bbox, haversine } from "@/lib/geo";
import { ensureMapWorker, mapStyleUrl } from "@/lib/map";
import { MODES } from "@/lib/modes";
import type { Tier } from "@/lib/tier";
import { headingBetween, lngLatAt, type Timeline, type TimelineSample } from "@/lib/timeline";
import type { LngLat, Mode, RouteDoc } from "@/lib/types";
import { LiveLocation, type LocationHooks } from "./location";
import { stepMeters } from "./track";
import { BasicRenderer, FlatRenderer, type PropRenderer } from "./renderers";
import { createPose, poseFor } from "./transfer";

export interface PinEl {
  id: string;
  el: HTMLElement;
  lngLat: LngLat;
}

export interface SceneInit {
  container: HTMLElement;
  doc: RouteDoc;
  tl: Timeline;
  dark: boolean;
  interactive: boolean;
  reducedMotion: boolean;
  pins: PinEl[];
  endpoints: { a: HTMLElement; b: HTMLElement };
  onFollowChange: (follow: boolean) => void;
  onTierFailed: (tier: Tier) => void;
  onRestore: () => void;
}

interface LineFeature {
  type: "Feature";
  properties: { color: string; dashed: boolean };
  geometry: { type: "LineString"; coordinates: number[][] };
}

const NEAR_M = 40;
const LABEL_ZOOM = 14.5;
const CAM = {
  "3d": { zoom: 16.5, pitch: 55 },
  "2d": { zoom: 16, pitch: 0 },
};

const ZOOM_3D: Record<Mode, number> = { walk: 17.1, bike: 16.9, boda: 16.8, car: 16.6, matatu: 16.5 };

function angleDiff(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export class PlayerScene {
  readonly map: MLMap;
  readonly ready: Promise<void>;
  private init: SceneInit;
  private tl: Timeline;
  private casing: string;
  private renderer: PropRenderer | null = null;
  private tier: Tier | null = null;
  private markers: Marker[] = [];
  private pose = createPose();
  private follow = false;
  private cam = { lng: 0, lat: 0, zoom: 0, pitch: 0, bearing: 0 };
  private want = { lng: 0, lat: 0, zoom: 0, pitch: 0, bearing: 0 };
  private camOpts = {
    center: [0, 0] as [number, number],
    zoom: 0,
    pitch: 0,
    bearing: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  };
  private doneLeg = -1;
  private partialM = -1;
  private partialAt = 0;
  private near: boolean[];
  private destroyed = false;
  private loaded = false;
  private resizeObs: ResizeObserver | null = null;
  private tierToken = 0;
  private bounds: LngLatBounds;
  private partialFeature: LineFeature = {
    type: "Feature",
    properties: { color: MODES.walk.color, dashed: true },
    geometry: { type: "LineString", coordinates: [] },
  };
  private partial: { type: "FeatureCollection"; features: LineFeature[] } = { type: "FeatureCollection", features: [] };
  private scratch: LngLat = [0, 0];

  constructor(init: SceneInit) {
    this.init = init;
    this.tl = init.tl;
    this.casing = init.dark ? "#0d0f11" : "#ffffff";
    this.near = init.pins.map(() => false);
    const b = bbox(this.tl.coords.length ? this.tl.coords : [[36.8219, -1.2921]]);
    this.bounds = new LngLatBounds([b[0], b[1]], [b[2], b[3]]);
    ensureMapWorker({ setWorkerUrl, getVersion });
    this.map = new MLMap({
      container: init.container,
      style: mapStyleUrl(init.dark),
      bounds: this.bounds,
      fitBoundsOptions: { padding: 48, maxZoom: 16 },
      attributionControl: { compact: true },
      interactive: init.interactive,
      keyboard: false,
      maxPitch: 70,
      fadeDuration: 0,
      canvasContextAttributes: { antialias: true },
    });
    const userMove = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent && this.follow) this.setFollow(false);
    };
    this.map.on("dragstart", userMove);
    this.map.on("zoomstart", userMove);
    this.map.on("rotatestart", userMove);
    this.map.on("pitchstart", userMove);
    init.container.querySelector<HTMLElement>(".maplibregl-ctrl-bottom-right")?.style.setProperty("bottom", "0", "important");
    this.map.on("zoom", () => this.updateLabels());
    this.map.on("webglcontextrestored", () => {
      this.map.once("idle", () => {
        if (!this.destroyed) this.init.onRestore();
      });
    });
    if (typeof ResizeObserver !== "undefined") {
      let lastW = init.container.clientWidth;
      let lastH = init.container.clientHeight;
      this.resizeObs = new ResizeObserver(() => {
        const w = init.container.clientWidth;
        const h = init.container.clientHeight;
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        if (this.destroyed) return;
        this.map.resize();
        if (!this.follow && this.loaded) this.fit(false);
      });
      this.resizeObs.observe(init.container);
    }
    this.map.setMissingStyleImageResolver((id) => {
      if (!this.map.hasImage(id)) this.map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    this.ready = new Promise((resolve) => {
      this.map.once("load", () => {
        if (this.destroyed) return;
        this.loaded = true;
        if (init.container.clientWidth < 640) {
          init.container.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        }
        this.map.resize();
        this.addRoute();
        this.addMarkers();
        this.updateLabels(true);
        this.fit(false);
        resolve();
      });
    });
  }

  private addRoute() {
    const tl = this.tl;
    const features = tl.legModes.map((mode, i) => {
      const coords: number[][] = [];
      for (let k = 0; k < tl.coords.length; k++) {
        const m = tl.cum[k];
        if (m >= tl.legStartM[i] - 1e-6 && m <= tl.legEndM[i] + 1e-6) coords.push(tl.coords[k]);
      }
      if (coords.length < 2) coords.push(...coords, tl.coords[tl.coords.length - 1] ?? [0, 0]);
      return {
        type: "Feature" as const,
        properties: { i, color: MODES[mode].color, dashed: MODES[mode].dashed },
        geometry: { type: "LineString" as const, coordinates: coords },
      };
    });
    const map = this.map;
    map.addSource("dp-route", { type: "geojson", data: { type: "FeatureCollection", features } });
    map.addSource("dp-done", { type: "geojson", data: this.partial });
    const layout = { "line-join": "round" as const, "line-cap": "round" as const };
    map.addLayer({
      id: "dp-halo",
      type: "line",
      source: "dp-route",
      layout,
      paint: {
        "line-color": this.init.dark ? "#f2f3f0" : "#101214",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 8, 17, 16],
        "line-opacity": this.init.dark ? 0.12 : 0.16,
      },
    });
    map.addLayer({
      id: "dp-casing",
      type: "line",
      source: "dp-route",
      layout,
      paint: { "line-color": this.casing, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 6, 17, 13], "line-opacity": 1 },
    });
    const width = ["interpolate", ["linear"], ["zoom"], 12, 3, 17, 7] as unknown as number;
    for (const dashed of [false, true]) {
      const sfx = dashed ? "dash" : "solid";
      const dash = dashed ? { "line-dasharray": [1.2, 1.4] } : {};
      map.addLayer({
        id: `dp-rest-${sfx}`,
        type: "line",
        source: "dp-route",
        filter: ["==", ["get", "dashed"], dashed],
        layout,
        paint: { "line-color": ["get", "color"], "line-width": width, "line-opacity": 0.72, ...dash },
      });
      map.addLayer({
        id: `dp-done-${sfx}`,
        type: "line",
        source: "dp-route",
        filter: ["all", ["==", ["get", "dashed"], dashed], ["<", ["get", "i"], -1]],
        layout,
        paint: { "line-color": ["get", "color"], "line-width": width, ...dash },
      });
      map.addLayer({
        id: `dp-part-${sfx}`,
        type: "line",
        source: "dp-done",
        filter: ["==", ["get", "dashed"], dashed],
        layout,
        paint: { "line-color": ["get", "color"], "line-width": width, ...dash },
      });
    }
  }

  private addMarkers() {
    const { pins, endpoints } = this.init;
    for (const p of pins) this.markers.push(new Marker({ element: p.el, anchor: "center" }).setLngLat(p.lngLat).addTo(this.map));
    const first = this.tl.coords[0];
    const last = this.tl.coords[this.tl.coords.length - 1];
    if (first) this.markers.push(new Marker({ element: endpoints.a, anchor: "center" }).setLngLat(first).addTo(this.map));
    if (last) this.markers.push(new Marker({ element: endpoints.b, anchor: "center" }).setLngLat(last).addTo(this.map));
  }

  async setTier(tier: Tier): Promise<Tier | null> {
    await this.ready;
    if (this.destroyed) return null;
    const token = ++this.tierToken;
    try {
      this.renderer?.destroy();
    } catch {
      this.renderer = null;
    }
    this.renderer = null;
    this.tier = tier;
    if (tier === "3d") {
      try {
        const mod = await import("./three-layer");
        if (token !== this.tierToken || this.destroyed) return null;
        const r = new mod.ThreeRenderer(this.map, this.tl, this.init.doc.walker, this.init.dark, () =>
          this.init.onTierFailed("3d"),
        );
        this.renderer = r;
      } catch {
        this.init.onTierFailed("3d");
        return this.setTier("2d");
      }
    } else if (tier === "2d") {
      this.renderer = new FlatRenderer(this.map, this.init.doc.walker);
    } else {
      this.renderer = new BasicRenderer(this.map);
    }
    if (tier === "basic") this.showWhole(false);
    else this.setFollow(true);
    return tier;
  }

  setFollow(on: boolean) {
    if (this.tier === "basic") on = false;
    if (on) this.loc?.setFollow(false);
    if (on && !this.follow) {
      const c = this.map.getCenter();
      this.cam.lng = c.lng;
      this.cam.lat = c.lat;
      this.cam.zoom = this.map.getZoom();
      this.cam.pitch = this.map.getPitch();
      this.cam.bearing = this.map.getBearing();
    }
    if (on !== this.follow) {
      this.follow = on;
      this.init.onFollowChange(on);
    }
  }

  showWhole(animate: boolean) {
    this.setFollow(false);
    this.fit(animate);
  }

  private fit(animate: boolean) {
    this.map.stop();
    this.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    const c = this.init.container;
    const pad = Math.max(0, Math.min(80, Math.floor(Math.min(c.clientWidth, c.clientHeight) / 6)));
    this.map.fitBounds(this.bounds, {
      padding: pad,
      maxZoom: 16,
      pitch: 0,
      bearing: 0,
      duration: animate && !this.init.reducedMotion ? 700 : 0,
    });
  }

  needsFrames(): boolean {
    if (!this.follow || !this.tier || this.tier === "basic") return false;
    const c = this.cam;
    return (
      Math.abs(c.zoom - this.want.zoom) > 0.01 ||
      Math.abs(c.pitch - this.want.pitch) > 0.2 ||
      Math.abs(angleDiff(c.bearing, this.want.bearing)) > 0.3 ||
      Math.abs(c.lng - this.want.lng) > 2e-6 ||
      Math.abs(c.lat - this.want.lat) > 2e-6
    );
  }

  frame(s: TimelineSample, dt: number, playing: boolean) {
    if (this.destroyed || !this.renderer) return;
    poseFor(s, playing, this.pose);
    this.renderer.update(s, this.pose, dt, playing);
    this.updateTravelled(s);
    this.updateNear(s);
    if (this.follow && this.tier && this.tier !== "basic") this.updateCamera(s, dt);
  }

  private updateTravelled(s: TimelineSample) {
    const tl = this.tl;
    const done = s.segmentIndex;
    if (done !== this.doneLeg) {
      this.doneLeg = done;
      for (const sfx of ["solid", "dash"]) {
        this.map.setFilter(`dp-done-${sfx}`, ["all", ["==", ["get", "dashed"], sfx === "dash"], ["<", ["get", "i"], done]]);
      }
      this.partialM = -1;
    }
    const now = performance.now();
    const moved = Math.abs(s.atM - this.partialM);
    if (moved < 0.5 || (moved < 60 && now - this.partialAt < 80)) return;
    this.partialM = s.atM;
    this.partialAt = now;
    const seg = s.segmentIndex;
    const start = tl.legStartM[seg] ?? 0;
    const coords: number[][] = [];
    if (s.phase === "move" && s.atM > start) {
      lngLatAt(tl, start, this.scratch);
      coords.push([this.scratch[0], this.scratch[1]]);
      for (let k = 0; k < tl.coords.length; k++) {
        const m = tl.cum[k];
        if (m > start && m < s.atM) coords.push(tl.coords[k]);
        if (m >= s.atM) break;
      }
      coords.push([s.pos[0], s.pos[1]]);
    }
    const mode = tl.legModes[seg] ?? "walk";
    this.partialFeature.properties.color = MODES[mode].color;
    this.partialFeature.properties.dashed = MODES[mode].dashed;
    this.partialFeature.geometry.coordinates = coords;
    this.partial.features = coords.length >= 2 ? [this.partialFeature] : [];
    (this.map.getSource("dp-done") as GeoJSONSource | undefined)?.setData(this.partial);
  }

  private updateNear(s: TimelineSample) {
    const pins = this.init.pins;
    let changed = false;
    for (let i = 0; i < pins.length; i++) {
      const near = haversine(s.pos, pins[i].lngLat) <= NEAR_M;
      if (near !== this.near[i]) {
        this.near[i] = near;
        pins[i].el.dataset.near = near ? "true" : "false";
        changed = true;
      }
    }
    if (changed) this.updateLabels(true);
  }

  private labelsZoomed: boolean | null = null;

  private updateLabels(force = false) {
    const zoomed = this.map.getZoom() >= LABEL_ZOOM;
    if (!force && zoomed === this.labelsZoomed) return;
    this.labelsZoomed = zoomed;
    const pins = this.init.pins;
    for (let i = 0; i < pins.length; i++) pins[i].el.dataset.label = zoomed || this.near[i] ? "show" : "hide";
  }

  private updateCamera(s: TimelineSample, dt: number) {
    const tier = this.tier as "3d" | "2d";
    const w = this.want;
    const c = this.cam;
    w.zoom = tier === "3d" ? ZOOM_3D[s.mode] : CAM["2d"].zoom;
    w.pitch = CAM[tier].pitch;
    w.lng = s.pos[0];
    w.lat = s.pos[1];
    w.bearing = tier === "3d" && !this.init.reducedMotion ? headingBetween(this.tl, s.atM - 20, s.atM + 90) : 0;
    const kz = 1 - Math.exp(-dt / 0.6);
    c.zoom += (w.zoom - c.zoom) * kz;
    c.pitch += (w.pitch - c.pitch) * kz;
    const kc = 1 - Math.exp(-dt / (tier === "3d" ? 0.3 : 0.45));
    c.lng += (w.lng - c.lng) * kc;
    c.lat += (w.lat - c.lat) * kc;
    const kb = 1 - Math.exp(-dt / 1.1);
    c.bearing = (c.bearing + angleDiff(c.bearing, w.bearing) * kb + 360) % 360;
    const o = this.camOpts;
    o.padding.top = tier === "3d" ? Math.round(this.init.container.clientHeight * 0.28) : 0;
    o.center[0] = c.lng;
    o.center[1] = c.lat;
    o.zoom = c.zoom;
    o.pitch = c.pitch;
    o.bearing = c.bearing;
    this.map.jumpTo(o);
  }

  private loc: LiveLocation | null = null;

  startLocation(hooks: LocationHooks) {
    if (this.destroyed || !this.loaded) return;
    if (!this.loc) {
      const steps = Array.isArray(this.init.doc.steps) ? this.init.doc.steps : [];
      this.loc = new LiveLocation(this.map, this.tl, stepMeters(this.tl, steps), hooks);
    }
    this.loc.start();
  }

  stopLocation() {
    this.loc?.stop();
  }

  followMe(on: boolean) {
    if (on) this.setFollow(false);
    this.loc?.setFollow(on);
  }

  guideMe() {
    this.loc?.guide();
  }

  snapCamera(s: TimelineSample) {
    if (!this.follow || !this.tier || this.tier === "basic") return;
    this.cam.lng = s.pos[0];
    this.cam.lat = s.pos[1];
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.tierToken++;
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    this.loc?.destroy();
    this.loc = null;
    try {
      this.renderer?.destroy();
    } finally {
      this.renderer = null;
    }
    for (const m of this.markers) m.remove();
    this.markers = [];
    this.map.remove();
  }
}
