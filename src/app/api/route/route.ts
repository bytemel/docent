import { busy, fail, fetchJson, limited, ok } from "@/lib/server/http";
import { spendBudget } from "@/lib/server/rateLimit";
import { parsePoints, parseProfile, type Profile } from "@/lib/server/parse";
import {
  orsRequest,
  osrmUrl,
  parseOrs,
  parseOrsAll,
  parseOsrm,
  parseOsrmAll,
  type RouteCandidate,
  type RouteResult,
} from "@/lib/server/providers";
import { findAlternatives } from "@/lib/server/alternatives";
import type { LngLat } from "@/lib/types";

const DAILY = 1800;

async function viaOrs(profile: Profile, points: LngLat[], key: string): Promise<RouteResult | null> {
  try {
    const { url, init } = orsRequest(profile, points, key);
    return parseOrs(await fetchJson(url, init));
  } catch {
    return null;
  }
}

async function orsCandidates(profile: Profile, points: LngLat[], key: string, alternatives: boolean) {
  try {
    const { url, init } = orsRequest(profile, points, key, alternatives);
    return parseOrsAll(await fetchJson(url, init));
  } catch {
    return [];
  }
}

async function candidates(profile: Profile, points: LngLat[], alternatives: boolean): Promise<RouteCandidate[]> {
  const key = process.env.ORS_API_KEY;
  const fromOrs = key ? await orsCandidates(profile, points, key, alternatives) : [];
  if (fromOrs.length) return fromOrs;
  return parseOsrmAll(await fetchJson(osrmUrl(profile, points, alternatives)));
}

async function options(profile: Profile, points: LngLat[]): Promise<Response> {
  let base: RouteCandidate[];
  try {
    base = await candidates(profile, points, true);
  } catch {
    return fail(502, "The route service did not answer. Please try again.");
  }
  if (!base.length) return fail(404, "Could not find a road route between these points.");
  const { routes } = await findAlternatives(profile, points, base, async (pts) => {
    if (!spendBudget("route", DAILY)) return null;
    const got = await candidates(profile, pts, false);
    return got[0] ?? null;
  });
  return ok({ routes });
}

export async function GET(req: Request) {
  const blocked = limited(req, "route", 20);
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const profile = parseProfile(params.get("profile"));
  const points = parsePoints(params.get("points") ?? "");
  if (!profile || !points) return fail(400, "Send a travel profile and 2 to 25 points.");
  if (!spendBudget("route", DAILY)) return busy();
  if (params.get("alt") === "1") return options(profile, points);
  const key = process.env.ORS_API_KEY;
  const fromOrs = key ? await viaOrs(profile, points, key) : null;
  if (fromOrs) return ok(fromOrs);
  try {
    const result = parseOsrm(await fetchJson(osrmUrl(profile, points)));
    if (!result) return fail(404, "Could not find a road route between these points.");
    return ok(result);
  } catch {
    return fail(502, "The route service did not answer. Please try again.");
  }
}
