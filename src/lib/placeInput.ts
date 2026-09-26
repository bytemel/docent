import type { LngLat } from "./types";

export type PlaceInput =
  | { kind: "point"; lng: number; lat: number; label?: string; source: "coords" | "link" | "pluscode" }
  | { kind: "shortlink"; url: string }
  | { kind: "linkquery"; query: string }
  | { kind: "pluscode-locality"; code: string; locality: string };

const ALPHABET = "23456789CFGHJMPQRVWX";
const SEP = "+";
const SEP_POS = 8;
const PAD = "0";
const PAIR_RES = [20, 1, 0.05, 0.0025, 0.000125];
const GRID_ROWS = 5;
const GRID_COLS = 4;

function validLat(n: number) {
  return Number.isFinite(n) && Math.abs(n) <= 90;
}

function validLng(n: number) {
  return Number.isFinite(n) && Math.abs(n) <= 180;
}

function dist2(a: LngLat, b: LngLat) {
  const dx = (a[0] - b[0]) * Math.cos((b[1] * Math.PI) / 180);
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

export function isValidOlc(raw: string): boolean {
  const code = raw.toUpperCase();
  const sep = code.indexOf(SEP);
  if (sep < 0 || sep !== code.lastIndexOf(SEP) || sep > SEP_POS || sep % 2 === 1) return false;
  if (code.length - sep - 1 === 1) return false;
  const pad = code.indexOf(PAD);
  if (pad >= 0) {
    if (sep < SEP_POS || pad === 0 || pad % 2 === 1) return false;
    const pads = code.slice(pad, sep);
    if (!/^0+$/.test(pads) || pads.length % 2 === 1) return false;
    if (code.length > sep + 1) return false;
  }
  for (const ch of code.replace(SEP, "").replace(/0+/g, "")) if (!ALPHABET.includes(ch)) return false;
  return true;
}

export function isFullOlc(code: string): boolean {
  if (!isValidOlc(code)) return false;
  const c = code.toUpperCase();
  if (c.indexOf(SEP) !== SEP_POS) return false;
  if (ALPHABET.indexOf(c[0]) * 20 >= 180) return false;
  if (c.length > 1 && ALPHABET.indexOf(c[1]) * 20 >= 360) return false;
  return true;
}

export function isShortOlc(code: string): boolean {
  return isValidOlc(code) && code.indexOf(SEP) < SEP_POS;
}

export function decodeOlc(raw: string): { lat: number; lng: number } | null {
  if (!isFullOlc(raw)) return null;
  const code = raw.toUpperCase().replace(SEP, "").replace(/0+$/, "").slice(0, 15);
  let lat = -90;
  let lng = -180;
  let latRes = 0;
  let lngRes = 0;
  for (let i = 0; i < Math.min(code.length, 10); i += 2) {
    const r = PAIR_RES[i / 2];
    lat += ALPHABET.indexOf(code[i]) * r;
    lng += ALPHABET.indexOf(code[i + 1] ?? "2") * r;
    latRes = r;
    lngRes = r;
  }
  for (let i = 10; i < code.length; i++) {
    latRes /= GRID_ROWS;
    lngRes /= GRID_COLS;
    const v = ALPHABET.indexOf(code[i]);
    lat += Math.floor(v / GRID_COLS) * latRes;
    lng += (v % GRID_COLS) * lngRes;
  }
  const cLat = Math.min(90, lat + latRes / 2);
  const cLng = lng + lngRes / 2;
  return { lat: Math.round(cLat * 1e7) / 1e7, lng: Math.round(cLng * 1e7) / 1e7 };
}

function encodePrefix(lat: number, lng: number, digits: number): string {
  let la = Math.floor((Math.min(89.9999999, Math.max(-90, lat)) + 90) * 8000);
  let ln = Math.floor((((((lng + 180) % 360) + 360) % 360)) * 8000);
  const latD: number[] = [];
  const lngD: number[] = [];
  for (let i = 0; i < 5; i++) {
    latD.unshift(la % 20);
    lngD.unshift(ln % 20);
    la = Math.floor(la / 20);
    ln = Math.floor(ln / 20);
  }
  let out = "";
  for (let i = 0; i < 5; i++) out += ALPHABET[latD[i]] + ALPHABET[lngD[i]];
  return out.slice(0, digits);
}

export function recoverOlc(short: string, refLat: number, refLng: number): { lat: number; lng: number } | null {
  const code = short.toUpperCase();
  if (isFullOlc(code)) return decodeOlc(code);
  if (!isShortOlc(code)) return null;
  const padLen = SEP_POS - code.indexOf(SEP);
  const res = Math.pow(20, 2 - padLen / 2);
  const half = res / 2;
  const full = encodePrefix(refLat, refLng, padLen) + code;
  const c = decodeOlc(full);
  if (!c) return null;
  let { lat, lng } = c;
  if (refLat + half < lat && lat - res >= -90) lat -= res;
  else if (refLat - half > lat && lat + res <= 90) lat += res;
  if (refLng + half < lng) lng -= res;
  else if (refLng - half > lng) lng += res;
  return { lat: Math.round(lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7 };
}

const NUM = "(-?\\d{1,3}(?:\\.\\d+)?)";
const PAIR = new RegExp(`^\\s*${NUM}\\s*[,;\\s]\\s*${NUM}\\s*$`);

export function parseCoords(raw: string, center: LngLat): LngLat | null {
  const m = PAIR.exec(raw.replace(/°/g, ""));
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const latLng: LngLat | null = validLat(a) && validLng(b) ? [b, a] : null;
  const lngLat: LngLat | null = validLng(a) && validLat(b) ? [a, b] : null;
  if (latLng && lngLat) return dist2(latLng, center) <= dist2(lngLat, center) ? latLng : lngLat;
  return latLng ?? lngLat;
}

const GOOGLE_HOST = /^(?:www\.|maps\.)?google\.[a-z.]{2,6}$/i;
const SHORT_HOST = /^(?:maps\.app\.goo\.gl|goo\.gl)$/i;

export function isGoogleMapsHost(host: string): boolean {
  return GOOGLE_HOST.test(host);
}

export function isShortLink(u: URL): boolean {
  if (!SHORT_HOST.test(u.hostname)) return false;
  return u.hostname.toLowerCase() !== "goo.gl" || u.pathname.startsWith("/maps");
}

function toUrl(raw: string): URL | null {
  const s = raw.trim();
  if (!/^(https?:\/\/|www\.|maps\.|google\.|goo\.gl|maps\.app\.goo\.gl)/i.test(s)) return null;
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
}

function pairFrom(text: string | null): LngLat | null {
  if (!text) return null;
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return validLat(lat) && validLng(lng) ? [lng, lat] : null;
}

function cleanLabel(s: string): string {
  return s.replace(/\+/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function parseGoogleUrl(u: URL): { lng: number; lat: number; label?: string } | { query: string } | null {
  if (!isGoogleMapsHost(u.hostname)) return null;
  const path = safeDecode(u.pathname);
  const isMaps = u.hostname.toLowerCase().startsWith("maps.") || path.startsWith("/maps");
  if (!isMaps) return null;
  const place = /\/place\/([^/]+)/.exec(path);
  const label = place && !pairFrom(place[1]) ? cleanLabel(place[1]) : undefined;
  const full = safeDecode(u.pathname + u.search);
  const d34 = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(full);
  if (d34) {
    const lat = Number(d34[1]);
    const lng = Number(d34[2]);
    if (validLat(lat) && validLng(lng)) return { lng, lat, ...(label ? { label } : {}) };
  }
  for (const k of ["q", "query", "ll", "destination", "daddr", "center", "sll"]) {
    const p = pairFrom(u.searchParams.get(k));
    if (p) return { lng: p[0], lat: p[1], ...(label ? { label } : {}) };
  }
  const search = /\/search\/([^/]+)/.exec(path);
  const sp = search ? pairFrom(search[1]) : null;
  if (sp) return { lng: sp[0], lat: sp[1] };
  if (place) {
    const pp = pairFrom(place[1]);
    if (pp) return { lng: pp[0], lat: pp[1] };
  }
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(path);
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (validLat(lat) && validLng(lng)) return { lng, lat, ...(label ? { label } : {}) };
  }
  if (label) return { query: label };
  const q = u.searchParams.get("q") ?? u.searchParams.get("query");
  if (q && cleanLabel(q)) return { query: cleanLabel(q) };
  if (search) return { query: cleanLabel(search[1]) };
  return null;
}

const OLC_IN_TEXT = /^\s*([23456789CFGHJMPQRVWX0]{2,8}\+[23456789CFGHJMPQRVWX]{0,7})(?:[\s,]+(.+))?\s*$/i;

export function parsePlaceInput(raw: string, center: LngLat): PlaceInput | null {
  const s = raw.trim();
  if (!s || s.length > 2048) return null;
  const geo = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i.exec(s);
  if (geo) {
    const lat = Number(geo[1]);
    const lng = Number(geo[2]);
    if (validLat(lat) && validLng(lng)) return { kind: "point", lng, lat, source: "link" };
  }
  const url = toUrl(s);
  if (url) {
    if (isShortLink(url)) return { kind: "shortlink", url: url.toString() };
    const g = parseGoogleUrl(url);
    if (g && "query" in g) return { kind: "linkquery", query: g.query };
    if (g) return { kind: "point", ...g, source: "link" };
    return null;
  }
  const c = parseCoords(s, center);
  if (c) return { kind: "point", lng: c[0], lat: c[1], source: "coords" };
  const m = OLC_IN_TEXT.exec(s);
  if (m) {
    const code = m[1].toUpperCase();
    const locality = m[2]?.trim();
    if (isFullOlc(code)) {
      const p = decodeOlc(code);
      return p ? { kind: "point", ...p, label: locality || undefined, source: "pluscode" } : null;
    }
    if (isShortOlc(code)) {
      if (locality) return { kind: "pluscode-locality", code, locality: locality.slice(0, 80) };
      const p = recoverOlc(code, center[1], center[0]);
      return p ? { kind: "point", ...p, source: "pluscode" } : null;
    }
  }
  return null;
}
