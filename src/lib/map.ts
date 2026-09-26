import type { LngLat } from "./types";

export const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
export const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
export const TILEJSON_URL = "https://tiles.openfreemap.org/planet";

export const NAIROBI: LngLat = [36.8219, -1.2921];

export function prefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function mapStyleUrl(dark = prefersDark()): string {
  return dark ? STYLE_DARK : STYLE_LIGHT;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const MAP_WORKER_PATH = "/maplibre/maplibre-gl-worker.mjs";

export function ensureMapWorker(ml: { setWorkerUrl: (url: string) => void }): void {
  if (typeof window === "undefined") return;
  ml.setWorkerUrl(new URL(MAP_WORKER_PATH, window.location.origin).toString());
}
