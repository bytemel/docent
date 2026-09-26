import { fail, fetchJson, limited, ok } from "@/lib/server/http";
import { parsePoints, parseProfile, type Profile } from "@/lib/server/parse";
import { orsRequest, osrmUrl, parseOrs, parseOsrm, type RouteResult } from "@/lib/server/providers";
import type { LngLat } from "@/lib/types";

async function viaOrs(profile: Profile, points: LngLat[], key: string): Promise<RouteResult | null> {
  try {
    const { url, init } = orsRequest(profile, points, key);
    return parseOrs(await fetchJson(url, init));
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const blocked = limited(req, "route", 30);
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const profile = parseProfile(params.get("profile"));
  const points = parsePoints(params.get("points") ?? "");
  if (!profile || !points) return fail(400, "Send a travel profile and 2 to 25 points.");
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
