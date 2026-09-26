import { LngLatBounds, Map as MLMap, Marker, setWorkerUrl, getVersion, type GeoJSONSource } from "maplibre-gl";
import { bbox } from "@/lib/geo";
import { FILTER } from "@/lib/liveFilter";
import { ensureMapWorker, mapStyleUrl } from "@/lib/map";
import { MODES } from "@/lib/modes";
import type { Timeline } from "@/lib/timeline";
import type { LngLat, RouteDoc } from "@/lib/types";

export interface TrailPoint {
  pos: LngLat;
  at: number;
}

export interface GuestView {
  pos: LngLat;
  acc: number;
  heading: number | null;
  live: boolean;
  trail: TrailPoint[];
  now: number;
}

export interface LiveMapInit {
  container: HTMLElement;
  doc: RouteDoc;
  tl: Timeline;
  dark: boolean;
  labels: { start: string; destination: string; guest: string };
  onFollowChange: (on: boolean) => void;
  onReady: () => void;
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

function endpoint(which: "a" | "b", label: string): HTMLElement {
  const el = document.createElement("span");
  el.title = label;
  el.setAttribute("aria-label", label);
  el.textContent = which === "a" ? "A" : "B";
  el.className =
    which === "a"
      ? "flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-ink text-sm font-bold text-bg shadow-float"
      : "flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-accent text-sm font-bold text-accent-ink shadow-float";
  return el;
}

function guestDot(label: string): { el: HTMLElement; arrow: HTMLElement } {
  const el = document.createElement("div");
  el.className = "group relative flex h-14 w-14 items-center justify-center";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", label);
  el.dataset.live = "true";
  el.innerHTML =
    '<span class="absolute h-8 w-8 rounded-full bg-accent opacity-30 motion-safe:animate-ping group-data-[live=false]:hidden"></span>' +
    '<span data-arrow class="absolute inset-0 hidden transition-transform duration-500"><svg viewBox="0 0 56 56" class="h-full w-full" aria-hidden="true"><path d="M28 2 L36 16 L28 13 L20 16 Z" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" stroke-linejoin="round"/></svg></span>' +
    '<span class="relative h-5 w-5 rounded-full border-[3px] border-surface bg-accent shadow-float group-data-[live=false]:bg-ink-3"></span>';
  return { el, arrow: el.querySelector("[data-arrow]") as HTMLElement };
}

export class LiveMap {
  private map: MLMap;
  private bounds: LngLatBounds;
  private follow = true;
  private ready = false;
  private destroyed = false;
  private markers: Marker[] = [];
  private dot: { el: HTMLElement; arrow: HTMLElement; marker: Marker } | null = null;
  private last: GuestView | null = null;
  private accent: string;
  private centredAt = -Infinity;

  constructor(private init: LiveMapInit) {
    const coords = init.tl.coords.length ? init.tl.coords : ([[36.8219, -1.2921]] as LngLat[]);
    const b = bbox(coords);
    this.bounds = new LngLatBounds([b[0], b[1]], [b[2], b[3]]);
    this.accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#d9480f";
    ensureMapWorker({ setWorkerUrl, getVersion });
    this.map = new MLMap({
      container: init.container,
      style: mapStyleUrl(init.dark),
      bounds: this.bounds,
      fitBoundsOptions: { padding: this.padding(), maxZoom: 16 },
      attributionControl: { compact: true },
      fadeDuration: 0,
    });
    const userMove = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent && this.follow) this.setFollow(false);
    };
    this.map.on("dragstart", userMove);
    this.map.on("zoomstart", userMove);
    this.map.on("rotatestart", userMove);
    this.map.setMissingStyleImageResolver((id) => {
      if (!this.map.hasImage(id)) this.map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    this.map.once("load", () => {
      if (this.destroyed) return;
      this.addRoute();
      this.addGuestLayers();
      this.addMarkers();
      this.ready = true;
      if (this.last) this.setGuest(this.last);
      init.onReady();
    });
  }

  private padding() {
    const w = this.init.container.clientWidth;
    const h = this.init.container.clientHeight;
    if (w >= 640) return { top: 48, bottom: 48, left: Math.min(420, Math.max(0, w - 220)), right: 48 };
    return { top: 32, bottom: Math.min(300, Math.max(0, h - 200)), left: 24, right: 24 };
  }

  private addRoute() {
    const { doc, tl } = this.init;
    const features = doc.segments.map((seg, i) => {
      const coords: LngLat[] = [];
      for (let k = 0; k < tl.coords.length; k++) {
        const m = tl.cum[k];
        if (m >= tl.legStartM[i] - 1e-6 && m <= tl.legEndM[i] + 1e-6) coords.push(tl.coords[k]);
      }
      if (coords.length < 2) coords.push([seg.from.lng, seg.from.lat], [seg.to.lng, seg.to.lat]);
      return {
        type: "Feature" as const,
        properties: { color: MODES[seg.mode].color, dashed: MODES[seg.mode].dashed },
        geometry: { type: "LineString" as const, coordinates: coords },
      };
    });
    const map = this.map;
    map.addSource("lv-route", { type: "geojson", data: { type: "FeatureCollection", features } });
    const layout = { "line-join": "round" as const, "line-cap": "round" as const };
    map.addLayer({
      id: "lv-casing",
      type: "line",
      source: "lv-route",
      layout,
      paint: {
        "line-color": this.init.dark ? "#1b1b1e" : "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 6, 17, 13],
        "line-opacity": 0.9,
      },
    });
    const width = ["interpolate", ["linear"], ["zoom"], 12, 3, 17, 7] as unknown as number;
    for (const dashed of [false, true]) {
      map.addLayer({
        id: `lv-route-${dashed ? "dash" : "solid"}`,
        type: "line",
        source: "lv-route",
        filter: ["==", ["get", "dashed"], dashed],
        layout,
        paint: {
          "line-color": ["get", "color"],
          "line-width": width,
          ...(dashed ? { "line-dasharray": [1.2, 1.4] } : {}),
        },
      });
    }
  }

  private addGuestLayers() {
    const map = this.map;
    map.addSource("lv-acc", { type: "geojson", data: EMPTY });
    map.addSource("lv-trail", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "lv-acc-fill",
      type: "fill",
      source: "lv-acc",
      paint: { "fill-color": this.accent, "fill-opacity": 0.12 },
    });
    map.addLayer({
      id: "lv-acc-line",
      type: "line",
      source: "lv-acc",
      paint: { "line-color": this.accent, "line-opacity": 0.35, "line-width": 1 },
    });
    map.addLayer({
      id: "lv-trail",
      type: "line",
      source: "lv-trail",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": this.accent, "line-width": 4, "line-opacity": ["get", "o"] },
    });
  }

  private addMarkers() {
    const { tl, labels } = this.init;
    const first = tl.coords[0];
    const last = tl.coords[tl.coords.length - 1];
    if (first) this.markers.push(new Marker({ element: endpoint("a", labels.start) }).setLngLat(first).addTo(this.map));
    if (last) this.markers.push(new Marker({ element: endpoint("b", labels.destination) }).setLngLat(last).addTo(this.map));
  }

  setGuest(v: GuestView) {
    this.last = v;
    if (!this.ready || this.destroyed) return;
    if (!this.dot) {
      const d = guestDot(this.init.labels.guest);
      this.dot = { ...d, marker: new Marker({ element: d.el }).setLngLat(v.pos).addTo(this.map) };
    }
    this.dot.marker.setLngLat(v.pos);
    this.dot.el.dataset.live = String(v.live);
    if (v.heading === null || !v.live) this.dot.arrow.classList.add("hidden");
    else {
      this.dot.arrow.classList.remove("hidden");
      this.dot.arrow.style.transform = `rotate(${v.heading - this.map.getBearing()}deg)`;
    }
    (this.map.getSource("lv-acc") as GeoJSONSource | undefined)?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [circle(v.pos, Math.max(5, v.acc))] },
    });
    const features = [];
    for (let i = 1; i < v.trail.length; i++) {
      const age = v.now - v.trail[i].at;
      if (age > FILTER.trailMs) continue;
      features.push({
        type: "Feature" as const,
        properties: { o: Math.max(0.05, 0.7 * (1 - age / FILTER.trailMs)) },
        geometry: { type: "LineString" as const, coordinates: [v.trail[i - 1].pos, v.trail[i].pos] },
      });
    }
    (this.map.getSource("lv-trail") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
    if (this.follow) this.centre(v.pos);
  }

  private centre(pos: LngLat, force = false) {
    const now = performance.now();
    if (!force && now - this.centredAt < 900) return;
    this.centredAt = now;
    this.map.easeTo({ center: pos, zoom: Math.max(this.map.getZoom(), 15), padding: this.padding(), duration: 800 });
  }

  setFollow(on: boolean) {
    if (on === this.follow) return;
    this.follow = on;
    this.init.onFollowChange(on);
    if (on && this.last && this.ready) this.centre(this.last.pos, true);
  }

  resize() {
    this.map.resize();
  }

  destroy() {
    this.destroyed = true;
    for (const m of this.markers) m.remove();
    this.dot?.marker.remove();
    this.map.remove();
  }
}
