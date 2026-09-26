import type { RouteDoc } from "./types";

export function encodeDoc(doc: RouteDoc): string {
  return encodeURIComponent(JSON.stringify(doc));
}

export function decodeDoc(encoded: string): RouteDoc | null {
  try {
    return JSON.parse(decodeURIComponent(encoded)) as RouteDoc;
  } catch {
    return null;
  }
}

export function shareUrl(doc: RouteDoc, origin: string): string {
  return `${origin}/r?d=${encodeDoc(doc)}`;
}
