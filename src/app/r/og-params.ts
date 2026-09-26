import { lineLength, routeCoords, simplify, thin } from "@/lib/geo";
import { MODES } from "@/lib/modes";
import { decodePolyline, encodePolyline } from "@/lib/polyline";
import type { LngLat, Mode, RouteDoc } from "@/lib/types";

export const OG_MAX_POINTS = 60;
export const OG_MAX_TITLE = 120;
const OG_PRETHIN_POINTS = 400;

const MODE_LETTER: Record<Mode, string> = { walk: "w", boda: "b", matatu: "m", car: "c", bike: "k" };
const LETTER_MODE = new Map<string, Mode>(Object.entries(MODE_LETTER).map(([mode, l]) => [l, mode as Mode]));

export function totalMeters(doc: RouteDoc): number {
  return lineLength(routeCoords(doc.segments));
}

export function modeList(doc: RouteDoc): string {
  const out: string[] = [];
  for (const s of doc.segments) {
    const label = MODES[s.mode].label.toLowerCase();
    if (out[out.length - 1] !== label) out.push(label);
  }
  return out.join(", ");
}

export function ogQuery(doc: RouteDoc): string {
  const legs = doc.segments.filter((s) => s.geometry.length >= 2);
  const perLeg = Math.max(2, Math.floor(OG_PRETHIN_POINTS / Math.max(1, legs.length)));
  const coarse = legs.map((s) => thin(s.geometry, perLeg));
  let tol = 5;
  let parts: LngLat[][] = coarse;
  for (let i = 0; i < 24; i++) {
    parts = coarse.map((g) => simplify(g, tol));
    if (parts.reduce((n, p) => n + p.length, 0) <= OG_MAX_POINTS) break;
    tol *= 1.6;
  }
  const points: LngLat[] = [];
  let m = "";
  parts.forEach((p, i) => {
    points.push(...p);
    m += `${MODE_LETTER[legs[i].mode]}${p.length}`;
  });
  const q = new URLSearchParams({
    t: doc.title.slice(0, OG_MAX_TITLE),
    g: points.length <= OG_MAX_POINTS * 2 ? encodePolyline(points) : "",
    m: points.length <= OG_MAX_POINTS * 2 ? m : "",
    l: String(Math.round(totalMeters(doc))),
  });
  return q.toString();
}

export interface OgRun {
  mode: Mode;
  points: LngLat[];
}

export interface OgData {
  title: string;
  meters: number | null;
  runs: OgRun[];
}

function cleanTitle(v: string | null): string {
  if (!v) return "";
  let out = "";
  for (const ch of v) {
    const c = ch.codePointAt(0) ?? 0;
    out += c < 32 || c === 127 ? " " : ch;
  }
  return Array.from(out.trim()).slice(0, OG_MAX_TITLE).join("");
}

export function parseOg(params: URLSearchParams): OgData {
  const title = cleanTitle(params.get("t"));
  const l = Number(params.get("l"));
  const meters = Number.isInteger(l) && l > 0 && l < 5_000_000 ? l : null;
  const g = params.get("g") ?? "";
  const m = params.get("m") ?? "";
  const runs: OgRun[] = [];
  if (g.length > 0 && g.length <= 1200 && /^([wbmck]\d{1,3})+$/.test(m) && m.length <= 200) {
    const pts = decodePolyline(g, OG_MAX_POINTS * 2);
    const ok = pts?.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 180 && Math.abs(y) <= 90);
    if (pts && ok) {
      let i = 0;
      for (const [, letter, count] of m.matchAll(/([wbmck])(\d{1,3})/g)) {
        const n = Number(count);
        const mode = LETTER_MODE.get(letter);
        if (!mode || n < 1) break;
        const slice = pts.slice(Math.max(0, i - 1), i + n);
        i += n;
        if (slice.length >= 2) runs.push({ mode, points: slice });
      }
      if (i !== pts.length) runs.length = 0;
    }
  }
  return { title, meters, runs };
}
