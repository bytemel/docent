import { fail, fetchJson, limited, ok } from "@/lib/server/http";
import { parseLatLng, parseQuery } from "@/lib/server/parse";
import {
  mergeResults,
  nominatimUrl,
  orsGeocodeUrl,
  parseNominatim,
  parseOrsGeocode,
  photonRanked,
  type RankedResult,
} from "@/lib/server/providers";
import { NAIROBI } from "@/lib/map";

let nextNominatim = 0;

async function nominatim(q: string): Promise<RankedResult[]> {
  const now = Date.now();
  const wait = Math.max(0, nextNominatim - now);
  if (wait > 1000) return [];
  nextNominatim = now + wait + 1000;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  return parseNominatim(await fetchJson(nominatimUrl(q)));
}

async function ors(q: string, bias: { lat: number; lng: number }, key: string): Promise<RankedResult[]> {
  const ke = parseOrsGeocode(await fetchJson(orsGeocodeUrl(q, bias, key, true)));
  if (ke.length >= 3) return ke;
  const all = parseOrsGeocode(await fetchJson(orsGeocodeUrl(q, bias, key, false)));
  return [...ke, ...all];
}

export async function GET(req: Request) {
  const blocked = limited(req, "search", 60);
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const q = parseQuery(params.get("q"));
  if (!q) return fail(400, "Type at least 2 letters to search.");
  const hasBias = params.has("lat") || params.has("lng");
  const bias = hasBias ? parseLatLng(params.get("lat"), params.get("lng")) : { lat: NAIROBI[1], lng: NAIROBI[0] };
  if (!bias) return fail(400, "The map position is not valid.");
  const deep = params.get("deep") === "1";
  const photonUrl =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en` +
    `&lat=${bias.lat.toFixed(4)}&lon=${bias.lng.toFixed(4)}`;
  const key = process.env.ORS_API_KEY;
  const jobs: Promise<RankedResult[]>[] = [fetchJson(photonUrl).then(photonRanked)];
  if (key) jobs.push(ors(q, bias, key));
  if (deep) jobs.push(nominatim(q));
  const settled = await Promise.allSettled(jobs);
  const lists = settled.map((s) => (s.status === "fulfilled" ? s.value : []));
  if (settled.every((s) => s.status === "rejected")) {
    return fail(502, "Search is not working right now. Please try again.");
  }
  return ok({ results: mergeResults(lists) });
}
