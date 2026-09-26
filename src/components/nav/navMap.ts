import { getVersion, LngLatBounds, Map as MLMap, Marker, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import { bbox } from "@/lib/geo";
import { ensureMapWorker, mapStyleUrl, NAIROBI } from "@/lib/map";
import { MODES } from "@/lib/modes";
import type { NavRoute } from "@/lib/nav";
import type { LngLat } from "@/lib/types";

export type Follow = "heading" | "north" | "off";

export interface MapOption {
  id: string;
  geometry: LngLat[];
  selected: boolean;
  tag: string;
  time: string;
  at: LngLat;
}

export interface NavMapInit {
  container: HTMLElement;
  dark: boolean;
  center?: LngLat;
  onClick?: (p: LngLat) => void;
  onUserMove?: () => void;
  onReady?: () => void;
  padding: () => { top: number; bottom: number; left: number; right: number };
}

const EMPTY = { type: "FeatureCollection" as const, features: [] };

function circle(center: LngLat, radiusM: number): number[][] {
  const out: number[][] = [];
  const dLat = radiusM / 111320;
  const dLng = dLat / Math.max(0.01, Math.cos((center[1] * Math.PI) / 180));
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    out.push([center[0] + Math.cos(a) * dLng, center[1] + Math.sin(a) * dLat]);
  }
  return out;
}

function pinEl(): HTMLElement {
  const el = document.createElement("span");
  el.className = "block size-7 rounded-[9px] border-[4px] border-accent bg-sign shadow-float";
  el.setAttribute("aria-hidden", "true");
  return el;
}

function tagEl(o: MapOption, onSelect: ((id: string) => void) | null): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `min-h-11 min-w-11 rounded-[10px] border-[1.5px] px-2 py-1 text-left text-[13px] leading-tight font-bold shadow-float ${
    o.selected ? "border-sign bg-sign text-sign-ink" : "border-line bg-surface text-ink"
  }`;
  el.setAttribute("aria-pressed", String(o.selected));
  const a = document.createElement("span");
  a.className = "block";
  a.textContent = o.tag;
  const b = document.createElement("span");
  b.className = "num block font-semibold opacity-80";
  b.textContent = o.time;
  el.append(a, b);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect?.(o.id);
  });
  return el;
}

function meEl(): { el: HTMLElement; cone: HTMLElement } {
  const el = document.createElement("div");
  el.className = "relative flex size-16 items-center justify-center";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML =
    '<span data-cone class="absolute inset-0 hidden"><svg viewBox="0 0 64 64" class="h-full w-full"><path d="M32 2 L46 26 Q32 20 18 26 Z" fill="var(--accent)" stroke="var(--sign)" stroke-width="2.5" stroke-linejoin="round"/></svg></span>' +
    '<span class="relative size-6 rounded-full border-[4px] border-sign bg-accent shadow-float"></span>';
  return { el, cone: el.querySelector("[data-cone]") as HTMLElement };
}

export class NavMap {
  map: MLMap;
  private onUserMove: (() => void) | null = null;
  private onOption: ((id: string) => void) | null = null;
  private tags: Marker[] = [];
  private ready = false;
  private destroyed = false;
  private route: NavRoute | null = null;
  private dest: Marker | null = null;
  private me: { marker: Marker; cone: HTMLElement } | null = null;
  private follow: Follow = "off";
  private movedAt = -Infinity;
  private pending: (() => void)[] = [];
  private dark: boolean;

  constructor(private init: NavMapInit) {
    this.dark = init.dark;
    ensureMapWorker({ setWorkerUrl, getVersion });
    this.map = new MLMap({
      container: init.container,
      style: mapStyleUrl(init.dark),
      center: init.center ?? NAIROBI,
      zoom: init.center ? 15 : 12,
      attributionControl: { compact: true },
      fadeDuration: 0,
      maxPitch: 60,
    });
    this.map.setMissingStyleImageResolver((id) => {
      if (!this.map.hasImage(id)) this.map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    const userMove = (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent) return;
      init.onUserMove?.();
      this.onUserMove?.();
    };
    this.map.on("dragstart", userMove);
    this.map.on("zoomstart", userMove);
    this.map.on("rotatestart", userMove);
    this.map.on("click", (e) => {
      const hit = this.map.getLayer("nv-opt-hit")
        ? this.map.queryRenderedFeatures(e.point, { layers: ["nv-opt-hit"] })[0]
        : undefined;
      if (hit && this.onOption) this.onOption(String(hit.properties?.id));
      else init.onClick?.([e.lngLat.lng, e.lngLat.lat]);
    });
    this.map.once("load", () => {
      if (this.destroyed) return;
      this.addLayers();
      this.ready = true;
      this.pending.splice(0).forEach((f) => f());
      init.onReady?.();
    });
  }

  private whenReady(f: () => void) {
    if (this.ready) f();
    else this.pending.push(f);
  }

  private addLayers() {
    const map = this.map;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ffc61a";
    map.addSource("nv-opt", { type: "geojson", data: EMPTY });
    map.addSource("nv-route", { type: "geojson", data: EMPTY });
    const optWidth = ["interpolate", ["linear"], ["zoom"], 12, 5, 18, 12] as unknown as number;
    map.addLayer({
      id: "nv-opt-rest",
      type: "line",
      source: "nv-opt",
      filter: ["==", ["get", "sel"], false],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ["get", "color"], "line-width": optWidth, "line-opacity": 0.5 },
    });
    map.addLayer({
      id: "nv-opt-casing",
      type: "line",
      source: "nv-opt",
      filter: ["==", ["get", "sel"], true],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": this.dark ? "#0d0f11" : "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 8, 18, 18],
      },
    });
    map.addLayer({
      id: "nv-opt-sel",
      type: "line",
      source: "nv-opt",
      filter: ["==", ["get", "sel"], true],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ["get", "color"], "line-width": optWidth },
    });
    map.addLayer({
      id: "nv-opt-hit",
      type: "line",
      source: "nv-opt",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#000000", "line-width": 28, "line-opacity": 0 },
    });
    map.addSource("nv-acc", { type: "geojson", data: EMPTY });
    const layout = { "line-join": "round" as const, "line-cap": "round" as const };
    map.addLayer({
      id: "nv-casing",
      type: "line",
      source: "nv-route",
      layout,
      paint: {
        "line-color": this.dark ? "#0d0f11" : "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 7, 18, 18],
      },
    });
    const width = ["interpolate", ["linear"], ["zoom"], 12, 4, 18, 11] as unknown as number;
    for (const dashed of [false, true]) {
      map.addLayer({
        id: `nv-route-${dashed ? "dash" : "solid"}`,
        type: "line",
        source: "nv-route",
        filter: ["==", ["get", "dashed"], dashed],
        layout,
        paint: { "line-color": ["get", "color"], "line-width": width, ...(dashed ? { "line-dasharray": [1.1, 1.3] } : {}) },
      });
    }
    map.addLayer({ id: "nv-acc-fill", type: "fill", source: "nv-acc", paint: { "fill-color": accent, "fill-opacity": 0.16 } });
    map.addLayer({
      id: "nv-acc-line",
      type: "line",
      source: "nv-acc",
      paint: { "line-color": accent, "line-opacity": 0.6, "line-width": 1.5 },
    });
  }

  setRoute(route: NavRoute | null, fit = false) {
    this.route = route;
    this.whenReady(() => {
      const features = (route?.legs ?? []).map((leg) => {
        const coords: LngLat[] = [];
        route!.coords.forEach((c, k) => {
          const m = route!.cum[k];
          if (m >= leg.startM - 1e-6 && m <= leg.endM + 1e-6) coords.push(c);
        });
        return {
          type: "Feature" as const,
          properties: { color: MODES[leg.mode].color, dashed: MODES[leg.mode].dashed },
          geometry: { type: "LineString" as const, coordinates: coords.length >= 2 ? coords : route!.coords },
        };
      });
      (this.map.getSource("nv-route") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
      if (fit && route) this.fitRoute();
    });
  }

  fitRoute(extra: LngLat[] = []) {
    const pts = [...(this.route?.coords ?? []), ...extra];
    if (!pts.length) return;
    const b = bbox(pts);
    this.map.fitBounds(new LngLatBounds([b[0], b[1]], [b[2], b[3]]), {
      padding: this.init.padding(),
      maxZoom: 16,
      duration: 600,
      bearing: 0,
      pitch: 0,
    });
  }

  setOptions(list: MapOption[], color: string, onSelect: ((id: string) => void) | null) {
    this.onOption = onSelect;
    this.whenReady(() => {
      const ordered = [...list].sort((a, b) => Number(a.selected) - Number(b.selected));
      (this.map.getSource("nv-opt") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: ordered.map((o) => ({
          type: "Feature" as const,
          properties: { id: o.id, sel: o.selected, color },
          geometry: { type: "LineString" as const, coordinates: o.geometry },
        })),
      });
      this.tags.forEach((t) => t.remove());
      this.tags = list.length > 1 ? list.map((o) => new Marker({ element: tagEl(o, onSelect) }).setLngLat(o.at).addTo(this.map)) : [];
    });
  }

  fitPoints(pts: LngLat[]) {
    if (!pts.length) return;
    this.whenReady(() => {
      const b = bbox(pts);
      this.map.fitBounds(new LngLatBounds([b[0], b[1]], [b[2], b[3]]), {
        padding: this.init.padding(),
        maxZoom: 16.5,
        duration: 600,
        bearing: 0,
        pitch: 0,
      });
    });
  }

  setDest(p: LngLat | null, fly = false) {
    this.whenReady(() => {
      if (!p) {
        this.dest?.remove();
        this.dest = null;
        return;
      }
      if (!this.dest) this.dest = new Marker({ element: pinEl() }).setLngLat(p).addTo(this.map);
      this.dest.setLngLat(p);
      if (fly) this.map.easeTo({ center: p, zoom: Math.max(this.map.getZoom(), 15), padding: this.init.padding(), duration: 600 });
    });
  }

  setMe(pos: LngLat, accM: number, heading: number | null) {
    this.whenReady(() => {
      if (!this.me) {
        const d = meEl();
        this.me = { marker: new Marker({ element: d.el, rotationAlignment: "map" }).setLngLat(pos).addTo(this.map), cone: d.cone };
      }
      this.me.marker.setLngLat(pos);
      this.me.cone.classList.toggle("hidden", heading === null);
      if (heading !== null) this.me.marker.setRotation(heading);
      (this.map.getSource("nv-acc") as GeoJSONSource | undefined)?.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [circle(pos, Math.max(4, accM))] },
      });
    });
  }

  setCreditOffset(px: number) {
    const el = this.map.getContainer().querySelector<HTMLElement>(".maplibregl-ctrl-bottom-right");
    if (el) el.style.bottom = `${Math.round(px)}px`;
  }

  setUserMove(cb: (() => void) | null) {
    this.onUserMove = cb;
  }

  setFollow(mode: Follow) {
    this.follow = mode;
    this.movedAt = -Infinity;
  }

  track(pos: LngLat, heading: number | null, zoom: number) {
    if (!this.ready || this.follow === "off") return;
    const now = performance.now();
    if (now - this.movedAt < 800) return;
    this.movedAt = now;
    const headingUp = this.follow === "heading" && heading !== null;
    this.map.easeTo({
      center: pos,
      zoom,
      bearing: headingUp ? heading! : this.follow === "north" ? 0 : this.map.getBearing(),
      pitch: this.follow === "heading" ? 40 : 0,
      padding: this.init.padding(),
      duration: 900,
      easing: (t) => t,
    });
  }

  resize() {
    this.map.resize();
  }

  destroy() {
    this.destroyed = true;
    this.dest?.remove();
    this.me?.marker.remove();
    this.tags.forEach((t) => t.remove());
    this.map.remove();
  }
}
