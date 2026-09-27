import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Cb = (data: unknown, error?: unknown) => void;

function fakeBridge(plugins: string[], opts: { languages?: string[] } = {}) {
  const promises: { plugin: string; method: string; options: unknown }[] = [];
  const callbacks: { plugin: string; method: string; options: unknown; cb: Cb; id: string }[] = [];
  const listeners: { plugin: string; event: string; cb: (d: unknown) => void; removed: boolean }[] = [];
  let n = 0;
  const cap = {
    isNativePlatform: () => true,
    getPlatform: () => "android",
    isPluginAvailable: (name: string) => plugins.includes(name),
    PluginHeaders: plugins.map((name) => ({ name })),
    nativePromise: async (plugin: string, method: string, options?: unknown) => {
      promises.push({ plugin, method, options });
      if (plugin === "TextToSpeech" && method === "getSupportedLanguages") return { languages: opts.languages ?? [] };
      return {};
    },
    nativeCallback: (plugin: string, method: string, options: unknown, cb: Cb) => {
      const id = `cb${++n}`;
      callbacks.push({ plugin, method, options, cb, id });
      return id;
    },
    addListener: (plugin: string, event: string, cb: (d: unknown) => void) => {
      const l = { plugin, event, cb, removed: false };
      listeners.push(l);
      return { remove: async () => void (l.removed = true) };
    },
  };
  return { cap, promises, callbacks, listeners };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detecting the app", () => {
  it("is web without the bridge", async () => {
    vi.stubGlobal("window", {});
    const n = await import("@/lib/native");
    expect(n.isNativeApp()).toBe(false);
    expect(n.hasPlugin("TextToSpeech")).toBe(false);
    expect(n.nativePlatform()).toBe("web");
  });

  it("sees the bridge and its plugins", async () => {
    const f = fakeBridge(["TextToSpeech", "App"]);
    vi.stubGlobal("window", { Capacitor: f.cap });
    const n = await import("@/lib/native");
    expect(n.isNativeApp()).toBe(true);
    expect(n.nativePlatform()).toBe("android");
    expect(n.hasPlugin("TextToSpeech")).toBe(true);
    expect(n.hasPlugin("KeepAwake")).toBe(false);
    expect(n.plugin("KeepAwake").available).toBe(false);
  });

  it("prefers methods exported on Capacitor.Plugins", async () => {
    const f = fakeBridge(["Share"]);
    const shareFn = vi.fn(async () => ({ activityType: "whatsapp" }));
    vi.stubGlobal("window", { Capacitor: { ...f.cap, Plugins: { Share: { share: shareFn } } } });
    const n = await import("@/lib/native");
    expect(await n.share({ title: "Trip", url: "https://docent.test/live/x" })).toBe(true);
    expect(shareFn).toHaveBeenCalledWith({ title: "Trip", url: "https://docent.test/live/x", dialogTitle: "Trip" });
    expect(f.promises).toHaveLength(0);
  });
});

describe("location", () => {
  it("starts a background watcher with a notification and normalises fixes", async () => {
    const f = fakeBridge(["BackgroundGeolocation"]);
    vi.stubGlobal("window", { Capacitor: f.cap });
    const n = await import("@/lib/native");
    const fixes: unknown[] = [];
    const errors: unknown[] = [];
    const stop = n.watchLocation((x) => fixes.push(x), (e) => errors.push(e), {
      background: true,
      notificationTitle: "Docent",
      notificationText: "Guiding you to Sarit Centre",
    });
    await flush();
    expect(f.callbacks[0]).toMatchObject({
      plugin: "BackgroundGeolocation",
      method: "addWatcher",
      options: {
        requestPermissions: true,
        distanceFilter: 5,
        backgroundTitle: "Docent",
        backgroundMessage: "Guiding you to Sarit Centre",
      },
    });
    f.callbacks[0].cb({ latitude: -1.26, longitude: 36.8, accuracy: 7, bearing: 90, speed: 1.4, time: 1000, altitude: null });
    expect(fixes).toEqual([{ lng: 36.8, lat: -1.26, acc: 7, heading: 90, speed: 1.4, t: 1000 }]);
    f.callbacks[0].cb(null, { code: "NOT_AUTHORIZED", message: "Location permission denied" });
    expect(errors).toEqual([{ code: "denied", message: "Location permission denied" }]);
    stop();
    await flush();
    expect(f.promises).toContainEqual({ plugin: "BackgroundGeolocation", method: "removeWatcher", options: { id: "cb1" } });
    f.callbacks[0].cb({ latitude: 0, longitude: 0, accuracy: 5, bearing: null, speed: null, time: 2000 });
    expect(fixes).toHaveLength(1);
  });

  it("does not ask for background updates when not needed", async () => {
    const f = fakeBridge(["BackgroundGeolocation"]);
    vi.stubGlobal("window", { Capacitor: f.cap });
    const n = await import("@/lib/native");
    n.watchLocation(() => {}, () => {}, { background: false });
    await flush();
    expect(f.callbacks[0].options).not.toHaveProperty("backgroundMessage");
  });

  it("falls back to the browser with high accuracy", async () => {
    const watchPosition = vi.fn((ok: (p: unknown) => void) => {
      ok({ coords: { longitude: 36.8, latitude: -1.26, accuracy: 12, heading: null, speed: null }, timestamp: 5 });
      return 7;
    });
    const clearWatch = vi.fn();
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { geolocation: { watchPosition, clearWatch } });
    const n = await import("@/lib/native");
    const fixes: unknown[] = [];
    const stop = n.watchLocation((x) => fixes.push(x), () => {}, { background: true });
    expect(watchPosition.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true });
    expect(fixes).toEqual([{ lng: 36.8, lat: -1.26, acc: 12, heading: null, speed: null, t: 5 }]);
    stop();
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("reports when there is no location at all", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {});
    const n = await import("@/lib/native");
    const errors: { code: string }[] = [];
    n.watchLocation(() => {}, (e) => errors.push(e), { background: false });
    expect(errors[0].code).toBe("unavailable");
  });
});

describe("speech", () => {
  it("speaks in Kenyan English when the phone has it, and flushes on interrupt", async () => {
    const f = fakeBridge(["TextToSpeech"], { languages: ["en-US", "en_KE"] });
    vi.stubGlobal("window", { Capacitor: f.cap });
    const n = await import("@/lib/native");
    expect(await n.nativeSpeak("Turn left now", { interrupt: true })).toBe(true);
    expect(await n.nativeSpeak("Then turn right")).toBe(true);
    const speaks = f.promises.filter((p) => p.method === "speak").map((p) => p.options as Record<string, unknown>);
    expect(speaks[0]).toMatchObject({ text: "Turn left now", lang: "en-KE", rate: 1, queueStrategy: 0 });
    expect(speaks[1]).toMatchObject({ queueStrategy: 1 });
    await n.nativeStopSpeaking();
    expect(f.promises.at(-1)?.method).toBe("stop");
  });

  it("uses British English otherwise", async () => {
    const f = fakeBridge(["TextToSpeech"], { languages: ["en-US"] });
    vi.stubGlobal("window", { Capacitor: f.cap });
    const n = await import("@/lib/native");
    await n.nativeSpeak("Hello");
    expect((f.promises.find((p) => p.method === "speak")?.options as { lang: string }).lang).toBe("en-GB");
  });

  it("routes the voice module through native speech in the app", async () => {
    const f = fakeBridge(["TextToSpeech"]);
    vi.stubGlobal("window", { Capacitor: f.cap });
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    const { getVoice } = await import("@/lib/voice");
    const voice = getVoice();
    expect(voice.supported).toBe(true);
    voice.speak("In 150 m, turn left", { interrupt: true });
    await flush();
    await flush();
    const speak = f.promises.find((p) => p.method === "speak")?.options as { text: string; queueStrategy: number };
    expect(speak.text).toBe("In 150 metres, turn left");
    expect(speak.queueStrategy).toBe(0);
    voice.cancel();
    await flush();
    expect(f.promises.at(-1)?.method).toBe("stop");
  });
});

describe("other powers", () => {
  it("keeps the screen awake and lets it sleep", async () => {
    const f = fakeBridge(["KeepAwake"]);
    vi.stubGlobal("window", { Capacitor: f.cap });
    const n = await import("@/lib/native");
    expect(await n.keepAwake(true)).toBe(true);
    expect(await n.keepAwake(false)).toBe(true);
    expect(f.promises.map((p) => p.method)).toEqual(["keepAwake", "allowSleep"]);
  });

  it("returns false for keep awake on the web", async () => {
    vi.stubGlobal("window", {});
    const n = await import("@/lib/native");
    expect(await n.keepAwake(true)).toBe(false);
  });

  it("taps a light haptic for each maneuver", async () => {
    const f = fakeBridge(["Haptics"]);
    vi.stubGlobal("window", { Capacitor: f.cap });
    const n = await import("@/lib/native");
    await n.haptic("tick");
    await n.haptic("success");
    expect(f.promises).toEqual([
      { plugin: "Haptics", method: "impact", options: { style: "LIGHT" } },
      { plugin: "Haptics", method: "notification", options: { type: "SUCCESS" } },
    ]);
  });

  it("listens for the Android back button and can minimise", async () => {
    const f = fakeBridge(["App"]);
    vi.stubGlobal("window", { Capacitor: f.cap });
    const n = await import("@/lib/native");
    const seen: boolean[] = [];
    const off = await n.onBackButton((canGoBack) => seen.push(canGoBack));
    f.listeners[0].cb({ canGoBack: true });
    expect(seen).toEqual([true]);
    off();
    await flush();
    expect(f.listeners[0].removed).toBe(true);
    await n.minimizeApp();
    expect(f.promises.at(-1)).toMatchObject({ plugin: "App", method: "minimizeApp" });
  });
});
