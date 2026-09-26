export interface Place {
  label: string;
  sub: string;
  lng: number;
  lat: number;
}

export async function searchPlaces(
  q: string,
  center: [number, number],
  signal?: AbortSignal,
  deep = false,
): Promise<Place[]> {
  const url =
    `/api/search?q=${encodeURIComponent(q)}&lat=${center[1].toFixed(4)}&lng=${center[0].toFixed(4)}` +
    (deep ? "&deep=1" : "");
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const body = (await res.json()) as { results?: Place[] };
  return Array.isArray(body.results) ? body.results : [];
}

export type ResolvedLink = { lng: number; lat: number; label?: string } | { query: string };

export async function resolveShortLink(u: string, signal?: AbortSignal): Promise<ResolvedLink | null> {
  const res = await fetch(`/api/resolve?u=${encodeURIComponent(u)}`, { signal });
  if (!res.ok) return null;
  const body = (await res.json()) as Partial<{ lng: number; lat: number; label: string; query: string }>;
  if (typeof body.lng === "number" && typeof body.lat === "number") return { lng: body.lng, lat: body.lat, label: body.label };
  if (typeof body.query === "string") return { query: body.query };
  return null;
}

export async function reverseName(lng: number, lat: number, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`/api/reverse?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`, { signal });
  if (!res.ok) return "";
  const body = (await res.json()) as { label?: string };
  return typeof body.label === "string" ? body.label : "";
}
