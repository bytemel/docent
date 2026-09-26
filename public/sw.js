const SHELL = "docent-shell-v1";
const PAGES = "docent-pages-v1";
const MAP = "docent-map-v1";
const API = "docent-api-v1";
const LIMITS = { [SHELL]: 250, [PAGES]: 40, [MAP]: 400, [API]: 60 };
const MAP_HOST = "tiles.openfreemap.org";
const MATCH = { ignoreVary: true };

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = Object.keys(LIMITS);
      for (const key of await caches.keys()) {
        if (key.startsWith("docent-") && !keep.includes(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

function isShell(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/maplibre/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.webmanifest"
  );
}

function isPage(url) {
  return url.pathname === "/" || url.pathname === "/r";
}

function isMapFile(url) {
  return /\.(pbf|png|webp|jpg)$/.test(url.pathname);
}

function bucketFor(url) {
  if (url.origin === self.location.origin) {
    if (url.pathname === "/api/route") return API;
    if (url.pathname.startsWith("/api/")) return null;
    if (isShell(url)) return SHELL;
    if (isPage(url)) return PAGES;
    return null;
  }
  return url.hostname === MAP_HOST ? MAP : null;
}

const puts = {};

async function store(name, key, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(name);
  await cache.put(key, response);
  puts[name] = (puts[name] || 0) + 1;
  if (puts[name] % 20 === 0) await trim(name);
}

async function trim(name) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  const extra = keys.length - LIMITS[name];
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, name) {
  const hit = await caches.match(request, { ...MATCH, cacheName: name });
  if (hit) return hit;
  const response = await fetch(request);
  await store(name, request, response.clone());
  return response;
}

async function staleWhileRevalidate(event, name) {
  const hit = await caches.match(event.request, { ...MATCH, cacheName: name });
  const fresh = fetch(event.request)
    .then(async (response) => {
      await store(name, event.request, response.clone());
      return response;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(fresh);
    return hit;
  }
  return (await fresh) || Response.error();
}

async function networkFirst(request, name) {
  try {
    const response = await fetch(request);
    await store(name, request.url, response.clone());
    return response;
  } catch (error) {
    const hit = await caches.match(request.url, { ...MATCH, cacheName: name });
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const bucket = bucketFor(url);
  if (bucket === API) event.respondWith(networkFirst(request, API));
  else if (bucket === SHELL) event.respondWith(staleWhileRevalidate(event, SHELL));
  else if (bucket === PAGES && request.mode === "navigate") event.respondWith(networkFirst(request, PAGES));
  else if (bucket === MAP) event.respondWith(isMapFile(url) ? cacheFirst(request, MAP) : staleWhileRevalidate(event, MAP));
});

async function prefetch(raw) {
  let url;
  try {
    url = new URL(raw, self.location.origin);
  } catch {
    return;
  }
  const bucket = bucketFor(url);
  if (!bucket || bucket === API) return;
  if (bucket !== PAGES && (await caches.match(url.href, { ...MATCH, cacheName: bucket }))) return;
  try {
    const sameOrigin = url.origin === self.location.origin;
    const response = await fetch(url.href, { mode: sameOrigin ? "same-origin" : "cors", credentials: "omit" });
    await store(bucket, url.href, response);
  } catch {}
}

async function prefetchAll(urls) {
  const queue = urls.slice(0, 500);
  const worker = async () => {
    while (queue.length) await prefetch(queue.shift());
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  for (const name of Object.keys(LIMITS)) await trim(name);
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "docent:cache" || !Array.isArray(data.urls)) return;
  event.waitUntil(prefetchAll(data.urls.filter((u) => typeof u === "string")));
});
