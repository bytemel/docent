import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import { lineLength, simplify } from "./geo";
import { estimateSeconds, MODE_ORDER } from "./modes";
import { decodePolyline, encodePolyline } from "./polyline";
import type { Landmark, LandmarkKind, LngLat, Mode, RouteDoc, Segment, Step, StepKind, Walker } from "./types";

export const LIMITS = {
  encodedChars: 14000,
  jsonBytes: 400_000,
  title: 120,
  label: 80,
  note: 300,
  stepText: 200,
  id: 64,
  segments: 20,
  coords: 20000,
  landmarks: 60,
  steps: 200,
} as const;

const KINDS: LandmarkKind[] = ["fuel", "school", "worship", "hospital", "pharmacy", "bank", "bus", "shop", "food", "other", "host"];
const STEP_KINDS: StepKind[] = ["start", "turn", "mode", "landmark", "arrive"];
const WALKERS: Walker[] = ["neutral", "man", "woman"];

type WireSegment = [number, string, string, string, string, string, number, string];
type WireLandmark = [string, string, number, number, string, number];
type WireStep = [number, string, number, number, number, string];

interface Wire {
  v: 1;
  t: string;
  w: number;
  c: number;
  a: string;
  s: WireSegment[];
  l: WireLandmark[];
  lp: string;
  p: WireStep[];
}

function derivedStepId(kind: StepKind, atM: number): string {
  return `${kind}-${Math.round(atM / 10)}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeDoc(doc: RouteDoc): string {
  let encoded = encodeWire(doc);
  for (let tol = 2; encoded.length > LIMITS.encodedChars && tol <= 512; tol *= 2) {
    const t = tol;
    encoded = encodeWire({ ...doc, segments: doc.segments.map((s) => ({ ...s, geometry: simplify(s.geometry, t) })) });
  }
  return encoded;
}

function encodeWire(doc: RouteDoc): string {
  const landmarkIndex = new Map(doc.landmarks.map((l, i) => [l.id, i]));
  const created = Date.parse(doc.createdAt);
  const wire: Wire = {
    v: 1,
    t: doc.title,
    w: Math.max(0, WALKERS.indexOf(doc.walker)),
    c: Number.isFinite(created) ? Math.round(created / 1000) : 0,
    a: doc.arrival?.note ?? "",
    s: doc.segments.map((s) => [
      MODE_ORDER.indexOf(s.mode),
      encodePolyline(s.geometry),
      encodePolyline([
        [s.from.lng, s.from.lat],
        [s.to.lng, s.to.lat],
      ]),
      s.from.label ?? "",
      s.to.label ?? "",
      encodePolyline(s.vias),
      s.drawn ? 1 : 0,
      s.id,
    ]),
    l: doc.landmarks.map((l) => [
      l.id,
      l.label,
      Math.max(0, KINDS.indexOf(l.kind)),
      l.source === "host" ? 1 : 0,
      l.note ?? "",
      l.hidden ? 1 : 0,
    ]),
    lp: encodePolyline(doc.landmarks.map((l) => [l.lng, l.lat])),
    p: doc.steps.map((s) => [
      STEP_KINDS.indexOf(s.kind),
      s.text,
      Math.round(s.atM),
      s.landmarkId !== undefined ? (landmarkIndex.get(s.landmarkId) ?? -1) : -1,
      s.edited ? 1 : 0,
      s.id === derivedStepId(s.kind, Math.round(s.atM)) ? "" : s.id,
    ]),
  };
  return toBase64Url(deflateSync(strToU8(JSON.stringify(wire)), { level: 9 }));
}

export function shareUrl(doc: RouteDoc, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/r?d=${encodeDoc(doc)}`;
}

class Invalid extends Error {}

function fail(): never {
  throw new Invalid();
}

function clean(s: string, max: number, keepNewlines: boolean): string {
  let out = "";
  let count = 0;
  for (const ch of s) {
    if (count >= max) break;
    const c = ch.codePointAt(0) ?? 0;
    if (c === 10 && keepNewlines) out += ch;
    else if (c < 32 || c === 127) out += " ";
    else out += ch;
    count++;
  }
  return out;
}

function optStr(v: unknown, max: number, keepNewlines = false): string {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") fail();
  return clean(v, max, keepNewlines);
}

function optInt(v: unknown, min: number, max: number, def: number): number {
  if (v === undefined || v === null) return def;
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) fail();
  return v;
}

function optFlag(v: unknown): boolean {
  return optInt(v, 0, 1, 0) === 1;
}

function arr(v: unknown, max: number): unknown[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > max) fail();
  return v;
}

function validCoords(coords: LngLat[]): LngLat[] {
  for (const [lng, lat] of coords) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) fail();
  }
  return coords;
}

function uniqueId(raw: string, fallback: string, seen: Set<string>): string {
  let id = raw.trim() || fallback;
  if (seen.has(id)) {
    let n = 2;
    while (seen.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }
  seen.add(id);
  return id;
}

function fromWire(raw: unknown): RouteDoc {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail();
  const w = raw as Record<string, unknown>;
  if (w.v !== 1) fail();
  let budget: number = LIMITS.coords;
  const line = (v: unknown, min: number): LngLat[] => {
    const s = optStr(v, Infinity);
    const pts = decodePolyline(s, budget);
    if (!pts || pts.length < min) fail();
    budget -= pts.length;
    if (budget < 0) fail();
    return validCoords(pts);
  };

  const segIds = new Set<string>();
  const rawSegs = arr(w.s, LIMITS.segments);
  if (rawSegs.length === 0) fail();
  const segments: Segment[] = rawSegs.map((rs, i) => {
    if (!Array.isArray(rs)) fail();
    const mode: Mode | undefined = MODE_ORDER[optInt(rs[0], 0, MODE_ORDER.length - 1, -1)];
    if (!mode) fail();
    const geometry = line(rs[1], 2);
    const ends = rs[2] === undefined || rs[2] === "" ? [geometry[0], geometry[geometry.length - 1]] : line(rs[2], 2);
    if (ends.length !== 2) fail();
    const fromLabel = optStr(rs[3], LIMITS.label);
    const toLabel = optStr(rs[4], LIMITS.label);
    const vias = line(rs[5], 0);
    const distanceM = lineLength(geometry);
    return {
      id: uniqueId(optStr(rs[7], LIMITS.id), `s${i + 1}`, segIds),
      mode,
      from: { lng: ends[0][0], lat: ends[0][1], ...(fromLabel ? { label: fromLabel } : {}) },
      to: { lng: ends[1][0], lat: ends[1][1], ...(toLabel ? { label: toLabel } : {}) },
      vias,
      drawn: optFlag(rs[6]),
      geometry,
      distanceM,
      durationS: estimateSeconds(mode, distanceM),
    };
  });

  const rawLms = arr(w.l, LIMITS.landmarks);
  const lmPos = rawLms.length ? line(w.lp, rawLms.length) : [];
  if (lmPos.length !== rawLms.length) fail();
  const lmIds = new Set<string>();
  const landmarks: Landmark[] = rawLms.map((rl, i) => {
    if (!Array.isArray(rl)) fail();
    const note = optStr(rl[4], LIMITS.note, true);
    const lm: Landmark = {
      id: uniqueId(optStr(rl[0], LIMITS.id), `lm${i + 1}`, lmIds),
      lng: lmPos[i][0],
      lat: lmPos[i][1],
      label: optStr(rl[1], LIMITS.label),
      kind: KINDS[optInt(rl[2], 0, KINDS.length - 1, KINDS.indexOf("other"))],
      source: optFlag(rl[3]) ? "host" : "map",
    };
    if (note) lm.note = note;
    if (optFlag(rl[5])) lm.hidden = true;
    return lm;
  });

  const stepIds = new Set<string>();
  const steps: Step[] = arr(w.p, LIMITS.steps).map((rp) => {
    if (!Array.isArray(rp)) fail();
    const kind = STEP_KINDS[optInt(rp[0], 0, STEP_KINDS.length - 1, -1)];
    if (!kind) fail();
    const atM = optInt(rp[2], 0, 10_000_000, 0);
    const lmIndex = optInt(rp[3], -1, landmarks.length - 1, -1);
    const step: Step = {
      id: uniqueId(optStr(rp[5], LIMITS.id), derivedStepId(kind, atM), stepIds),
      kind,
      text: optStr(rp[1], LIMITS.stepText),
      atM,
    };
    if (lmIndex >= 0) step.landmarkId = landmarks[lmIndex].id;
    if (optFlag(rp[4])) step.edited = true;
    return step;
  });

  const created = optInt(w.c, 0, 4_102_444_800, 0);
  return {
    v: 1,
    title: optStr(w.t, LIMITS.title),
    segments,
    landmarks,
    steps,
    arrival: { note: optStr(w.a, LIMITS.note, true) },
    walker: WALKERS[optInt(w.w, 0, WALKERS.length - 1, 0)],
    createdAt: new Date(created * 1000).toISOString(),
  };
}

export function decodeDoc(encoded: string): RouteDoc | null {
  try {
    if (typeof encoded !== "string") return null;
    const s = encoded.trim();
    if (!s || s.length > LIMITS.encodedChars || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
    const out = inflateSync(fromBase64Url(s), { out: new Uint8Array(LIMITS.jsonBytes + 1) });
    if (out.length === 0 || out.length > LIMITS.jsonBytes) return null;
    return fromWire(JSON.parse(strFromU8(out)));
  } catch {
    return null;
  }
}
