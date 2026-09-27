import type { LiveFix } from "./live";

type Callback = (data: unknown, error?: unknown) => void;
type Remover = { remove: () => unknown };

export interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: Record<string, Record<string, unknown> | undefined>;
  PluginHeaders?: { name: string }[];
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>;
  nativeCallback?: (plugin: string, method: string, options: unknown, cb: Callback) => unknown;
  addListener?: (plugin: string, event: string, cb: (data: unknown) => void) => Remover | Promise<Remover>;
}

export interface NativePlugin {
  available: boolean;
  call<T = unknown>(method: string, options?: unknown): Promise<T>;
  callback(method: string, options: unknown, cb: Callback): Promise<string>;
  listen(event: string, cb: (data: unknown) => void): Promise<() => void>;
}

export type HapticKind = "tick" | "success" | "warning";

export interface LocationError {
  code: "denied" | "unavailable" | "timeout";
  message: string;
}

export interface WatchOptions {
  background: boolean;
  notificationTitle?: string;
  notificationText?: string;
}

export function bridge(): CapacitorBridge | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { Capacitor?: CapacitorBridge }).Capacitor ?? null) as CapacitorBridge | null;
}

export function isNativeApp(): boolean {
  const cap = bridge();
  return Boolean(cap?.isNativePlatform?.());
}

export function nativePlatform(): "android" | "ios" | "web" {
  const p = isNativeApp() ? bridge()?.getPlatform?.() : "web";
  return p === "android" || p === "ios" ? p : "web";
}

export function hasPlugin(name: string): boolean {
  const cap = bridge();
  if (!cap || !isNativeApp()) return false;
  return Boolean(
    cap.isPluginAvailable?.(name) || cap.Plugins?.[name] || cap.PluginHeaders?.some((h) => h.name === name),
  );
}

export function plugin(name: string): NativePlugin {
  const cap = bridge();
  const available = hasPlugin(name);
  const own = (method: string) => {
    const fn = cap?.Plugins?.[name]?.[method];
    return typeof fn === "function" ? (fn as (...args: unknown[]) => unknown) : null;
  };
  return {
    available,
    async call<T>(method: string, options?: unknown): Promise<T> {
      if (!available || !cap) throw new Error(`${name} is not available`);
      const fn = own(method);
      if (fn) return (await fn.call(cap.Plugins?.[name], options)) as T;
      if (cap.nativePromise) return (await cap.nativePromise(name, method, options)) as T;
      throw new Error(`${name}.${method} is not available`);
    },
    async callback(method: string, options: unknown, cb: Callback): Promise<string> {
      if (!available || !cap) throw new Error(`${name} is not available`);
      if (cap.nativeCallback) return String(await cap.nativeCallback(name, method, options, cb));
      const fn = own(method);
      if (fn) return String(await fn.call(cap.Plugins?.[name], options, cb));
      throw new Error(`${name}.${method} is not available`);
    },
    async listen(event: string, cb: (data: unknown) => void): Promise<() => void> {
      if (!available || !cap) return () => {};
      const fn = own("addListener");
      const handle = fn ? await fn.call(cap.Plugins?.[name], event, cb) : await cap.addListener?.(name, event, cb);
      return () => {
        void Promise.resolve((handle as Remover | undefined)?.remove?.()).catch(() => {});
      };
    },
  };
}

let ttsLang: Promise<string> | null = null;

function pickLang(): Promise<string> {
  if (!ttsLang) {
    ttsLang = plugin("TextToSpeech")
      .call<{ languages?: string[] }>("getSupportedLanguages")
      .then(({ languages = [] }) => {
        const norm = languages.map((l) => l.replace("_", "-").toLowerCase());
        if (norm.includes("en-ke")) return "en-KE";
        return "en-GB";
      })
      .catch(() => "en-GB");
  }
  return ttsLang;
}

export async function nativeSpeak(text: string, opts: { interrupt?: boolean } = {}): Promise<boolean> {
  const tts = plugin("TextToSpeech");
  if (!tts.available || !text.trim()) return false;
  try {
    const lang = await pickLang();
    await tts.call("speak", {
      text,
      lang,
      rate: 1,
      pitch: 1,
      volume: 1,
      category: "playback",
      queueStrategy: opts.interrupt ? 0 : 1,
    });
    return true;
  } catch {
    return false;
  }
}

export async function nativeStopSpeaking(): Promise<void> {
  const tts = plugin("TextToSpeech");
  if (tts.available) await tts.call("stop").catch(() => {});
}

export async function keepAwake(on: boolean): Promise<boolean> {
  const ka = plugin("KeepAwake");
  if (!ka.available) return false;
  try {
    await ka.call(on ? "keepAwake" : "allowSleep");
    return true;
  } catch {
    return false;
  }
}

export async function share(data: { title?: string; text?: string; url?: string }): Promise<boolean> {
  const sh = plugin("Share");
  if (sh.available) {
    try {
      await sh.call("share", { ...data, dialogTitle: data.title });
      return true;
    } catch {
      return false;
    }
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function haptic(kind: HapticKind = "tick"): Promise<void> {
  const h = plugin("Haptics");
  if (h.available) {
    const run =
      kind === "tick"
        ? h.call("impact", { style: "LIGHT" })
        : h.call("notification", { type: kind === "success" ? "SUCCESS" : "WARNING" });
    await run.catch(() => {});
    return;
  }
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(kind === "tick" ? 12 : [20, 60, 20]);
  }
}

export async function minimizeApp(): Promise<void> {
  await plugin("App").call("minimizeApp").catch(() => {});
}

export async function onBackButton(cb: (canGoBack: boolean) => void): Promise<() => void> {
  return plugin("App").listen("backButton", (data) => cb(Boolean((data as { canGoBack?: boolean } | null)?.canGoBack)));
}

interface NativeLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  bearing: number | null;
  speed: number | null;
  time: number | null;
}

export function fromNative(loc: NativeLocation): LiveFix {
  const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    lng: loc.longitude,
    lat: loc.latitude,
    acc: num(loc.accuracy) ?? 50,
    heading: num(loc.bearing),
    speed: num(loc.speed),
    t: num(loc.time) ?? Date.now(),
  };
}

export function fromWeb(p: GeolocationPosition): LiveFix {
  const c = p.coords;
  return {
    lng: c.longitude,
    lat: c.latitude,
    acc: c.accuracy,
    heading: c.heading !== null && Number.isFinite(c.heading) ? c.heading : null,
    speed: c.speed !== null && Number.isFinite(c.speed) ? c.speed : null,
    t: p.timestamp || Date.now(),
  };
}

function nativeError(err: unknown): LocationError {
  const e = err as { code?: string; message?: string } | null;
  const denied = e?.code === "NOT_AUTHORIZED" || /permission|authori[sz]/i.test(e?.message ?? "");
  return { code: denied ? "denied" : "unavailable", message: e?.message ?? "Location is not available" };
}

export function watchLocation(
  onFix: (fix: LiveFix) => void,
  onError: (err: LocationError) => void,
  opts: WatchOptions,
): () => void {
  const bg = plugin("BackgroundGeolocation");
  if (bg.available) {
    let stopped = false;
    const options: Record<string, unknown> = { requestPermissions: true, stale: false, distanceFilter: 5 };
    if (opts.background) {
      options.backgroundMessage = opts.notificationText ?? "Docent is guiding you.";
      options.backgroundTitle = opts.notificationTitle ?? "Docent";
    }
    const id = bg
      .callback("addWatcher", options, (data, error) => {
        if (stopped) return;
        if (error) onError(nativeError(error));
        else if (data) onFix(fromNative(data as NativeLocation));
      })
      .catch((err) => {
        onError(nativeError(err));
        return null;
      });
    return () => {
      stopped = true;
      void id.then((w) => (w ? bg.call("removeWatcher", { id: w }).catch(() => {}) : undefined));
    };
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError({ code: "unavailable", message: "This browser cannot share your location." });
    return () => {};
  }
  const watch = navigator.geolocation.watchPosition(
    (p) => onFix(fromWeb(p)),
    (err) =>
      onError({
        code: err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable",
        message: err.message,
      }),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 },
  );
  return () => navigator.geolocation.clearWatch(watch);
}

export const APP_HOSTS = ["docent-drab.vercel.app"];
const APP_PATH = /^\/(r|go|here|new|live\/[A-Za-z0-9_-]{1,64})?$/;

export function appPath(raw: string, hosts: string[] = APP_HOSTS): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  let path: string;
  if (u.protocol === "docent:") path = `/${`${u.host}${u.pathname}`.replace(/^\/+/, "")}`;
  else if (u.protocol === "https:" && hosts.includes(u.host)) path = u.pathname || "/";
  else return null;
  path = path.replace(/\/+$/, "") || "/";
  return APP_PATH.test(path) ? `${path}${u.search}` : null;
}

export async function onAppUrlOpen(cb: (url: string) => void): Promise<() => void> {
  return plugin("App").listen("appUrlOpen", (data) => {
    const url = (data as { url?: unknown } | null)?.url;
    if (typeof url === "string") cb(url);
  });
}
