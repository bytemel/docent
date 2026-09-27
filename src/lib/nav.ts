import { SAY } from "@/strings/nav";
import {
  cumulative,
  distanceToSegment,
  formatDistance,
  haversine,
  lineLength,
  nearestOnLine,
  pointAt,
  routeCoords,
} from "./geo";
import { MODES, type RoutingProfile } from "./modes";
import type { RouteOption } from "./routing";
import { detectTurns, hasTurns, segmentOffsets, turnWords } from "./steps";
import type { LngLat, Mode, Segment, Step } from "./types";

export type Activity = "walk" | "run" | "cycle" | "drive";

export interface ActivityInfo {
  profile: RoutingProfile;
  mode: Mode;
  speedKmh: number;
  pace: boolean;
  thresholds: [number, number];
  atTurnM: number;
  arriveM: number;
  offRouteM: number;
}

export const ACTIVITY_ORDER: Activity[] = ["walk", "run", "cycle", "drive"];

export const ACTIVITIES: Record<Activity, ActivityInfo> = {
  walk: { profile: "foot", mode: "walk", speedKmh: 4.8, pace: true, thresholds: [150, 30], atTurnM: 10, arriveM: 20, offRouteM: 40 },
  run: { profile: "foot", mode: "walk", speedKmh: 10, pace: true, thresholds: [150, 30], atTurnM: 12, arriveM: 20, offRouteM: 40 },
  cycle: { profile: "bike", mode: "bike", speedKmh: 15, pace: false, thresholds: [250, 50], atTurnM: 15, arriveM: 25, offRouteM: 45 },
  drive: { profile: "car", mode: "car", speedKmh: 28, pace: false, thresholds: [500, 100], atTurnM: 25, arriveM: 40, offRouteM: 60 },
};

export const REROUTE = { afterMs: 8000, everyMs: 20000 } as const;
const PASS_M = 5;
const LATE_NOW_M = 40;
const STEP_MATCH_M = 25;

export type Arrow =
  | "straight"
  | "slight-left"
  | "left"
  | "sharp-left"
  | "slight-right"
  | "right"
  | "sharp-right"
  | "u-turn"
  | "board"
  | "alight"
  | "arrive";

export type ManeuverKind = "depart" | "turn" | "board" | "alight" | "join" | "arrive";

export interface Maneuver {
  kind: ManeuverKind;
  atM: number;
  text: string;
  now: string;
  arrow: Arrow;
  pos: LngLat;
}

export interface NavLeg {
  mode: Mode;
  startM: number;
  endM: number;
}

export interface NavRoute {
  coords: LngLat[];
  cum: number[];
  totalM: number;
  maneuvers: Maneuver[];
  legs: NavLeg[];
  baseM: number;
}

export interface RoutePart {
  segments: Segment[];
  steps: Step[];
  rejoin?: boolean;
}

export interface NavState {
  index: number;
  current: Maneuver;
  next: Maneuver | null;
  toNextM: number;
  leftM: number;
  doneM: number;
  etaS: number;
  paceSPerKm: number | null;
  offRoute: boolean;
  arrived: boolean;
}

export interface Announcement {
  key: string;
  text: string;
  triggerM: number;
}

export function arrowFor(angle: number): Arrow {
  const a = Math.abs(angle);
  const side = angle > 0 ? "right" : "left";
  if (a < 20) return "straight";
  if (a < 50) return `slight-${side}`;
  if (a < 115) return side;
  if (a < 155) return `sharp-${side}`;
  return "u-turn";
}

export function cleanStep(text: string): string {
  let t = text.trim().replace(/^Start here\.\s*/, "");
  t = t.replace(/^After [^,]{1,24}, /, "");
  t = t.replace(/[.\s]+$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function firstSentence(text: string): string {
  return cleanStep(text.split(/\.\s/)[0]);
}

export function spokenDistance(m: number): string {
  const n = m < 100 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50;
  if (n < 1000) return SAY.metres(n);
  const km = (m / 1000).toFixed(1).replace(/\.0$/, "");
  return km === "1" ? SAY.oneKilometre : SAY.kilometres(km);
}

export function formatPace(sPerKm: number): string {
  const s = Math.max(0, Math.round(sPerKm));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function parseTo(raw: string | undefined | null): { lng: number; lat: number; label: string } | null {
  if (!raw) return null;
  const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,2}(?:\.\d+)?)\s*(?:,(.*))?$/.exec(raw);
  if (!m) return null;
  const lng = Number(m[1]);
  const lat = Number(m[2]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  const label = Array.from((m[3] ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim())
    .slice(0, 80)
    .join("");
  return { lng, lat, label };
}

export function needsApproach(here: LngLat, start: LngLat, activity: Activity = "walk"): boolean {
  return haversine(here, start) > ACTIVITIES[activity].offRouteM;
}

export function snapWindow(progressM: number, activity: Activity): { fromM: number; toM: number } {
  return { fromM: progressM - 30, toM: progressM + (activity === "drive" ? 600 : 250) };
}

export function rejoinAt(coords: LngLat[], cum: number[], fromM: number, here: LngLat): { atM: number; pos: LngLat; d: number } {
  let best = { atM: fromM, d: Infinity };
  for (let i = 1; i < coords.length; i++) {
    if (cum[i] < fromM) continue;
    const a = cum[i - 1] < fromM ? pointAt(coords, cum, fromM).pos : coords[i - 1];
    const start = Math.max(cum[i - 1], fromM);
    const { d, t } = distanceToSegment(here, a, coords[i]);
    if (d < best.d) best = { d, atM: start + t * (cum[i] - start) };
  }
  return { ...best, pos: pointAt(coords, cum, best.atM).pos };
}

export function trimPart(part: RoutePart, fromM: number): RoutePart {
  const offsets = segmentOffsets(part.segments);
  const segments: Segment[] = [];
  part.segments.forEach((seg, i) => {
    const len = lineLength(seg.geometry);
    const start = offsets[i];
    if (start + len <= fromM) return;
    if (start >= fromM) {
      segments.push(seg);
      return;
    }
    const cum = cumulative(seg.geometry);
    const cut = fromM - start;
    const cutAt = pointAt(seg.geometry, cum, cut).pos;
    const geometry: LngLat[] = [cutAt, ...seg.geometry.filter((_, k) => cum[k] > cut + 0.5)];
    const distanceM = lineLength(geometry);
    segments.push({
      ...seg,
      id: `${seg.id}-rest`,
      from: { lng: cutAt[0], lat: cutAt[1] },
      geometry: geometry.length >= 2 ? geometry : [cutAt, seg.geometry[seg.geometry.length - 1]],
      distanceM,
      durationS: Math.round((seg.durationS * distanceM) / Math.max(1, len)),
    });
  });
  const steps = part.steps
    .filter((st) => st.kind !== "start" && st.atM >= fromM + PASS_M)
    .map((st) => ({ ...st, atM: st.atM - fromM }));
  return { segments, steps, rejoin: true };
}

export function rerouteDue(offSince: number | null, lastAt: number, now: number): boolean {
  return offSince !== null && now - offSince >= REROUTE.afterMs && now - lastAt >= REROUTE.everyMs;
}

function partManeuvers(part: RoutePart, offset: number, all: Segment[], allOffsets: number[], first: number): Maneuver[] {
  const segs = part.segments;
  const out: Maneuver[] = [];
  const coords = routeCoords(segs);
  const cum = cumulative(coords);
  const total = cum[cum.length - 1] ?? 0;
  const at = (m: number) => pointAt(coords, cum, m).pos;
  const step = (kind: Step["kind"], m: number) =>
    part.steps.find((s) => s.kind === kind && Math.abs(s.atM - m) <= STEP_MATCH_M);
  const start = step("start", 0);
  out.push({
    kind: "depart",
    atM: offset,
    text: start ? cleanStep(start.text) : MODES[segs[0].mode].verb,
    now: start ? cleanStep(start.text) : MODES[segs[0].mode].verb,
    arrow: "straight",
    pos: at(0),
  });
  for (const t of detectTurns(segs)) {
    const s = step("turn", t.atM);
    const words = turnWords(t.angle);
    out.push({
      kind: "turn",
      atM: offset + t.atM,
      text: s ? cleanStep(s.text) : words,
      now: SAY.now(words),
      arrow: arrowFor(t.angle),
      pos: t.pos,
    });
  }
  segs.forEach((seg, i) => {
    if (hasTurns(seg.mode)) return;
    const from = allOffsets[first + i] - offset;
    const to = first + i + 1 < all.length ? allOffsets[first + i + 1] - offset : total;
    const s = step("mode", from);
    const verb = MODES[seg.mode].verb;
    out.push({
      kind: "board",
      atM: offset + from,
      text: s ? firstSentence(s.text) : verb,
      now: SAY.now(verb),
      arrow: "board",
      pos: at(from),
    });
    const stop = seg.to.label?.trim() || null;
    out.push({
      kind: "alight",
      atM: offset + Math.max(from, to - 1),
      text: SAY.getOff(stop),
      now: SAY.getOffNow,
      arrow: "alight",
      pos: at(to),
    });
  });
  const arrive = step("arrive", total);
  const label = segs[segs.length - 1].to.label?.trim();
  out.push({
    kind: "arrive",
    atM: offset + total,
    text: arrive ? cleanStep(arrive.text) : SAY.arriveAt(label || SAY.destination),
    now: SAY.arrived(""),
    arrow: "arrive",
    pos: at(total),
  });
  return out;
}

export function buildNavRoute(parts: RoutePart[], opts: { arrivalNote?: string; baseM?: number } = {}): NavRoute {
  const live = parts.filter((p) => p.segments.some((s) => s.geometry.length >= 2));
  const all = live.flatMap((p) => p.segments.filter((s) => s.geometry.length >= 2));
  const coords = routeCoords(all);
  const cum = cumulative(coords);
  const totalM = cum[cum.length - 1] ?? 0;
  const offsets = segmentOffsets(all);
  const legs = all.map((s, i) => ({ mode: s.mode, startM: offsets[i], endM: offsets[i] + lineLength(s.geometry) }));
  const maneuvers: Maneuver[] = [];
  let first = 0;
  live.forEach((part, k) => {
    const segs = part.segments.filter((s) => s.geometry.length >= 2);
    const list = partManeuvers({ ...part, segments: segs }, offsets[first], all, offsets, first);
    first += segs.length;
    if (k > 0) {
      const prevArrive = maneuvers.pop();
      const dep = list.shift()!;
      const where = segs[0].from.label?.trim();
      maneuvers.push({
        kind: "join",
        atM: dep.atM,
        text: part.rejoin ? SAY.rejoin : where ? SAY.joinAt(where) : SAY.join,
        now: part.rejoin ? SAY.backOnRoute : `${SAY.atStart} ${dep.text}.`,
        arrow: "straight",
        pos: prevArrive?.pos ?? dep.pos,
      });
    }
    maneuvers.push(...list);
  });
  const last = maneuvers[maneuvers.length - 1];
  if (last?.kind === "arrive") last.now = SAY.arrived(opts.arrivalNote?.trim() ?? "");
  maneuvers.sort((a, b) => a.atM - b.atM || (a.kind === "depart" ? -1 : b.kind === "depart" ? 1 : 0));
  return { coords, cum, totalM, maneuvers, legs, baseM: opts.baseM ?? 0 };
}

function upcoming(route: NavRoute, atM: number): number {
  const i = route.maneuvers.findIndex((m) => m.kind !== "depart" && m.atM > atM + PASS_M);
  return i < 0 ? route.maneuvers.length - 1 : i;
}

export function navProgress(
  route: NavRoute,
  snapped: { atM: number; offRouteM: number; acc?: number },
  activity: Activity,
  elapsedS: number,
): NavState {
  const info = ACTIVITIES[activity];
  const atM = Math.max(0, Math.min(route.totalM, snapped.atM));
  const index = upcoming(route, atM);
  const current = route.maneuvers[index];
  const next = route.maneuvers.slice(index + 1).find((m) => m.kind !== "depart") ?? null;
  const leftM = Math.max(0, route.totalM - atM);
  const doneM = route.baseM + atM;
  const offRoute = snapped.offRouteM > Math.max(info.offRouteM, snapped.acc ?? 0);
  let own = info.speedKmh / 3.6;
  if (elapsedS >= 60 && doneM >= 150) own = Math.min(own * 2, Math.max(own / 2, doneM / elapsedS));
  let etaS = 0;
  for (const leg of route.legs) {
    const from = Math.max(atM, leg.startM);
    if (leg.endM <= from) continue;
    etaS += (leg.endM - from) / (hasTurns(leg.mode) ? own : MODES[leg.mode].speedKmh / 3.6);
  }
  return {
    index,
    current,
    next,
    toNextM: Math.max(0, current.atM - atM),
    leftM,
    doneM,
    etaS: Math.round(etaS),
    paceSPerKm: doneM >= 50 && elapsedS > 0 ? elapsedS / (doneM / 1000) : null,
    offRoute,
    arrived: !offRoute && leftM <= info.arriveM && atM >= route.totalM / 2,
  };
}

export function dueAnnouncements(route: NavRoute, prevAtM: number, atM: number, activity: Activity): Announcement[] {
  const info = ACTIVITIES[activity];
  const out: Announcement[] = [];
  const crossed = (trigger: number) => prevAtM < trigger && atM >= trigger;
  const list = route.maneuvers;
  list.forEach((m, i) => {
    if (m.kind === "depart") return;
    const prevAt = i > 0 ? list[i - 1].atM : 0;
    if (m.atM > atM + PASS_M || m.kind === "arrive") {
      for (const th of info.thresholds) {
        const trigger = m.atM - th;
        if (trigger <= prevAt + PASS_M || m.atM - atM <= info.atTurnM) continue;
        if (crossed(trigger)) out.push({ key: `${i}:${th}`, text: SAY.inDistance(spokenDistance(th), m.text), triggerM: trigger });
      }
    }
    const nowAt = m.atM - info.atTurnM;
    if (crossed(nowAt) && atM - m.atM <= LATE_NOW_M) out.push({ key: `${i}:now`, text: m.now, triggerM: nowAt });
    const nxt = list.slice(i + 1).find((n) => n.kind !== "depart");
    if (!nxt || m.kind === "arrive") return;
    const gap = nxt.atM - m.atM;
    const trigger = m.atM + 20;
    if (gap > info.thresholds[0] * 2 + 100 && crossed(trigger) && nxt.atM > atM + info.thresholds[0]) {
      out.push({ key: `${i}:go`, text: SAY.continueFor(spokenDistance(gap - 20)), triggerM: trigger });
    }
  });
  return out.sort((a, b) => a.triggerM - b.triggerM);
}

export function startAnnouncement(route: NavRoute, activity: Activity, atM = 0): string {
  const info = ACTIVITIES[activity];
  const dep = route.maneuvers.find((m) => m.kind === "depart");
  const first = route.maneuvers[upcoming(route, atM)];
  const lead = dep && dep.text ? `${dep.text}. ` : "";
  if (!first) return lead.trim();
  const dist = first.atM - atM;
  if (first.kind === "arrive" && dist <= info.arriveM) return first.now;
  if (dist <= info.atTurnM * 2) return `${lead}${first.text}.`;
  if (dist > info.thresholds[0]) return `${lead}${SAY.continueFor(spokenDistance(dist))}, ${SAY.thenTurn(first.text)}.`;
  return `${lead}${SAY.inDistance(spokenDistance(dist), first.text)}.`;
}

export interface Announcer {
  update(atM: number): string | null;
  current(atM: number): string;
}

export function createAnnouncer(route: NavRoute, activity: Activity, startAtM = 0): Announcer {
  const fired = new Set<string>();
  let prev = startAtM;
  return {
    update(atM) {
      const due = dueAnnouncements(route, prev, atM, activity).filter((a) => !fired.has(a.key));
      prev = atM;
      due.forEach((a) => fired.add(a.key));
      const byManeuver = new Map<string, string>();
      for (const a of due) byManeuver.set(a.key.split(":")[0], a.text);
      const [first, second] = [...byManeuver.values()];
      if (!first) return null;
      return second ? `${first}. ${SAY.then(second)}` : first;
    },
    current(atM) {
      const m = route.maneuvers[upcoming(route, atM)];
      if (!m) return "";
      const dist = m.atM - atM;
      if (dist <= ACTIVITIES[activity].atTurnM) return m.now;
      return SAY.inDistance(spokenDistance(dist), m.text);
    },
  };
}

export interface OptionView {
  id: string;
  distanceM: number;
  timeS: number;
  deltaM: number;
  shortest: boolean;
  fastest: boolean;
}

export function optionSeconds(opt: Pick<RouteOption, "distanceM" | "durationS">, activity: Activity): number {
  if (activity === "drive" && opt.durationS > 0) return Math.round(opt.durationS);
  return Math.round(opt.distanceM / (ACTIVITIES[activity].speedKmh / 3.6));
}

export function describeOptions(options: RouteOption[], activity: Activity): OptionView[] {
  if (!options.length) return [];
  const minD = Math.min(...options.map((o) => o.distanceM));
  const times = options.map((o) => optionSeconds(o, activity));
  const minT = Math.min(...times);
  return options
    .map((o, i) => ({
      id: o.id,
      distanceM: o.distanceM,
      timeS: times[i],
      deltaM: o.distanceM - minD,
      shortest: o.distanceM === minD,
      fastest: activity === "drive" ? times[i] === minT : o.distanceM === minD,
    }))
    .sort((a, b) => a.distanceM - b.distanceM);
}

export function defaultOption(options: RouteOption[], activity: Activity): RouteOption | null {
  if (!options.length) return null;
  const views = describeOptions(options, activity);
  const pick =
    activity === "drive"
      ? [...views].sort((a, b) => a.timeS - b.timeS || a.distanceM - b.distanceM)[0]
      : views[0];
  return options.find((o) => o.id === pick.id) ?? options[0];
}

export function optionTag(view: OptionView): string {
  return view.shortest ? SAY.shortest : `+${formatDistance(view.deltaM)}`;
}

export function tagPoint(option: RouteOption, others: RouteOption[]): LngLat {
  const g = option.geometry;
  const cum = cumulative(g);
  const mid = pointAt(g, cum, (cum[cum.length - 1] ?? 0) / 2).pos;
  if (!others.length || g.length < 3) return mid;
  let best = mid;
  let bestD = -1;
  const step = Math.max(1, Math.floor(g.length / 60));
  for (let i = step; i < g.length - step; i += step) {
    const d = Math.min(...others.map((o) => nearestOnLine(g[i], o.geometry).d));
    if (d > bestD + 1) {
      bestD = d;
      best = g[i];
    }
  }
  return bestD > 15 ? best : mid;
}
