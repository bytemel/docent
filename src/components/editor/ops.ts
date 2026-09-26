import type { Landmark, LngLat, Mode, RouteDoc, Segment, Step, Waypoint } from "@/lib/types";
import { MODES, estimateSeconds } from "@/lib/modes";
import { t } from "@/strings/editor";
import { cumulative, haversine, lineLength, nearestOnLine, pointAt, uid } from "@/lib/geo";

export const MAX_VIAS = 23;

const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
const ll = (w: Waypoint): LngLat => [w.lng, w.lat];

export function legPoints(seg: Segment): LngLat[] {
  return [ll(seg.from), ...seg.vias, ll(seg.to)];
}

export function segKey(seg: Segment): string {
  return `${MODES[seg.mode].profile}|${legPoints(seg)
    .map(([a, b]) => `${r5(a)},${r5(b)}`)
    .join(";")}`;
}

function measured(seg: Segment, geometry: LngLat[]): Segment {
  const distanceM = Math.round(lineLength(geometry));
  return { ...seg, geometry, distanceM, durationS: estimateSeconds(seg.mode, distanceM) };
}

export function straight(seg: Segment): Segment {
  return measured(seg, legPoints(seg));
}

export function newSegment(from: Waypoint, to: Waypoint, mode: Mode = "walk", id = uid()): Segment {
  return straight({ id, mode, from, to, vias: [], drawn: false, geometry: [], distanceM: 0, durationS: 0 });
}

export function withRoute(seg: Segment, geometry: LngLat[]): Segment {
  const g = geometry.slice();
  const a = ll(seg.from);
  const b = ll(seg.to);
  if (!g.length || haversine(g[0], a) > 1) g.unshift(a);
  else g[0] = a;
  if (haversine(g[g.length - 1], b) > 1) g.push(b);
  else g[g.length - 1] = b;
  return measured(seg, g);
}

export function emptyDoc(): RouteDoc {
  return {
    v: 1,
    title: "",
    segments: [],
    landmarks: [],
    steps: [],
    arrival: { note: "" },
    walker: "neutral",
    createdAt: new Date().toISOString(),
  };
}

export function waypoints(segments: Segment[]): Waypoint[] {
  if (!segments.length) return [];
  return [segments[0].from, ...segments.map((s) => s.to)];
}

export function setMode(segments: Segment[], id: string, mode: Mode): Segment[] {
  return segments.map((s) => (s.id === id ? measured({ ...s, mode }, s.geometry) : s));
}

function moveEnd(seg: Segment, end: "from" | "to", w: Waypoint): Segment {
  const next = { ...seg, [end]: w };
  if (seg.drawn && seg.geometry.length >= 2) {
    const g = seg.geometry.slice();
    if (end === "from") g[0] = ll(w);
    else g[g.length - 1] = ll(w);
    return measured(next, g);
  }
  return straight(next);
}

export function moveWaypoint(segments: Segment[], index: number, p: LngLat): Segment[] {
  return segments.map((s, i) => {
    if (i === index - 1) return moveEnd(s, "to", { ...s.to, lng: p[0], lat: p[1] });
    if (i === index) return moveEnd(s, "from", { ...s.from, lng: p[0], lat: p[1] });
    return s;
  });
}

export function setWaypointLabel(segments: Segment[], index: number, label: string): Segment[] {
  return segments.map((s, i) => {
    if (i === index - 1) return { ...s, to: { ...s.to, label } };
    if (i === index) return { ...s, from: { ...s.from, label } };
    return s;
  });
}

export function nearestSegment(
  segments: Segment[],
  p: LngLat,
): { index: number; d: number; atM: number; pos: LngLat } | null {
  let best: { index: number; d: number; atM: number; pos: LngLat } | null = null;
  segments.forEach((s, index) => {
    if (s.geometry.length < 2) return;
    const cum = cumulative(s.geometry);
    const { d, atM } = nearestOnLine(p, s.geometry, cum);
    if (!best || d < best.d) best = { index, d, atM, pos: pointAt(s.geometry, cum, atM).pos };
  });
  return best;
}

function atOnLine(line: LngLat[], cum: number[], p: LngLat): number {
  return nearestOnLine(p, line, cum).atM;
}

export function splitSegment(
  segments: Segment[],
  index: number,
  p: LngLat,
  newMode: Mode = "matatu",
  newId = uid(),
): { segments: Segment[]; stopIndex: number } | null {
  const seg = segments[index];
  if (!seg || seg.geometry.length < 2) return null;
  const cum = cumulative(seg.geometry);
  const total = cum[cum.length - 1];
  const atM = atOnLine(seg.geometry, cum, p);
  if (atM < 5 || total - atM < 5) return null;
  const { pos, index: i } = pointAt(seg.geometry, cum, atM);
  const stop: Waypoint = { lng: pos[0], lat: pos[1], label: "" };
  const g1 = [...seg.geometry.slice(0, i + 1), pos];
  const g2 = [pos, ...seg.geometry.slice(i + 1)];
  const v1: LngLat[] = [];
  const v2: LngLat[] = [];
  for (const v of seg.vias) (atOnLine(seg.geometry, cum, v) < atM ? v1 : v2).push(v);
  const a = measured({ ...seg, to: stop, vias: v1 }, dedupe(g1));
  const b = measured({ ...seg, id: newId, mode: newMode, from: stop, vias: v2 }, dedupe(g2));
  const out = segments.slice();
  out.splice(index, 1, a, b);
  return { segments: out, stopIndex: index + 1 };
}

function dedupe(g: LngLat[]): LngLat[] {
  const out: LngLat[] = [];
  for (const c of g) {
    const last = out[out.length - 1];
    if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c);
  }
  if (out.length === 1) out.push(out[0]);
  return out;
}

export function mergeAtStop(segments: Segment[], stopIndex: number): Segment[] {
  if (stopIndex <= 0 || stopIndex >= segments.length) return segments;
  const a = segments[stopIndex - 1];
  const b = segments[stopIndex];
  const drawn = a.drawn && b.drawn;
  const merged: Segment = {
    ...a,
    to: b.to,
    vias: [...a.vias, ...b.vias],
    drawn,
  };
  const g = dedupe([...a.geometry, ...b.geometry.slice(1)]);
  const out = segments.slice();
  out.splice(stopIndex - 1, 2, measured(merged, g));
  return out;
}

export function addVia(segments: Segment[], id: string, p: LngLat): Segment[] {
  return segments.map((s) => {
    if (s.id !== id) return s;
    const line = s.geometry.length >= 2 ? s.geometry : legPoints(s);
    const cum = cumulative(line);
    const at = atOnLine(line, cum, p);
    const vias = s.vias.slice();
    let pos = vias.findIndex((v) => atOnLine(line, cum, v) > at);
    if (pos < 0) pos = vias.length;
    vias.splice(pos, 0, p);
    return { ...s, vias, drawn: false };
  });
}

export function moveVia(segments: Segment[], id: string, i: number, p: LngLat): Segment[] {
  return segments.map((s) => (s.id === id ? { ...s, vias: s.vias.map((v, j) => (j === i ? p : v)) } : s));
}

export function removeVia(segments: Segment[], id: string, i: number): Segment[] {
  return segments.map((s) => (s.id === id ? { ...s, vias: s.vias.filter((_, j) => j !== i) } : s));
}

export function setDrawn(segments: Segment[], id: string, line: LngLat[]): Segment[] {
  return segments.map((s) => {
    if (s.id !== id) return s;
    const g = dedupe([ll(s.from), ...line, ll(s.to)]);
    return measured({ ...s, drawn: true, vias: [] }, g);
  });
}

export function revertDrawn(segments: Segment[], id: string): Segment[] {
  return segments.map((s) => (s.id === id ? straight({ ...s, drawn: false }) : s));
}

export const STEP_MATCH_M = 50;

function matchEdits(old: Step[], fresh: Step[]): { steps: Step[]; unmatched: Step[] } {
  const steps = fresh.slice();
  const taken = new Set<number>();
  const unmatched: Step[] = [];
  const edits = old.filter((s) => s && s.edited).sort((a, b) => a.atM - b.atM);
  for (const e of edits) {
    let best = -1;
    let bestD = Infinity;
    steps.forEach((f, i) => {
      if (taken.has(i) || f.kind !== e.kind) return;
      if (e.landmarkId && f.landmarkId !== e.landmarkId) return;
      const single = e.kind === "start" || e.kind === "arrive";
      const d = f.id === e.id || single ? -1 : Math.abs(f.atM - e.atM);
      if (d <= STEP_MATCH_M && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    if (best < 0) {
      unmatched.push(e);
      continue;
    }
    taken.add(best);
    steps[best] = { ...steps[best], text: e.text, edited: true };
  }
  return { steps, unmatched };
}

export function mergeSteps(old: Step[], fresh: Step[]): Step[] {
  return matchEdits(old, fresh).steps;
}

export function storedSteps(old: Step[], fresh: Step[], display: Step[]): Step[] {
  const { unmatched } = matchEdits(old, fresh);
  return [...display, ...unmatched];
}

export function mergeLandmarks(old: Landmark[], fresh: Landmark[]): Landmark[] {
  const prev = new Map(old.filter((l) => l.source === "map").map((l) => [l.id, l]));
  const host = old.filter((l) => l.source === "host");
  const seen = new Set<string>();
  const map = fresh
    .filter((l) => l.source !== "host")
    .map((l) => {
      seen.add(l.id);
      const o = prev.get(l.id);
      return o ? { ...l, label: o.label, hidden: o.hidden } : l;
    });
  const keptHidden = old.filter((l) => l.source === "map" && l.hidden && !seen.has(l.id));
  return [...map, ...keptHidden, ...host];
}

export function defaultTitle(label?: string): string {
  const s = label?.trim();
  return s ? `${t.titlePrefix} ${s}` : t.titleFallback;
}

export function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function patchDocRoute(doc: RouteDoc, id: string, key: string, geometry: LngLat[]): RouteDoc {
  let changed = false;
  const segments = doc.segments.map((s) => {
    if (s.id !== id || s.drawn || segKey(s) !== key) return s;
    changed = true;
    return withRoute(s, geometry);
  });
  return changed ? { ...doc, segments } : doc;
}

export function nameWaypoint(doc: RouteDoc, lng: number, lat: number, label: string): RouteDoc {
  const wps = waypoints(doc.segments);
  const i = wps.findIndex((w) => w.lng === lng && w.lat === lat && !w.label?.trim());
  if (i < 0 || !label) return doc;
  const segments = setWaypointLabel(doc.segments, i, label);
  const last = wps.length - 1;
  const title = i === last && (!doc.title.trim() || doc.title === defaultTitle("")) ? defaultTitle(label) : doc.title;
  return { ...doc, segments, title };
}

const num = (n: unknown) => typeof n === "number" && Number.isFinite(n);
const str = (v: unknown) => typeof v === "string";
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function isPair(p: unknown): boolean {
  return Array.isArray(p) && p.length >= 2 && num(p[0]) && num(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
}

function isWaypoint(w: unknown): boolean {
  return isObj(w) && num(w.lng) && num(w.lat) && Math.abs(w.lng as number) <= 180 && Math.abs(w.lat as number) <= 90 && (w.label === undefined || str(w.label));
}

function isSegment(s: unknown): boolean {
  return (
    isObj(s) &&
    str(s.id) &&
    str(s.mode) &&
    Object.hasOwn(MODES, s.mode as string) &&
    isWaypoint(s.from) &&
    isWaypoint(s.to) &&
    Array.isArray(s.vias) &&
    s.vias.every(isPair) &&
    Array.isArray(s.geometry) &&
    s.geometry.every(isPair) &&
    typeof s.drawn === "boolean" &&
    num(s.distanceM) &&
    num(s.durationS)
  );
}

function isLandmark(l: unknown): boolean {
  return (
    isObj(l) &&
    str(l.id) &&
    num(l.lng) &&
    num(l.lat) &&
    str(l.label) &&
    str(l.kind) &&
    (l.source === "map" || l.source === "host") &&
    (l.note === undefined || str(l.note))
  );
}

function isStep(s: unknown): boolean {
  return isObj(s) && str(s.id) && str(s.kind) && str(s.text) && num(s.atM);
}

export function isRouteDoc(v: unknown): v is RouteDoc {
  if (!isObj(v) || v.v !== 1) return false;
  return (
    Array.isArray(v.segments) &&
    v.segments.length > 0 &&
    v.segments.every(isSegment) &&
    Array.isArray(v.landmarks) &&
    v.landmarks.every(isLandmark) &&
    Array.isArray(v.steps) &&
    v.steps.every(isStep) &&
    (v.title === undefined || str(v.title))
  );
}

export interface OptionLike {
  id: string;
  geometry: LngLat[];
  distanceM: number;
  durationS: number;
  labels: string[];
}

export function optionStats(
  seg: Segment,
  list: OptionLike[],
  selectedId: string | null,
): Record<string, { distanceM: number; durationS: number }> {
  const sel = list.find((o) => o.id === selectedId);
  const scale = sel && sel.durationS > 0 ? seg.durationS / sel.durationS : 0;
  const out: Record<string, { distanceM: number; durationS: number }> = {};
  for (const o of list) {
    const distanceM = withRoute(seg, o.geometry).distanceM;
    const durationS = o.id === selectedId ? seg.durationS : scale ? Math.round(o.durationS * scale) : estimateSeconds(seg.mode, distanceM);
    out[o.id] = { distanceM, durationS };
  }
  return out;
}
