import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page, Request } from "@playwright/test";

export const DEMO_DIR = path.join(process.cwd(), "test-results", "demo");

export const NAIROBI = {
  westlands: { latitude: -1.26756, longitude: 36.81046 },
  kangemi: { latitude: -1.26801, longitude: 36.7523 },
};

export const isLocal = (baseURL: string | undefined) => /^https?:\/\/(localhost|127\.0\.0\.1)/.test(baseURL ?? "");

export async function stubSpeech(page: Page | BrowserContext) {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: string[] };
    w.__spoken = [];
    class Utterance {
      text: string;
      lang = "";
      voice: unknown = null;
      rate = 1;
      pitch = 1;
      volume = 1;
      onend: ((e: unknown) => void) | null = null;
      onstart: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
      addEventListener(type: string, fn: (e: unknown) => void) {
        if (type === "end") this.onend = fn;
        if (type === "start") this.onstart = fn;
      }
      removeEventListener() {}
    }
    const voice = { name: "Test voice", lang: "en-GB", localService: true, default: true, voiceURI: "test" };
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      speak(u: Utterance) {
        if (u.text.trim() && u.volume > 0) w.__spoken.push(u.text);
        setTimeout(() => {
          u.onstart?.({});
          u.onend?.({});
        }, 30);
      },
      cancel() {},
      pause() {},
      resume() {},
      getVoices() {
        return [voice];
      },
      addEventListener() {},
      removeEventListener() {},
      onvoiceschanged: null,
    };
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true, writable: true });
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  });
}

export async function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []);
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export async function shot(page: Page, flow: string, caption: string) {
  const dir = path.join(DEMO_DIR, flow);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${slug(caption)}.jpg`);
  await page.screenshot({ path: file, type: "jpeg", quality: 72 });
  const index = path.join(dir, "shots.json");
  const list: { file: string; caption: string }[] = existsSync(index) ? JSON.parse(readFileSync(index, "utf8")) : [];
  list.push({ file: path.basename(file), caption });
  writeFileSync(index, JSON.stringify(list, null, 1));
}

export async function saveSpoken(page: Page, flow: string, label?: string) {
  const lines = await spoken(page);
  const dir = path.join(DEMO_DIR, flow);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "spoken.json");
  const all: { label: string; lines: string[] }[] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  all.push({ label: label ?? flow, lines });
  writeFileSync(file, JSON.stringify(all, null, 1));
  return lines;
}

export function watchErrors(page: Page, allow: RegExp[] = []) {
  const errors: string[] = [];
  const ok = (s: string) => allow.some((r) => r.test(s));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = `${m.text()} ${m.location()?.url ?? ""}`;
    if (!ok(text)) errors.push(text);
  });
  page.on("pageerror", (e) => {
    if (!ok(e.message)) errors.push(`pageerror: ${e.message}`);
  });
  return errors;
}

export async function exampleLink(page: Page): Promise<string> {
  const res = await page.request.get("/");
  const html = await res.text();
  const m = /\/r\?d=[A-Za-z0-9_-]+/.exec(html);
  if (!m) throw new Error("Could not find the example link on the home page");
  return m[0];
}

export async function noOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

export function lngLatPath(line: [number, number][], stepM: number): { latitude: number; longitude: number }[] {
  const R = 6371008.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dist = (a: [number, number], b: [number, number]) => {
    const dLat = rad(b[1] - a[1]);
    const dLng = rad(b[0] - a[0]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  };
  const out: { latitude: number; longitude: number }[] = [];
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const len = dist(a, b);
    let at = carry === 0 && i === 1 ? 0 : stepM - carry;
    while (at <= len) {
      const t = len ? at / len : 0;
      out.push({ longitude: a[0] + (b[0] - a[0]) * t, latitude: a[1] + (b[1] - a[1]) * t });
      at += stepM;
    }
    carry = len - (at - stepM);
  }
  const last = line[line.length - 1];
  out.push({ longitude: last[0], latitude: last[1] });
  return out;
}

export function isRouteRequest(r: Request) {
  return r.url().includes("/api/route?");
}
