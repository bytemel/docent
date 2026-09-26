import type { Waypoint } from "@/lib/types";

export const NAME_MAX = 40;
export const NOTE_MAX = 120;
export const LABEL_MAX = 80;
export const ACC_MAX = 100000;

const NUM = /^-?\d{1,3}(\.\d{1,8})?$/;

export function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

function coord(raw: string | undefined, limit: number): number | null {
  if (raw === undefined) return null;
  const s = raw.trim();
  if (!NUM.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

export function encodePoint(p: { lng: number; lat: number; label?: string }): string {
  const label = cleanText(p.label, LABEL_MAX);
  return `${p.lng.toFixed(5)},${p.lat.toFixed(5)}${label ? `,${label}` : ""}`;
}

export function decodePoint(raw: unknown): Waypoint | null {
  if (typeof raw !== "string" || raw.length > 200) return null;
  const [a, b, ...rest] = raw.split(",");
  const lng = coord(a, 180);
  const lat = coord(b, 90);
  if (lng === null || lat === null) return null;
  const label = cleanText(rest.join(","), LABEL_MAX);
  return label ? { lng, lat, label } : { lng, lat };
}

export interface FromPoint {
  lng: number;
  lat: number;
  acc?: number;
}

export function encodeFrom(p: FromPoint): string {
  const acc = p.acc !== undefined && Number.isFinite(p.acc) ? `,${Math.min(ACC_MAX, Math.max(0, Math.round(p.acc)))}` : "";
  return `${p.lng.toFixed(6)},${p.lat.toFixed(6)}${acc}`;
}

export function decodeFrom(raw: unknown): FromPoint | null {
  if (typeof raw !== "string" || raw.length > 60) return null;
  const parts = raw.split(",");
  if (parts.length < 2 || parts.length > 3) return null;
  const lng = coord(parts[0], 180);
  const lat = coord(parts[1], 90);
  if (lng === null || lat === null) return null;
  if (parts.length === 2) return { lng, lat };
  const acc = /^\d{1,6}$/.test(parts[2].trim()) ? Number(parts[2]) : NaN;
  if (!Number.isFinite(acc) || acc > ACC_MAX) return null;
  return { lng, lat, acc };
}

function first(v: string | string[] | undefined | null): string | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

export function readHereParams(sp: Record<string, string | string[] | undefined>): { name: string; to: Waypoint | null } {
  return { name: cleanText(first(sp.n), NAME_MAX), to: decodePoint(first(sp.to)) };
}

export function hereUrl(origin: string, opts: { name?: string; to?: Waypoint | null }): string {
  const p = new URLSearchParams();
  const name = cleanText(opts.name, NAME_MAX);
  if (name) p.set("n", name);
  if (opts.to) p.set("to", encodePoint(opts.to));
  const q = p.toString();
  return `${origin}/here${q ? `?${q}` : ""}`;
}

export function replyUrl(origin: string, opts: { from: FromPoint; note?: string; to?: Waypoint | null }): string {
  const p = new URLSearchParams();
  p.set("from", encodeFrom(opts.from));
  const note = cleanText(opts.note, NOTE_MAX);
  if (note) p.set("fl", note);
  if (opts.to) p.set("to", encodePoint(opts.to));
  return `${origin}/new?${p.toString()}`;
}

export function readFromParams(search: string, fallbackLabel: string): { from: Waypoint; to: Waypoint | null } | null {
  const sp = new URLSearchParams(search);
  const f = decodeFrom(sp.get("from"));
  if (!f) return null;
  const note = cleanText(sp.get("fl"), NOTE_MAX);
  return {
    from: { lng: f.lng, lat: f.lat, label: note || fallbackLabel },
    to: decodePoint(sp.get("to")),
  };
}
