export interface Place {
  label: string;
  sub: string;
  lng: number;
  lat: number;
}

export async function searchPlaces(q: string, center: [number, number], signal?: AbortSignal): Promise<Place[]> {
  const url = `/api/search?q=${encodeURIComponent(q)}&lat=${center[1].toFixed(4)}&lng=${center[0].toFixed(4)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const body = (await res.json()) as { results?: Place[] };
  return Array.isArray(body.results) ? body.results : [];
}

export async function reverseName(lng: number, lat: number, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`/api/reverse?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`, { signal });
  if (!res.ok) return "";
  const body = (await res.json()) as { label?: string };
  return typeof body.label === "string" ? body.label : "";
}
