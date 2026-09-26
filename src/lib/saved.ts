export interface SavedRoute {
  title: string;
  d: string;
  savedAt: string;
  distance: string;
}

export const SAVED_KEY = "docent:saved";
export const SAVED_MAX = 20;
const EVENT = "docent:saved-change";

function isSaved(v: unknown): v is SavedRoute {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.title === "string" && typeof r.d === "string" && typeof r.savedAt === "string" && typeof r.distance === "string";
}

export function parseSaved(raw: string | null): SavedRoute[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.filter(isSaved).slice(0, SAVED_MAX) : [];
  } catch {
    return [];
  }
}

export function withRoute(list: SavedRoute[], route: SavedRoute): SavedRoute[] {
  return [route, ...list.filter((r) => r.d !== route.d)].slice(0, SAVED_MAX);
}

function read(): string | null {
  try {
    return window.localStorage.getItem(SAVED_KEY);
  } catch {
    return null;
  }
}

function write(list: SavedRoute[]): void {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

export function saveRoute(route: Omit<SavedRoute, "savedAt">): void {
  write(withRoute(parseSaved(read()), { ...route, savedAt: new Date().toISOString() }));
}

export function removeRoute(d: string): void {
  write(parseSaved(read()).filter((r) => r.d !== d));
}

export function subscribeSaved(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAVED_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}

export function savedSnapshot(): string {
  return read() ?? "";
}
