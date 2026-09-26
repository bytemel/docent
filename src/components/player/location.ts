import { Marker, type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import { haversine } from "@/lib/geo";
import type { Timeline } from "@/lib/timeline";
import type { LngLat } from "@/lib/types";
import {
  acceptFix,
  createNearest,
  createTrack,
  nearestInto,
  SNAP_MIN_M,
  stepAtMeters,
  trackAccuracy,
} from "./track";

export type LocState = "off" | "waiting" | "weak" | "on" | "denied" | "unavailable";
export type GuideState = "idle" | "loading" | "shown" | "failed";

export interface LocStatus {
  state: LocState;
  toGoM: number | null;
  offRouteM: number | null;
  offRoute: boolean;
  arrived: boolean;
  stepIndex: number | null;
  guide: GuideState;
}

export const LOC_OFF: LocStatus = {
  state: "off",
  toGoM: null,
  offRouteM: null,
  offRoute: false,
  arrived: false,
  stepIndex: null,
  guide: "idle",
};

export interface FixOut {
  lng: number;
  lat: number;
  acc: number;
  heading: number | null;
  speed: number | null;
  t: number;
}

export interface LocationHooks {
  onStatus: (s: LocStatus) => void;
  onFollowOff: () => void;
  onFix: (fix: FixOut) => void;
}

export const OFF_ROUTE_M = 60;
const OFF_ROUTE_HOLD_MS = 10000;
const ARRIVE_M = 30;
const WEAK_AFTER = 3;
const MIN_UPDATE_MS = 500;
const GUIDE_REFRESH_MS = 20000;
const GUIDE_MOVE_M = 50;
const SRC = "dp-me";
const GUIDE_SRC = "dp-guide";
const EARTH = 40075016.686;

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export class LiveLocation {
  private map: MLMap;
  private tl: Timeline;
  private stepsM: number[];
  private hooks: LocationHooks;
  private watchId: number | null = null;
  private wanted = false;
  private track = createTrack();
  private near = createNearest();
  private shown: LngLat = [0, 0];
  private heading: number | null = null;
  private lastDraw = 0;
  private pending = false;
  private drawTimer: ReturnType<typeof setTimeout> | undefined;
  private arrow: Marker | null = null;
  private arrowEl: HTMLDivElement;
  private status: LocStatus = { ...LOC_OFF };
  private point = { type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [0, 0] } };
  private offSince = 0;
  private guideOn = false;
  private guideAt: LngLat = [0, 0];
  private guideTime = 0;
  private guideAbort: AbortController | null = null;
  private follow = false;
  private layersAdded = false;
  private fix: FixOut = { lng: 0, lat: 0, acc: 0, heading: null, speed: null, t: 0 };
  private onVis = () => {
    if (document.visibilityState === "hidden") this.clearWatch();
    else if (this.wanted) this.watch();
  };
  private onUserMove = (e: { originalEvent?: unknown }) => {
    if (e.originalEvent && this.follow) {
      this.follow = false;
      this.hooks.onFollowOff();
    }
  };

  constructor(map: MLMap, tl: Timeline, stepsM: number[], hooks: LocationHooks) {
    this.map = map;
    this.tl = tl;
    this.stepsM = stepsM;
    this.hooks = hooks;
    this.arrowEl = document.createElement("div");
    this.arrowEl.innerHTML =
      '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 1 L18 12 L12 9.5 L6 12 Z" style="fill:var(--accent);stroke:var(--surface);stroke-width:1.5"/></svg>';
    document.addEventListener("visibilitychange", this.onVis);
    map.on("dragstart", this.onUserMove);
    map.on("zoomstart", this.onUserMove);
  }

  private emit(patch: Partial<LocStatus>) {
    const s = this.status as unknown as Record<string, unknown>;
    let changed = false;
    for (const [k, v] of Object.entries(patch)) {
      if (s[k] !== v) {
        s[k] = v;
        changed = true;
      }
    }
    if (changed) this.hooks.onStatus({ ...this.status });
  }

  start() {
    if (this.wanted) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      this.emit({ state: "unavailable" });
      return;
    }
    this.wanted = true;
    this.emit({ state: "waiting" });
    this.watch();
  }

  stop() {
    this.wanted = false;
    this.clearWatch();
    this.guideAbort?.abort();
    this.guideOn = false;
    this.follow = false;
    this.track = createTrack();
    this.offSince = 0;
    this.removeLayers();
    this.emit({ ...LOC_OFF });
  }

  setFollow(on: boolean) {
    this.follow = on;
    if (on && this.track.has) this.map.easeTo({ center: this.shown, zoom: Math.max(this.map.getZoom(), 16), duration: 500 });
  }

  guide() {
    this.guideOn = true;
    this.guideTime = 0;
    void this.refreshGuide();
  }

  private watch() {
    if (this.watchId !== null || !navigator.geolocation) return;
    this.watchId = navigator.geolocation.watchPosition(
      (p) => this.onPosition(p),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          this.wanted = false;
          this.clearWatch();
          this.emit({ state: "denied" });
        } else if (!this.track.has) {
          this.emit({ state: "unavailable" });
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
  }

  private clearWatch() {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    clearTimeout(this.drawTimer);
    this.pending = false;
  }

  private onPosition(p: GeolocationPosition) {
    const c = p.coords;
    const tr = this.track;
    const r = acceptFix(tr, c.longitude, c.latitude, c.accuracy, p.timestamp || Date.now());
    if (r === "weak") {
      if (!tr.has && tr.weak >= WEAK_AFTER) this.emit({ state: "weak" });
      return;
    }
    if (r === "jump") return;
    this.heading = c.heading !== null && Number.isFinite(c.heading) && (c.speed ?? tr.speed) > 0.5 ? c.heading : null;
    const acc = trackAccuracy(tr);
    nearestInto(this.tl, tr.lng, tr.lat, this.near);
    const snap = this.near.d <= Math.max(SNAP_MIN_M, acc);
    this.shown[0] = snap ? this.near.lng : tr.lng;
    this.shown[1] = snap ? this.near.lat : tr.lat;
    const f = this.fix;
    f.lng = this.shown[0];
    f.lat = this.shown[1];
    f.acc = Math.round(acc * 10) / 10;
    f.heading = this.heading;
    f.speed = Number.isFinite(c.speed) && c.speed !== null ? c.speed : tr.speed;
    f.t = tr.t;
    this.hooks.onFix(f);
    const wait = MIN_UPDATE_MS - (performance.now() - this.lastDraw);
    if (wait <= 0) this.draw();
    else if (!this.pending) {
      this.pending = true;
      this.drawTimer = setTimeout(() => {
        this.pending = false;
        this.draw();
      }, wait);
    }
  }

  private addLayers() {
    if (this.layersAdded) return;
    const map = this.map;
    const accent = cssVar("--accent", "#c2410c");
    const surface = cssVar("--surface", "#ffffff");
    const ink = cssVar("--ink", "#18181b");
    map.addSource(GUIDE_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "dp-guide",
      type: "line",
      source: GUIDE_SRC,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ink, "line-width": 3, "line-dasharray": [1.5, 1.5], "line-opacity": 0.85 },
    });
    map.addSource(SRC, { type: "geojson", data: this.point });
    map.addLayer({
      id: "dp-me-acc",
      type: "circle",
      source: SRC,
      paint: {
        "circle-radius": 0,
        "circle-color": accent,
        "circle-opacity": 0.14,
        "circle-stroke-color": accent,
        "circle-stroke-width": 1,
        "circle-stroke-opacity": 0.4,
        "circle-pitch-alignment": "map",
      },
    });
    map.addLayer({
      id: "dp-me-dot",
      type: "circle",
      source: SRC,
      paint: { "circle-radius": 8, "circle-color": accent, "circle-stroke-color": surface, "circle-stroke-width": 3 },
    });
    this.layersAdded = true;
  }

  private removeLayers() {
    this.arrow?.remove();
    this.arrow = null;
    if (!this.layersAdded) return;
    for (const id of ["dp-me-dot", "dp-me-acc", "dp-guide"]) if (this.map.getLayer(id)) this.map.removeLayer(id);
    for (const id of [SRC, GUIDE_SRC]) if (this.map.getSource(id)) this.map.removeSource(id);
    this.layersAdded = false;
  }

  private draw() {
    const tr = this.track;
    if (!this.wanted || !tr.has) return;
    this.lastDraw = performance.now();
    this.addLayers();
    this.point.geometry.coordinates[0] = this.shown[0];
    this.point.geometry.coordinates[1] = this.shown[1];
    (this.map.getSource(SRC) as GeoJSONSource | undefined)?.setData(this.point);
    const acc = trackAccuracy(tr);
    const r0 = acc / ((EARTH * Math.cos((this.shown[1] * Math.PI) / 180)) / 512);
    this.map.setPaintProperty("dp-me-acc", "circle-radius", ["interpolate", ["exponential", 2], ["zoom"], 0, r0, 22, r0 * 4194304]);
    if (this.heading !== null) {
      if (!this.arrow) this.arrow = new Marker({ element: this.arrowEl, rotationAlignment: "map", pitchAlignment: "map" });
      this.arrow.setLngLat(this.shown).setRotation(this.heading).addTo(this.map);
    } else if (this.arrow) {
      this.arrow.remove();
      this.arrow = null;
    }
    if (this.follow) this.map.easeTo({ center: this.shown, duration: 400 });

    const tl = this.tl;
    const near = this.near;
    const last = tl.coords[tl.coords.length - 1];
    const toGo = last ? haversine(this.shown, last) : null;
    const hasLine = tl.coords.length > 0;
    const now = this.lastDraw;
    let offRoute = false;
    if (hasLine && near.d > OFF_ROUTE_M) {
      if (!this.offSince) this.offSince = now;
      offRoute = now - this.offSince >= OFF_ROUTE_HOLD_MS;
    } else this.offSince = 0;
    const arrived = toGo !== null && (toGo <= ARRIVE_M || (this.status.arrived && toGo <= OFF_ROUTE_M));
    this.emit({
      state: "on",
      toGoM: toGo === null ? null : Math.round(toGo / 10) * 10,
      offRouteM: hasLine ? Math.round(near.d / 10) * 10 : null,
      offRoute,
      arrived,
      stepIndex: arrived ? this.stepsM.length - 1 : near.d <= OFF_ROUTE_M ? stepAtMeters(this.stepsM, near.atM) : this.status.stepIndex,
    });
    if (near.d <= OFF_ROUTE_M && this.guideOn) {
      this.guideOn = false;
      this.setGuide([]);
      this.emit({ guide: "idle" });
    } else if (this.guideOn) {
      const due = now - this.guideTime > GUIDE_REFRESH_MS || haversine(this.shown, this.guideAt) > GUIDE_MOVE_M;
      if (due) void this.refreshGuide();
    }
  }

  private setGuide(coords: LngLat[]) {
    (this.map.getSource(GUIDE_SRC) as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: coords.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [],
    });
  }

  private async refreshGuide() {
    if (!this.track.has || !this.wanted || this.tl.coords.length < 2) return;
    const me: LngLat = [this.shown[0], this.shown[1]];
    const target: LngLat = [this.near.lng, this.near.lat];
    this.guideAt[0] = me[0];
    this.guideAt[1] = me[1];
    this.guideTime = performance.now();
    this.guideAbort?.abort();
    const ctrl = new AbortController();
    this.guideAbort = ctrl;
    if (this.status.guide !== "shown") this.emit({ guide: "loading" });
    const fmt = (p: LngLat) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
    try {
      const res = await fetch(`/api/route?profile=foot&points=${fmt(me)};${fmt(target)}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error("route");
      const body = (await res.json()) as { geometry?: unknown };
      const g = Array.isArray(body.geometry)
        ? (body.geometry.filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])) as LngLat[])
        : [];
      if (ctrl.signal.aborted || !this.guideOn) return;
      this.setGuide(g.length > 1 ? g : [me, target]);
      this.emit({ guide: "shown" });
    } catch {
      if (ctrl.signal.aborted || !this.guideOn) return;
      this.setGuide([me, target]);
      this.emit({ guide: "failed" });
    }
  }

  destroy() {
    this.stop();
    document.removeEventListener("visibilitychange", this.onVis);
    this.map.off("dragstart", this.onUserMove);
    this.map.off("zoomstart", this.onUserMove);
  }
}
