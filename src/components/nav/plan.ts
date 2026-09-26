import { haversine, lineLength } from "@/lib/geo";
import { findLandmarks } from "@/lib/landmarks";
import { estimateSeconds } from "@/lib/modes";
import { ACTIVITIES, buildNavRoute, needsApproach, type Activity, type NavRoute, type RoutePart } from "@/lib/nav";
import { routeLeg } from "@/lib/routing";
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
  joinM: number | null;
}

interface PlanInput {
  here: LngLat;
  activity: Activity;
  dest: Dest | null;
  doc: RouteDoc | null;
  joined: boolean;
  baseM: number;
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
  const road = await routeLeg(info.profile, [input.here, [to.lng, to.lat]], input.signal);
  const seg = segment(id, info.mode, input.here, to, road.geometry);
  const landmarks = await withTimeout(findLandmarks([seg], { signal: input.signal, max: 10 }), LANDMARK_WAIT_MS, []);
  return { seg, landmarks };
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
    if (needsApproach(input.here, [start.lng, start.lat])) {
      approach = await leg(input, "approach", start);
      parts.push({ segments: [approach.seg], steps: buildSteps([approach.seg], approach.landmarks) });
    }
    parts.push({ segments: doc.segments, steps: doc.steps });
    const route = buildNavRoute(parts, { arrivalNote: doc.arrival.note, baseM: input.baseM });
    const join = route.maneuvers.find((m) => m.kind === "join");
    return {
      route,
      joinM: join ? join.atM : null,
      doc: approach ? { ...doc, segments: [approach.seg, ...doc.segments] } : doc,
    };
  }
  const target = dest ?? (doc ? docEnd(doc) : null);
  if (!target) throw new Error("No destination");
  const { seg, landmarks } = await leg(input, "go", target);
  const steps = buildSteps([seg], landmarks);
  const route = buildNavRoute([{ segments: [seg], steps }], { arrivalNote: doc?.arrival.note, baseM: input.baseM });
  return {
    route,
    joinM: null,
    doc: {
      v: 1,
      title: doc?.title || target.label || "",
      segments: [seg],
      landmarks,
      steps,
      arrival: { note: doc?.arrival.note ?? "" },
      walker: "neutral",
      createdAt: new Date().toISOString(),
    },
  };
}
