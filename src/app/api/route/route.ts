import { fail, fetchJson, limited, ok } from "@/lib/server/http";
import { parsePoints, parseProfile } from "@/lib/server/parse";
import { orsRequest, osrmUrl, parseOrs, parseOsrm } from "@/lib/server/providers";

export async function GET(req: Request) {
  const blocked = limited(req, "route", 30);
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const profile = parseProfile(params.get("profile"));
  const points = parsePoints(params.get("points") ?? "");
  if (!profile || !points) return fail(400, "Send a travel profile and 2 to 25 points.");
  try {
    const key = process.env.ORS_API_KEY;
    let result;
    if (key) {
      const { url, init } = orsRequest(profile, points, key);
      result = parseOrs(await fetchJson(url, init));
    } else {
      result = parseOsrm(await fetchJson(osrmUrl(profile, points)));
    }
    if (!result) return fail(404, "Could not find a road route between these points.");
    return ok(result);
  } catch {
    return fail(502, "The route service did not answer. Please try again.");
  }
}
