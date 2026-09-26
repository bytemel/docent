import { fail, fetchJson, limited, ok } from "@/lib/server/http";
import { parseLatLng } from "@/lib/server/parse";
import { parsePhotonReverse } from "@/lib/server/providers";

export async function GET(req: Request) {
  const blocked = limited(req, "reverse", 60);
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const at = parseLatLng(params.get("lat"), params.get("lng"));
  if (!at) return fail(400, "Send a valid lat and lng.");
  const url = `https://photon.komoot.io/reverse?lat=${at.lat.toFixed(5)}&lon=${at.lng.toFixed(5)}&lang=en`;
  try {
    return ok(parsePhotonReverse(await fetchJson(url)));
  } catch {
    return fail(502, "Could not name this place right now.");
  }
}
