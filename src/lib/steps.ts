import { steps as S } from "@/strings/common";
import {
  bearing,
  cumulative,
  formatDistance,
  formatDuration,
  haversine,
  lineLength,
  nearestOnLine,
  pointAt,
  routeCoords,
  simplify,
  turnAngle,
} from "./geo";
import { MODES, estimateSeconds } from "./modes";
import type { Landmark, LandmarkKind, LngLat, Mode, Segment, Step, StepKind } from "./types";

export interface Turn {
  atM: number;
  angle: number;
  pos: [number, number];
  segmentIndex: number;
}

const TURN_MODES: readonly Mode[] = ["walk", "car", "bike"];
const SIMPLIFY_M = 8;
const PROBE_M = 25;
const MIN_TURN_DEG = 35;
const MIN_TURN_GAP_M = 30;
const TURN_LANDMARK_M = 50;
const LEAD_IN_M = 150;
const BIG_KINDS: readonly LandmarkKind[] = ["host", "fuel", "worship", "hospital", "school"];
const KIND_RANK: Record<StepKind, number> = { start: 0, mode: 1, turn: 2, landmark: 3, arrive: 4 };

export function hasTurns(mode: Mode): boolean {
  return TURN_MODES.includes(mode);
}

export function segmentOffsets(segments: Segment[]): number[] {
  const out: number[] = [];
  let acc = 0;
  let prevEnd: LngLat | null = null;
  for (const s of segments) {
    const g = s.geometry;
    if (prevEnd && g.length) acc += haversine(prevEnd, g[0]);
    out.push(acc);
    acc += lineLength(g);
    if (g.length) prevEnd = g[g.length - 1];
  }
  return out;
}

export function detectTurns(segments: Segment[]): Turn[] {
  const offsets = segmentOffsets(segments);
  const all: Turn[] = [];
  segments.forEach((seg, si) => {
    const g = seg.geometry;
    if (!hasTurns(seg.mode) || g.length < 3) return;
    const cum = cumulative(g);
    const index = new Map<LngLat, number>();
    g.forEach((c, i) => {
      if (!index.has(c)) index.set(c, i);
    });
    const simple = simplify(g, SIMPLIFY_M);
    const candidates: Turn[] = [];
    for (let k = 1; k < simple.length - 1; k++) {
      const i = index.get(simple[k]);
      if (i === undefined) continue;
      const at = cum[i];
      const v = g[i];
      const before = pointAt(g, cum, at - PROBE_M).pos;
      const after = pointAt(g, cum, at + PROBE_M).pos;
      if (haversine(before, v) < 8 || haversine(v, after) < 8) continue;
      const angle = turnAngle(bearing(before, v), bearing(v, after));
      if (Math.abs(angle) < MIN_TURN_DEG) continue;
      candidates.push({ atM: offsets[si] + at, angle, pos: [v[0], v[1]], segmentIndex: si });
    }
    const picked: Turn[] = [];
    for (const c of candidates.sort((a, b) => Math.abs(b.angle) - Math.abs(a.angle))) {
      if (picked.some((p) => Math.abs(p.atM - c.atM) < MIN_TURN_GAP_M)) continue;
      picked.push(c);
    }
    all.push(...picked);
  });
  return all.sort((a, b) => a.atM - b.atM);
}

export function turnWords(angle: number): string {
  const a = Math.abs(angle);
  const right = angle > 0;
  if (a > 150) return S.turn.uturn;
  if (a >= 60) return right ? S.turn.right : S.turn.left;
  return right ? S.turn.slightRight : S.turn.slightLeft;
}

export function compassWord(deg: number): string {
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return S.compass[i];
}

export function describeLandmark(lm: Pick<Landmark, "label" | "kind" | "source">): string {
  const label = lm.label.trim();
  if (lm.source !== "map") return label;
  if (lm.kind === "fuel" && !/petrol|fuel|station|energy|filling|garage/i.test(label)) return `${label} petrol station`;
  if (lm.kind === "bus" && !/stage|stop|station|terminus|terminal/i.test(label)) return `${label} stage`;
  return label;
}

function labelOf(label: string | undefined): string | null {
  const t = label?.trim();
  return t ? t : null;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

interface Placed {
  lm: Landmark;
  atM: number;
  d: number;
  side: "left" | "right" | null;
  seg: number;
}

interface Draft {
  kind: StepKind;
  atM: number;
  text: string;
  landmarkId?: string;
  leadIn?: boolean;
}

export function buildSteps(segments: Segment[], landmarks: Landmark[]): Step[] {
  const segs = segments.filter((s) => s.geometry.length > 0);
  if (!segs.length) return [];
  const coords = routeCoords(segs);
  const cum = cumulative(coords);
  const total = cum[cum.length - 1] ?? 0;
  const offsets = segmentOffsets(segs);
  const segEnd = (i: number) => (i + 1 < segs.length ? offsets[i + 1] : total);
  const segAt = (m: number) => {
    let i = 0;
    while (i + 1 < segs.length && offsets[i + 1] <= m) i++;
    return i;
  };

  const placed: Placed[] = [];
  for (const lm of landmarks) {
    if (lm.hidden || !Number.isFinite(lm.lng) || !Number.isFinite(lm.lat) || !lm.label.trim()) continue;
    const p: LngLat = [lm.lng, lm.lat];
    const { d, atM } = nearestOnLine(p, coords, cum);
    if (d > (lm.source === "host" ? 150 : 80)) continue;
    const at = pointAt(coords, cum, atM);
    const rel = turnAngle(at.bearing, bearing(at.pos, p));
    const side = d < 4 ? null : rel > 0 ? "right" : "left";
    placed.push({ lm, atM, d, side, seg: segAt(atM) });
  }
  placed.sort((a, b) => a.atM - b.atM);

  const used = new Set<string>();
  const drafts: Draft[] = [];
  const turns = detectTurns(segs);

  const heading = (si: number, fromM: number): string => {
    const verb = MODES[segs[si].mode].verb;
    const firstTurn = turns.find((t) => t.segmentIndex === si && t.atM > fromM);
    const limit = Math.min(segEnd(si), firstTurn ? firstTurn.atM : Infinity, fromM + 400);
    const target = placed.find((p) => p.seg === si && p.atM > fromM + 20 && p.atM < limit);
    if (target) return S.headToward(verb, describeLandmark(target.lm));
    const a = pointAt(coords, cum, fromM).pos;
    const b = pointAt(coords, cum, Math.min(segEnd(si), fromM + 40)).pos;
    return S.headCompass(verb, compassWord(bearing(a, b)));
  };

  const first = segs[0];
  const startLabel = labelOf(first.from.label);
  let startText = startLabel ? S.start(startLabel) : S.startHere;
  if (hasTurns(first.mode)) startText += ` ${heading(0, 0)}`;
  drafts.push({ kind: "start", atM: 0, text: startText });

  segs.forEach((seg, i) => {
    const prev = i > 0 ? segs[i - 1] : null;
    const start = offsets[i];
    const end = segEnd(i);
    if (!hasTurns(seg.mode)) {
      const len = lineLength(seg.geometry);
      const dur = seg.durationS > 0 ? seg.durationS : estimateSeconds(seg.mode, len);
      const text = S.ride(
        MODES[seg.mode].verb,
        labelOf(seg.from.label),
        formatDistance(len),
        formatDuration(dur),
        labelOf(seg.to.label),
      );
      drafts.push({ kind: "mode", atM: start, text });
      const big = placed.filter(
        (p) => p.seg === i && p.atM > start + 100 && p.atM < end - 100 && BIG_KINDS.includes(p.lm.kind),
      );
      const buckets = Math.max(1, Math.min(3, Math.floor(len / 800)));
      const chosen: Placed[] = [];
      for (let b = 0; b < buckets; b++) {
        const lo = start + (len * b) / buckets;
        const hi = start + (len * (b + 1)) / buckets;
        const best = big
          .filter((p) => p.atM >= lo && p.atM < hi)
          .sort((x, y) => BIG_KINDS.indexOf(x.lm.kind) - BIG_KINDS.indexOf(y.lm.kind) || x.d - y.d)[0];
        if (best) chosen.push(best);
      }
      for (const p of chosen) {
        used.add(p.lm.id);
        drafts.push({ kind: "landmark", atM: p.atM, text: S.willPass(describeLandmark(p.lm)), landmarkId: p.lm.id });
      }
      return;
    }
    if (prev && prev.mode !== seg.mode) {
      const dir = lowerFirst(heading(i, start).replace(/\.$/, ""));
      const text = hasTurns(prev.mode)
        ? S.switchTo(dir, labelOf(seg.from.label))
        : S.getOff(dir, labelOf(prev.to.label) ? null : labelOf(seg.from.label));
      drafts.push({ kind: "mode", atM: start, text });
    }
  });

  for (const t of turns) {
    const action = turnWords(t.angle);
    const dist = (p: Placed) => haversine([p.lm.lng, p.lm.lat], t.pos);
    const near = placed
      .filter((p) => !used.has(p.lm.id) && dist(p) <= TURN_LANDMARK_M)
      .sort((a, b) => dist(a) - dist(b))[0];
    if (near) used.add(near.lm.id);
    drafts.push({
      kind: "turn",
      atM: t.atM,
      text: near ? S.atLandmark(action, describeLandmark(near.lm)) : S.plain(action),
      landmarkId: near?.lm.id,
      leadIn: true,
    });
  }

  const last = segs[segs.length - 1];
  const endLabel = labelOf(last.to.label) ?? S.place.end;
  const atEnd = placed.find((p) => !used.has(p.lm.id) && total - p.atM < 30 && hasTurns(segs[p.seg].mode));
  if (atEnd) used.add(atEnd.lm.id);

  for (const p of placed) {
    if (used.has(p.lm.id) || !hasTurns(segs[p.seg].mode) || p.atM < 15) continue;
    used.add(p.lm.id);
    const text = S.pass(describeLandmark(p.lm), p.side);
    drafts.push({ kind: "landmark", atM: p.atM, text, landmarkId: p.lm.id, leadIn: true });
  }

  drafts.push({
    kind: "arrive",
    atM: total,
    text: atEnd ? S.arriveNear(endLabel, describeLandmark(atEnd.lm)) : S.arrive(endLabel),
    landmarkId: atEnd?.lm.id,
  });

  drafts.forEach((d) => (d.atM = Math.round(d.atM)));
  drafts.sort((a, b) => a.atM - b.atM || KIND_RANK[a.kind] - KIND_RANK[b.kind]);

  const seen = new Map<string, number>();
  return drafts.map((d, i) => {
    let text = d.text;
    if (d.leadIn && i > 0) {
      const gap = d.atM - drafts[i - 1].atM;
      if (gap > LEAD_IN_M) text = S.after(formatDistance(gap), lowerFirst(text));
    }
    const base = `${d.kind}-${Math.round(d.atM / 10)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const step: Step = { id: n === 1 ? base : `${base}-${n}`, kind: d.kind, text, atM: d.atM };
    if (d.landmarkId) step.landmarkId = d.landmarkId;
    return step;
  });
}
