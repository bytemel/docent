import { fail, fetchJson, limited, ok } from "@/lib/server/http";
import { parseLatLng, parseQuery } from "@/lib/server/parse";
import { parsePhotonSearch } from "@/lib/server/providers";
import { NAIROBI } from "@/lib/map";

export async function GET(req: Request) {
  const blocked = limited(req, "search", 60);
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const q = parseQuery(params.get("q"));
  if (!q) return fail(400, "Type at least 2 letters to search.");
  const hasBias = params.has("lat") || params.has("lng");
  const bias = hasBias ? parseLatLng(params.get("lat"), params.get("lng")) : { lat: NAIROBI[1], lng: NAIROBI[0] };
  if (!bias) return fail(400, "The map position is not valid.");
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en` +
    `&lat=${bias.lat.toFixed(4)}&lon=${bias.lng.toFixed(4)}`;
  try {
    return ok({ results: parsePhotonSearch(await fetchJson(url)) });
  } catch {
    return fail(502, "Search is not working right now. Please try again.");
  }
}
