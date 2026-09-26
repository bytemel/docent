import { cumulative, haversine, lineLength, routeCoords } from "@/lib/geo";
import { findLandmarks } from "@/lib/landmarks";
import { estimateSeconds, type RoutingProfile } from "@/lib/modes";
import {
  ACTIVITIES,
  buildNavRoute,
  needsApproach,
  rejoinAt,
  trimPart,
  type Activity,
  type NavRoute,
  type RoutePart,
} from "@/lib/nav";
import { routeLeg, routeOptions, type RouteOption } from "@/lib/routing";
import { buildSteps } from "@/lib/steps";
import type { Landmark, LngLat, Mode, RouteDoc, Segment } from "@/lib/types";

export interface Dest {
  lng: number;
  lat: number;
  label: string;
}

export interface Trip {
  route: NavRoute;
  doc: RouteDoc;
  docStartM: number | null;
  docOffsetM: number;
}

interface PlanInput {
  here: LngLat;
  activity: Activity;
  dest: Dest | null;
  doc: RouteDoc | null;
  joined: boolean;
  baseM: number;
  geometry?: LngLat[] | null;
  docFromM?: number;
  signal?: AbortSignal;
}

const LANDMARK_WAIT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

function segment(id: string, mode: Mode, here: LngLat, to: Dest, road: LngLat[]): Segment {
  const geometry = road.slice();
  if (haversine(here, geometry[0]) > 5) geometry.unshift(here);
  const end: LngLat = [to.lng, to.lat];
  if (haversine(end, geometry[geometry.length - 1]) > 5) geometry.push(end);
  const distanceM = lineLength(geometry);
  return {
    id,
    mode,
    from: { lng: here[0], lat: here[1] },
    to: { lng: to.lng, lat: to.lat, ...(to.label ? { label: to.label } : {}) },
    vias: [],
    drawn: false,
    geometry,
    distanceM,
    durationS: estimateSeconds(mode, distanceM),
  };
}

async function leg(input: PlanInput, id: string, to: Dest): Promise<{ seg: Segment; landmarks: Landmark[] }> {
  const info = ACTIVITIES[input.activity];
  const road =
    input.geometry && input.geometry.length >= 2
      ? input.geometry
      : (await routeLeg(info.profile, [input.here, [to.lng, to.lat]], input.signal)).geometry;
  const seg = segment(id, info.mode, input.here, to, road);
  const landmarks = await withTimeout(findLandmarks([seg], { signal: input.signal, max: 10 }), LANDMARK_WAIT_MS, []);
  return { seg, landmarks };
}

export function optionsTarget(dest: Dest | null, doc: RouteDoc | null, here: LngLat, activity: Activity): Dest | null {
  if (!doc) return dest;
  const first = doc.segments[0].from;
  return needsApproach(here, [first.lng, first.lat], activity) ? { lng: first.lng, lat: first.lat, label: first.label ?? "" } : null;
}

export function fetchOptions(here: LngLat, to: Dest, profile: RoutingProfile, signal?: AbortSignal): Promise<RouteOption[]> {
  return routeOptions(profile, [here, [to.lng, to.lat]], signal);
}

async function rejoin(input: PlanInput, doc: RouteDoc): Promise<Trip> {
  const coords = routeCoords(doc.segments);
  const cum = cumulative(coords);
  const at = rejoinAt(coords, cum, Math.max(0, input.docFromM ?? 0), input.here);
  const rest = trimPart({ segments: doc.segments, steps: doc.steps }, at.atM);
  const parts: RoutePart[] = [];
  let approach: { seg: Segment; landmarks: Landmark[] } | null = null;
  if (needsApproach(input.here, at.pos, input.activity)) {
    approach = await leg(input, "rejoin", { lng: at.pos[0], lat: at.pos[1], label: "" });
    parts.push({ segments: [approach.seg], steps: buildSteps([approach.seg], approach.landmarks) });
  }
  parts.push(rest);
  const route = buildNavRoute(parts, { arrivalNote: doc.arrival.note, baseM: input.baseM });
  const join = route.maneuvers.find((m) => m.kind === "join");
  return {
    route,
    docStartM: join ? join.atM : 0,
    docOffsetM: at.atM,
    doc: { ...doc, segments: approach ? [approach.seg, ...rest.segments] : rest.segments },
  };
}

export function docEnd(doc: RouteDoc): Dest {
  const last = doc.segments[doc.segments.length - 1].to;
  return { lng: last.lng, lat: last.lat, label: last.label ?? "" };
}

function forActivity(trip: Trip, activity: Activity): Trip {
  if (activity !== "run") return trip;
  for (const m of trip.route.maneuvers) {
    m.text = m.text.replace(/^Walk\b/, "Run");
    m.now = m.now.replace(/^Walk\b/, "Run");
  }
  return trip;
}

export async function planTrip(input: PlanInput): Promise<Trip> {
  return forActivity(await plan(input), input.activity);
}

async function plan(input: PlanInput): Promise<Trip> {
  const { doc, dest } = input;
  if (doc && !input.joined) {
    const first = doc.segments[0].from;
    const start: Dest = { lng: first.lng, lat: first.lat, label: first.label ?? "" };
    const parts: RoutePart[] = [];
    let approach: { seg: Segment; landmarks: Landmark[] } | null = null;
    if (needsApproach(input.here, [start.lng, start.lat], input.activity)) {
      approach = await leg(input, "approach", start);
      parts.push({ segments: [approach.seg], steps: buildSteps([approach.seg], approach.landmarks) });
    }
    parts.push({ segments: doc.segments, steps: doc.steps });
    const route = buildNavRoute(parts, { arrivalNote: doc.arrival.note, baseM: input.baseM });
    const join = route.maneuvers.find((m) => m.kind === "join");
    return {
      route,
      docStartM: join ? join.atM : 0,
      docOffsetM: 0,
      doc: approach ? { ...doc, segments: [approach.seg, ...doc.segments] } : doc,
    };
  }
  if (doc) return rejoin(input, doc);
  const target = dest;
  if (!target) throw new Error("No destination");
  const { seg, landmarks } = await leg(input, "go", target);
  const steps = buildSteps([seg], landmarks);
  const route = buildNavRoute([{ segments: [seg], steps }], { baseM: input.baseM });
  return {
    route,
    docStartM: null,
    docOffsetM: 0,
    doc: {
      v: 1,
      title: target.label,
      segments: [seg],
      landmarks,
      steps,
      arrival: { note: "" },
      walker: "neutral",
      createdAt: new Date().toISOString(),
    },
  };
}
