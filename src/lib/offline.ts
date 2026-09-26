import { mapStyleUrl, TILEJSON_URL } from "./map";
import { decodePolyline } from "./polyline";
import { tilesForRoute } from "./tiles";

export const SW_URL = "/sw.js";
export const PAGES_CACHE = "docent-pages-v1";
export const MAP_CACHE = "docent-map-v1";
export const PREFETCH_ZOOMS = [12, 13, 14, 15, 16];
export const PREFETCH_TILE_CAP = 150;
const MAP_ORIGIN = "https://tiles.openfreemap.org";

interface NetworkInfo {
  type?: string;
  saveData?: boolean;
}

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "caches" in window;
}

export async function registerOffline(): Promise<ServiceWorkerRegistration | null> {
  if (process.env.NODE_ENV !== "production" || !offlineSupported()) return null;
  try {
    await navigator.serviceWorker.register(SW_URL);
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export function canPrefetch(connection?: NetworkInfo): boolean {
  return connection?.type === "wifi" || !connection?.saveData;
}

export function routePageUrl(d: string, origin: string): string {
  return `${origin}/r?d=${d}`;
}

export function tileUrlsForLine(coords: [number, number][], template: string, cap = PREFETCH_TILE_CAP): string[] {
  const out: string[] = [];
  for (const z of PREFETCH_ZOOMS) {
    if (out.length >= cap) break;
    for (const [x, y] of tilesForRoute(coords, z <= 13 ? 2500 : 150, z, cap - out.length)) {
      out.push(template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)));
    }
  }
  return out.slice(0, cap);
}

function fontStacks(style: { layers?: { layout?: Record<string, unknown> }[] }): string[] {
  const stacks = new Set<string>();
  for (const layer of style.layers ?? []) {
    const font = layer.layout?.["text-font"];
    if (Array.isArray(font) && font.every((f) => typeof f === "string")) stacks.add(font.join(","));
  }
  return [...stacks];
}

async function mapUrls(line: string): Promise<string[]> {
  const coords = decodePolyline(line, 2000);
  if (!coords || coords.length < 2) return [];
  const styleUrl = mapStyleUrl();
  const urls = [styleUrl, TILEJSON_URL];
  try {
    const [style, tilejson] = await Promise.all([
      fetch(styleUrl).then((r) => r.json()),
      fetch(TILEJSON_URL).then((r) => r.json()),
    ]);
    if (typeof style.sprite === "string" && style.sprite.startsWith(MAP_ORIGIN)) {
      for (const suffix of [".json", ".png", "@2x.json", "@2x.png"]) urls.push(`${style.sprite}${suffix}`);
    }
    if (typeof style.glyphs === "string" && style.glyphs.startsWith(MAP_ORIGIN)) {
      for (const stack of fontStacks(style)) urls.push(style.glyphs.replace("{fontstack}", stack).replace("{range}", "0-255"));
    }
    const template = Array.isArray(tilejson.tiles) ? tilejson.tiles[0] : null;
    if (typeof template === "string" && template.startsWith(MAP_ORIGIN)) urls.push(...tileUrlsForLine(coords, template));
  } catch {}
  return urls;
}

function shellAssets(): string[] {
  return performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => u.startsWith(location.origin) || u.startsWith(MAP_ORIGIN));
}

export async function cacheRouteForOffline(d: string, line: string): Promise<void> {
  const reg = await registerOffline();
  const worker = reg?.active;
  if (!worker) return;
  worker.postMessage({ type: "docent:cache", urls: [routePageUrl(d, location.origin), ...shellAssets()] });
  if (!canPrefetch((navigator as Navigator & { connection?: NetworkInfo }).connection)) return;
  worker.postMessage({ type: "docent:cache", urls: await mapUrls(line) });
}

export async function isRouteCachedOffline(d: string): Promise<boolean> {
  if (!offlineSupported()) return false;
  try {
    const page = await caches.match(routePageUrl(d, location.origin), { cacheName: PAGES_CACHE, ignoreVary: true });
    if (!page) return false;
    const map = await caches.open(MAP_CACHE);
    return (await map.keys()).length > 0;
  } catch {
    return false;
  }
}
