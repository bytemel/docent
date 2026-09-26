import type { RouteDoc } from "./types";

export const DRAFT_KEY = "docent:draft";

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: RouteDoc | null = null;

function isDoc(v: unknown): v is RouteDoc {
  const d = v as RouteDoc;
  return !!d && d.v === 1 && Array.isArray(d.segments) && Array.isArray(d.landmarks) && Array.isArray(d.steps);
}

export function loadDraft(): RouteDoc | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw) as unknown;
    return isDoc(doc) && doc.segments.length > 0 ? doc : null;
  } catch {
    return null;
  }
}

export function saveDraftNow(doc: RouteDoc): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(doc));
  } catch {
    // Storage can be full or blocked in private mode; the draft is a convenience only.
  }
}

export function saveDraft(doc: RouteDoc, delayMs = 500): void {
  pending = doc;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (pending) saveDraftNow(pending);
    pending = null;
  }, delayMs);
}

export function flushDraft(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (pending) saveDraftNow(pending);
  pending = null;
}

export function clearDraft(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}
