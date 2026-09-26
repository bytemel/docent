import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanName,
  decodeFix,
  encodeFix,
  isLiveConfigured,
  isValidLiveId,
  newLiveId,
  setLiveClientFactory,
  startLiveShare,
  watchLive,
  type LiveStatus,
} from "@/lib/live";

describe("live id", () => {
  it("is at least 22 URL safe base64 characters", () => {
    for (let i = 0; i < 200; i++) {
      const id = newLiveId();
      expect(id.length).toBeGreaterThanOrEqual(22);
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(isValidLiveId(id)).toBe(true);
    }
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newLiveId()));
    expect(ids.size).toBe(1000);
  });

  it("rejects short or odd ids", () => {
    expect(isValidLiveId("abc")).toBe(false);
    expect(isValidLiveId("a".repeat(21))).toBe(false);
    expect(isValidLiveId(`${"a".repeat(22)}!`)).toBe(false);
    expect(isValidLiveId("a".repeat(65))).toBe(false);
    expect(isValidLiveId(undefined)).toBe(false);
  });
});

describe("names and fixes", () => {
  it("cleans a name for the link", () => {
    expect(cleanName("  Wanjiru \n Kamau ")).toBe("Wanjiru Kamau");
    expect(cleanName("x".repeat(80))).toHaveLength(40);
    expect(cleanName(42)).toBe("");
  });

  it("round trips a fix in a compact payload", () => {
    const fix = { lng: 36.8123456789, lat: -1.2654321, acc: 12.4, heading: 271.6, speed: 3.456, t: 1_700_000_000_123 };
    const wire = encodeFix(fix);
    expect(Object.keys(wire).sort()).toEqual(["a", "h", "s", "t", "x", "y"]);
    expect(decodeFix(wire)).toEqual({ lng: 36.812346, lat: -1.265432, acc: 12, heading: 272, speed: 3.5, t: 1_700_000_000_123 });
    expect(encodeFix({ ...fix, heading: null, speed: null })).not.toHaveProperty("h");
  });

  it("refuses a bad payload", () => {
    expect(decodeFix(null)).toBeNull();
    expect(decodeFix({ x: "1", y: 2, a: 3, t: 4 })).toBeNull();
    expect(decodeFix({ x: 200, y: 2, a: 3, t: 4 })).toBeNull();
    expect(decodeFix({ x: 1, y: 2, a: -1, t: 4 })).toBeNull();
  });
});

describe("when live sharing is not configured", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("says so", () => {
    expect(isLiveConfigured()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    expect(isLiveConfigured()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(isLiveConfigured()).toBe(true);
  });

  it("startLiveShare rejects with a clear error", async () => {
    await expect(startLiveShare({ encodedDoc: "abc", origin: "https://docent.test" })).rejects.toThrow(
      /not switched on/,
    );
  });

  it("watchLive reports unavailable", async () => {
    const statuses: LiveStatus[] = [];
    const off = await watchLive(newLiveId(), () => {}, (s) => statuses.push(s));
    expect(statuses).toEqual(["unavailable"]);
    expect(typeof off).toBe("function");
    off();
  });
});

describe("watchUrl", () => {
  afterEach(() => setLiveClientFactory(null));

  it("points at the watch page with the route and the name", async () => {
    setLiveClientFactory(async () => ({
      channel: () => {
        const ch = {
          on: () => ch,
          subscribe: () => ch,
          send: async () => "ok",
          track: async () => "ok",
          presenceState: () => ({}),
        };
        return ch;
      },
      removeChannel: async () => "ok",
    }));
    const share = await startLiveShare({ encodedDoc: "eJzLSM3JyQcABiwCFQ", origin: "https://docent.test/", name: " Wanjiru K " });
    expect(share.watchUrl).toBe(`https://docent.test/live/${share.id}?d=eJzLSM3JyQcABiwCFQ&n=Wanjiru%20K`);
    expect(isValidLiveId(share.id)).toBe(true);
    const plain = await startLiveShare({ encodedDoc: "abc", origin: "https://docent.test" });
    expect(plain.watchUrl).toBe(`https://docent.test/live/${plain.id}?d=abc`);
    expect(plain.id).not.toBe(share.id);
    await share.stop();
    await plain.stop();
  });
});
