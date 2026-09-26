import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapLayerMouseEvent, MapLayerTouchEvent, MapMouseEvent, MapTouchEvent } from "maplibre-gl";
import type { Landmark, LngLat, Segment } from "@/lib/types";
import { MODES } from "@/lib/modes";
import { bbox, cumulative, nearestOnLine, pointAt, simplify } from "@/lib/geo";
import { NAIROBI, ensureMapWorker, mapStyleUrl, prefersReducedMotion } from "@/lib/map";
import { t } from "@/strings/editor";
import { waypoints } from "./ops";
import type { Padding, Pending, RouteHit, Tool, ViaRef } from "./types";

export interface MapHandlers {
  onTap(p: LngLat, hit: RouteHit | null): void;
  onMoveWaypoint(index: number, p: LngLat): void;
  onMovePending(which: "start" | "end", p: LngLat): void;
  onMoveVia(segId: string, i: number, p: LngLat): void;
  onSelectVia(v: ViaRef): void;
  onLineDrag(index: number, p: LngLat): void;
  onDrawn(segId: string, line: LngLat[]): void;
  onStyleState?(loading: boolean): void;
}

export interface MapView {
  segments: Segment[];
  pending: Pending;
  landmarks: Landmark[];
  draftLandmark: LngLat | null;
  tool: Tool;
  selectedVia: ViaRef | null;
}

type MarkerKind = "a" | "b" | "stop" | "via" | "draft";

interface Desired {
  key: string;
  kind: MarkerKind;
  pos: LngLat;
  label: string;
  selected?: boolean;
  onEnd?: (p: LngLat) => void;
  onClick?: () => void;
}

interface Rec {
  marker: maplibregl.Marker;
  kind: MarkerKind;
  want: Desired;
}

const SRC_ROUTE = "dc-route";
const SRC_LM = "dc-landmarks";
const SRC_DRAW = "dc-draw";
const HIT = "dc-route-hit";
const LONG_PRESS_MS = 350;

ensureMapWorker(maplibregl);

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const VISUAL: Record<MarkerKind, string> = {
  a: "grid size-8 place-items-center rounded-full border-2 border-surface bg-ink text-sm font-bold text-bg shadow-float",
  b: "grid size-8 place-items-center rounded-full border-2 border-surface bg-accent text-sm font-bold text-accent-ink shadow-float",
  stop: "size-5 rounded-full border-[5px] border-ink bg-surface shadow-float",
  via: "size-4 rounded-full border-2 border-ink bg-white shadow-float",
  draft: "size-5 rounded-full border-[3px] border-surface bg-accent shadow-float",
};

export class MapController {
  map: maplibregl.Map;
  private view: MapView;
  private handlers: MapHandlers;
  private ready = false;
  private markers = new Map<string, Rec>();
  private dragging: string | null = null;
  private justDragged: string | null = null;
  private ghost: maplibregl.Marker | null = null;
  private lineDrag: { index: number; x: number; y: number; moved: boolean; touch: boolean } | null = null;
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private drawSeg: string | null = null;
  private drawPts: LngLat[] | null = null;
  private drawPointer: number | null = null;
  private mq: MediaQueryList | null = null;
  private removed = false;
  private base: Padding = { top: 0, right: 0, bottom: 0, left: 0 };

  constructor(container: HTMLElement, view: MapView, handlers: MapHandlers) {
    this.view = view;
    this.handlers = handlers;
    this.map = new maplibregl.Map({
      container,
      style: mapStyleUrl(),
      center: NAIROBI,
      zoom: 12,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.keyboard.disableRotation();
    this.map.getCanvas().setAttribute("aria-label", t.mapLabel);
    this.map.on("style.load", this.onStyleLoad);
    this.map.on("click", this.onClick);
    this.map.on("mousedown", HIT, this.onLineMouseDown);
    this.map.on("mouseenter", HIT, this.onLineEnter);
    this.map.on("mouseleave", HIT, this.onLineLeave);
    this.map.on("touchstart", HIT, this.onLineTouchStart);
    this.map.on("touchmove", this.onTouchMove);
    this.map.on("touchend", this.onTouchEnd);
    this.map.on("touchcancel", this.onTouchCancel);
    this.map.on("mousemove", this.onMouseMove);
    if (typeof window !== "undefined") {
      this.mq = window.matchMedia("(prefers-color-scheme: dark)");
      this.mq.addEventListener("change", this.onScheme);
    }
  }

  destroy() {
    this.removed = true;
    this.stopDraw();
    this.cancelPress();
    this.mq?.removeEventListener("change", this.onScheme);
    window.removeEventListener("mouseup", this.onMouseUp);
    for (const r of this.markers.values()) r.marker.remove();
    this.markers.clear();
    this.map.remove();
  }

  setHandlers(h: MapHandlers) {
    this.handlers = h;
  }

  setView(view: MapView) {
    const prevTool = this.view.tool;
    this.view = view;
    if (prevTool !== view.tool) this.applyTool(prevTool);
    this.render();
  }

  getCenter(): LngLat {
    const c = this.map.getCenter();
    return [c.lng, c.lat];
  }

  setBase(p: Padding) {
    this.base = p;
    this.map.setPadding(p);
  }

  private extra(p: Padding): Padding {
    return {
      top: Math.max(0, p.top - this.base.top),
      right: Math.max(0, p.right - this.base.right),
      bottom: Math.max(0, p.bottom - this.base.bottom),
      left: Math.max(0, p.left - this.base.left),
    };
  }

  fit(padding: Padding) {
    const coords: LngLat[] = [];
    for (const s of this.view.segments) coords.push(...(s.geometry.length ? s.geometry : [[s.from.lng, s.from.lat] as LngLat]));
    if (!this.view.segments.length) {
      const { start, end } = this.view.pending;
      if (start) coords.push([start.lng, start.lat]);
      if (end) coords.push([end.lng, end.lat]);
    }
    if (!coords.length) return;
    this.map.setPadding(this.base);
    const duration = prefersReducedMotion() ? 0 : 600;
    const [minX, minY, maxX, maxY] = bbox(coords);
    const w = this.map.getContainer().clientWidth;
    const h = this.map.getContainer().clientHeight;
    const b = this.base;
    const e = this.extra(padding);
    const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
    const pad = {
      top: clamp(e.top, (h - b.top - b.bottom) / 2 - 20),
      bottom: clamp(e.bottom, (h - b.top - b.bottom) / 2 - 20),
      left: clamp(e.left, (w - b.left - b.right) / 2 - 20),
      right: clamp(e.right, (w - b.left - b.right) / 2 - 20),
    };
    if (coords.length === 1 || (maxX - minX < 1e-5 && maxY - minY < 1e-5)) {
      this.map.easeTo({
        center: coords[0],
        zoom: Math.max(this.map.getZoom(), 15),
        offset: [(pad.left - pad.right) / 2, (pad.top - pad.bottom) / 2],
        duration,
      });
      return;
    }
    this.map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: pad, maxZoom: 16.5, duration },
    );
  }

  flyTo(p: LngLat, padding: Padding) {
    this.map.setPadding(this.base);
    const e = this.extra(padding);
    this.map.easeTo({
      center: p,
      zoom: Math.max(this.map.getZoom(), 16),
      offset: [(e.left - e.right) / 2, (e.top - e.bottom) / 2],
      duration: prefersReducedMotion() ? 0 : 600,
    });
  }

  private onScheme = () => {
    if (this.removed) return;
    this.ready = false;
    this.handlers.onStyleState?.(true);
    this.map.setStyle(mapStyleUrl(this.mq?.matches ?? false), { diff: false });
  };

  private onStyleLoad = () => {
    if (this.removed) return;
    const casing = cssVar("--surface", "#ffffff");
    const ink = cssVar("--ink", "#18181b");
    const accent = cssVar("--accent", "#c2410c");
    const m = this.map;
    if (!m.getSource(SRC_ROUTE)) m.addSource(SRC_ROUTE, { type: "geojson", data: EMPTY });
    if (!m.getSource(SRC_LM)) m.addSource(SRC_LM, { type: "geojson", data: EMPTY });
    if (!m.getSource(SRC_DRAW)) m.addSource(SRC_DRAW, { type: "geojson", data: EMPTY });
    const round = { "line-cap": "round", "line-join": "round" } as const;
    if (!m.getLayer("dc-route-casing"))
      m.addLayer({
        id: "dc-route-casing",
        type: "line",
        source: SRC_ROUTE,
        layout: round,
        paint: { "line-color": casing, "line-width": 10, "line-opacity": 0.95 },
      });
    if (!m.getLayer("dc-route-solid"))
      m.addLayer({
        id: "dc-route-solid",
        type: "line",
        source: SRC_ROUTE,
        filter: ["==", ["get", "dashed"], false],
        layout: round,
        paint: { "line-color": ["get", "color"], "line-width": 5 },
      });
    if (!m.getLayer("dc-route-dashed"))
      m.addLayer({
        id: "dc-route-dashed",
        type: "line",
        source: SRC_ROUTE,
        filter: ["==", ["get", "dashed"], true],
        layout: { "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 5, "line-dasharray": [1.6, 1.2] },
      });
    if (!m.getLayer(HIT))
      m.addLayer({
        id: HIT,
        type: "line",
        source: SRC_ROUTE,
        layout: round,
        paint: { "line-color": ink, "line-width": 28, "line-opacity": 0.01 },
      });
    if (!m.getLayer("dc-draw"))
      m.addLayer({
        id: "dc-draw",
        type: "line",
        source: SRC_DRAW,
        layout: round,
        paint: { "line-color": ["get", "color"], "line-width": 5, "line-opacity": 0.9 },
      });
    if (!m.getLayer("dc-landmarks"))
      m.addLayer({
        id: "dc-landmarks",
        type: "circle",
        source: SRC_LM,
        paint: {
          "circle-radius": ["case", ["==", ["get", "host"], true], 7, 5.5],
          "circle-color": ["case", ["==", ["get", "host"], true], accent, ink],
          "circle-stroke-color": casing,
          "circle-stroke-width": 2,
        },
      });
    this.ready = true;
    this.handlers.onStyleState?.(false);
    this.render();
  };

  private render() {
    if (this.removed) return;
    this.syncMarkers();
    if (!this.ready) return;
    const route: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: this.view.segments
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.geometry.length >= 2)
        .map(({ s, i }) => ({
          type: "Feature",
          properties: { i, color: MODES[s.mode].color, dashed: MODES[s.mode].dashed },
          geometry: { type: "LineString", coordinates: s.geometry },
        })),
    };
    (this.map.getSource(SRC_ROUTE) as GeoJSONSource | undefined)?.setData(route);
    const lms: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: this.view.landmarks
        .filter((l) => !l.hidden)
        .map((l) => ({
          type: "Feature",
          properties: { id: l.id, host: l.source === "host" },
          geometry: { type: "Point", coordinates: [l.lng, l.lat] },
        })),
    };
    (this.map.getSource(SRC_LM) as GeoJSONSource | undefined)?.setData(lms);
    this.renderDraw();
  }

  private renderDraw() {
    if (!this.ready) return;
    const src = this.map.getSource(SRC_DRAW) as GeoJSONSource | undefined;
    const seg = this.drawSeg ? this.view.segments.find((s) => s.id === this.drawSeg) : null;
    if (!src) return;
    if (!seg || !this.drawPts || this.drawPts.length < 1) {
      src.setData(EMPTY);
      return;
    }
    src.setData({
      type: "Feature",
      properties: { color: MODES[seg.mode].color },
      geometry: { type: "LineString", coordinates: [[seg.from.lng, seg.from.lat], ...this.drawPts] },
    });
  }

  private desired(): Desired[] {
    const v = this.view;
    const out: Desired[] = [];
    if (v.segments.length) {
      const wps = waypoints(v.segments);
      const last = wps.length - 1;
      wps.forEach((w, i) => {
        const kind: MarkerKind = i === 0 ? "a" : i === last ? "b" : "stop";
        out.push({
          key: `wp:${i}`,
          kind,
          pos: [w.lng, w.lat],
          label: kind === "a" ? t.markerStart : kind === "b" ? t.markerEnd : t.markerStop,
          onEnd: (p) => this.handlers.onMoveWaypoint(i, p),
        });
      });
      for (const s of v.segments) {
        if (s.drawn) continue;
        s.vias.forEach((p, i) =>
          out.push({
            key: `via:${s.id}:${i}`,
            kind: "via",
            pos: p,
            label: t.markerVia,
            selected: v.selectedVia?.segId === s.id && v.selectedVia.i === i,
            onEnd: (q) => this.handlers.onMoveVia(s.id, i, q),
            onClick: () => this.handlers.onSelectVia({ segId: s.id, i }),
          }),
        );
      }
    } else {
      const { start, end } = v.pending;
      if (start)
        out.push({
          key: "p:start",
          kind: "a",
          pos: [start.lng, start.lat],
          label: t.markerStart,
          onEnd: (p) => this.handlers.onMovePending("start", p),
        });
      if (end)
        out.push({
          key: "p:end",
          kind: "b",
          pos: [end.lng, end.lat],
          label: t.markerEnd,
          onEnd: (p) => this.handlers.onMovePending("end", p),
        });
    }
    if (v.draftLandmark) out.push({ key: "lm:draft", kind: "draft", pos: v.draftLandmark, label: t.hintLandmark });
    return out;
  }

  private makeElement(want: Desired): HTMLElement {
    const el = document.createElement("div");
    el.className = "grid size-11 cursor-grab place-items-center";
    const inner = document.createElement("div");
    inner.className = VISUAL[want.kind];
    if (want.kind === "a") inner.textContent = "A";
    if (want.kind === "b") inner.textContent = "B";
    el.appendChild(inner);
    return el;
  }

  private syncMarkers() {
    const wants = this.desired();
    const seen = new Set<string>();
    const drawing = this.view.tool.kind === "draw";
    for (const want of wants) {
      seen.add(want.key);
      let rec = this.markers.get(want.key);
      if (rec && rec.kind !== want.kind) {
        rec.marker.remove();
        this.markers.delete(want.key);
        rec = undefined;
      }
      if (!rec) {
        const el = this.makeElement(want);
        const marker = new maplibregl.Marker({ element: el, draggable: !!want.onEnd, anchor: "center" })
          .setLngLat(want.pos)
          .addTo(this.map);
        const r: Rec = { marker, kind: want.kind, want };
        marker.on("dragstart", () => {
          this.dragging = want.key;
        });
        marker.on("dragend", () => {
          this.dragging = null;
          this.justDragged = want.key;
          setTimeout(() => {
            if (this.justDragged === want.key) this.justDragged = null;
          }, 50);
          const ll = marker.getLngLat();
          r.want.onEnd?.([ll.lng, ll.lat]);
        });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.justDragged === want.key) return;
          r.want.onClick?.();
        });
        this.markers.set(want.key, r);
        rec = r;
      }
      rec.want = want;
      const el = rec.marker.getElement();
      el.setAttribute("aria-label", want.label);
      el.setAttribute("title", want.label);
      el.style.pointerEvents = drawing ? "none" : "";
      const inner = el.firstElementChild as HTMLElement | null;
      if (inner) inner.style.outline = want.selected ? "3px solid var(--accent)" : "";
      if (this.dragging !== want.key) {
        const cur = rec.marker.getLngLat();
        if (cur.lng !== want.pos[0] || cur.lat !== want.pos[1]) rec.marker.setLngLat(want.pos);
      }
    }
    for (const [key, rec] of this.markers) {
      if (!seen.has(key)) {
        rec.marker.remove();
        this.markers.delete(key);
      }
    }
  }

  private hitTest(p: LngLat, onlySeg?: string): RouteHit | null {
    const click = this.map.project(p);
    let best: RouteHit | null = null;
    this.view.segments.forEach((s, index) => {
      if (onlySeg && s.id !== onlySeg) return;
      if (s.geometry.length < 2) return;
      const cum = cumulative(s.geometry);
      const { atM } = nearestOnLine(p, s.geometry, cum);
      const pos = pointAt(s.geometry, cum, atM).pos;
      const q = this.map.project(pos);
      const px = Math.hypot(q.x - click.x, q.y - click.y);
      if (!best || px < best.px) best = { index, pos, px };
    });
    return best;
  }

  private onClick = (e: MapMouseEvent) => {
    const target = e.originalEvent?.target as HTMLElement | null;
    if (target?.closest?.(".maplibregl-marker")) return;
    if (this.view.tool.kind === "draw" || this.lineDrag) return;
    const p: LngLat = [e.lngLat.lng, e.lngLat.lat];
    const tool = this.view.tool;
    const hit = this.hitTest(p, tool.kind === "split" ? tool.segId : undefined);
    this.handlers.onTap(p, hit);
  };

  private onLineEnter = () => {
    if (this.view.tool.kind === "none") this.map.getCanvas().style.cursor = "grab";
  };

  private onLineLeave = () => {
    if (this.view.tool.kind === "none" && !this.lineDrag) this.map.getCanvas().style.cursor = "";
  };

  private featureIndex(e: MapLayerMouseEvent | MapLayerTouchEvent): number | null {
    const i = e.features?.[0]?.properties?.i;
    return typeof i === "number" ? i : null;
  }

  private onLineMouseDown = (e: MapLayerMouseEvent) => {
    if (this.view.tool.kind !== "none" || e.originalEvent.button !== 0) return;
    const index = this.featureIndex(e);
    if (index === null) return;
    e.preventDefault();
    this.lineDrag = { index, x: e.point.x, y: e.point.y, moved: false, touch: false };
    window.addEventListener("mouseup", this.onMouseUp, { once: true });
  };

  private onMouseMove = (e: MapMouseEvent) => {
    const d = this.lineDrag;
    if (!d || d.touch) return;
    if (!d.moved && Math.hypot(e.point.x - d.x, e.point.y - d.y) < 4) return;
    d.moved = true;
    this.map.getCanvas().style.cursor = "grabbing";
    this.showGhost([e.lngLat.lng, e.lngLat.lat]);
  };

  private onMouseUp = () => {
    const d = this.lineDrag;
    this.lineDrag = null;
    this.map.getCanvas().style.cursor = "";
    const g = this.hideGhost();
    if (d && d.moved && g) this.handlers.onLineDrag(d.index, g);
  };

  private onLineTouchStart = (e: MapLayerTouchEvent) => {
    if (this.view.tool.kind !== "none" || e.points.length !== 1) return;
    const index = this.featureIndex(e);
    if (index === null) return;
    this.cancelPress();
    const start = { x: e.point.x, y: e.point.y };
    const at: LngLat = [e.lngLat.lng, e.lngLat.lat];
    this.lineDrag = { index, x: start.x, y: start.y, moved: false, touch: true };
    this.pressTimer = setTimeout(() => {
      this.pressTimer = null;
      if (!this.lineDrag) return;
      this.lineDrag.moved = true;
      this.map.dragPan.disable();
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(15);
      this.showGhost(at);
    }, LONG_PRESS_MS);
  };

  private onTouchMove = (e: MapTouchEvent) => {
    const d = this.lineDrag;
    if (!d || !d.touch) return;
    if (!d.moved) {
      if (Math.hypot(e.point.x - d.x, e.point.y - d.y) > 10 || e.points.length > 1) {
        this.cancelPress();
        this.lineDrag = null;
      }
      return;
    }
    e.preventDefault();
    this.showGhost([e.lngLat.lng, e.lngLat.lat]);
  };

  private onTouchEnd = () => {
    const d = this.lineDrag;
    if (!d || !d.touch) return;
    this.cancelPress();
    this.lineDrag = null;
    const g = this.hideGhost();
    if (d.moved) {
      this.map.dragPan.enable();
      if (g) this.handlers.onLineDrag(d.index, g);
    }
  };

  private onTouchCancel = () => {
    const d = this.lineDrag;
    if (!d || !d.touch) return;
    this.cancelPress();
    this.lineDrag = null;
    this.hideGhost();
    if (d.moved) this.map.dragPan.enable();
  };

  private cancelPress() {
    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  private showGhost(p: LngLat) {
    if (!this.ghost) {
      const el = document.createElement("div");
      el.className = VISUAL.via;
      el.style.pointerEvents = "none";
      this.ghost = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(p).addTo(this.map);
    } else this.ghost.setLngLat(p);
  }

  private hideGhost(): LngLat | null {
    if (!this.ghost) return null;
    const ll = this.ghost.getLngLat();
    this.ghost.remove();
    this.ghost = null;
    return [ll.lng, ll.lat];
  }

  private applyTool(prev: Tool) {
    const tool = this.view.tool;
    if (prev.kind === "draw") this.stopDraw();
    if (tool.kind === "draw") this.startDraw(tool.segId);
    const canvas = this.map.getCanvas();
    canvas.style.cursor = tool.kind === "none" ? "" : "crosshair";
  }

  private startDraw(segId: string) {
    this.drawSeg = segId;
    this.drawPts = null;
    this.map.dragPan.disable();
    this.map.touchZoomRotate.disable();
    this.map.doubleClickZoom.disable();
    this.map.boxZoom.disable();
    const c = this.map.getCanvasContainer();
    c.style.touchAction = "none";
    c.addEventListener("pointerdown", this.onDrawDown);
    c.addEventListener("pointermove", this.onDrawMove);
    c.addEventListener("pointerup", this.onDrawUp);
    c.addEventListener("pointercancel", this.onDrawCancel);
  }

  private stopDraw() {
    if (this.drawSeg === null) return;
    this.drawSeg = null;
    this.drawPts = null;
    this.drawPointer = null;
    if (this.removed) return;
    const c = this.map.getCanvasContainer();
    c.style.touchAction = "";
    c.removeEventListener("pointerdown", this.onDrawDown);
    c.removeEventListener("pointermove", this.onDrawMove);
    c.removeEventListener("pointerup", this.onDrawUp);
    c.removeEventListener("pointercancel", this.onDrawCancel);
    this.map.dragPan.enable();
    this.map.touchZoomRotate.enable();
    this.map.touchZoomRotate.disableRotation();
    this.map.doubleClickZoom.enable();
    this.map.boxZoom.enable();
    this.renderDraw();
  }

  private toLngLat(e: PointerEvent): LngLat {
    const rect = this.map.getCanvasContainer().getBoundingClientRect();
    const ll = this.map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
    return [ll.lng, ll.lat];
  }

  private onDrawDown = (e: PointerEvent) => {
    if (!e.isPrimary || this.drawPointer !== null) return;
    e.preventDefault();
    this.drawPointer = e.pointerId;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      return;
    }
    this.drawPts = [this.toLngLat(e)];
    this.renderDraw();
  };

  private onDrawMove = (e: PointerEvent) => {
    if (e.pointerId !== this.drawPointer || !this.drawPts) return;
    e.preventDefault();
    const p = this.toLngLat(e);
    const last = this.drawPts[this.drawPts.length - 1];
    const a = this.map.project(last);
    const b = this.map.project(p);
    if (Math.hypot(a.x - b.x, a.y - b.y) < 3) return;
    this.drawPts.push(p);
    this.renderDraw();
  };

  private onDrawUp = (e: PointerEvent) => {
    if (e.pointerId !== this.drawPointer) return;
    const pts = this.drawPts ?? [];
    const segId = this.drawSeg;
    this.drawPointer = null;
    this.drawPts = null;
    this.renderDraw();
    if (segId && pts.length >= 2) this.handlers.onDrawn(segId, simplify(pts, 3));
  };

  private onDrawCancel = () => {
    this.drawPointer = null;
    this.drawPts = null;
    this.renderDraw();
  };
}
