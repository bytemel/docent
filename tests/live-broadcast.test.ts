import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIVE,
  setLiveClientFactory,
  startLiveShare,
  watchLive,
  type LiveChannel,
  type LiveClient,
  type LiveFix,
  type LiveStatus,
} from "@/lib/live";

type State = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

class FakeChannel implements LiveChannel {
  handlers: { type: string; event: string; cb: (msg: { payload?: unknown }) => void }[] = [];
  sent: { event: string; payload: unknown }[] = [];
  tracked: Record<string, unknown>[] = [];
  status: ((s: State) => void) | null = null;
  removed = false;
  constructor(
    public bus: FakeBus,
    public name: string,
    public key: string,
  ) {}
  on(type: string, filter: { event: string }, cb: (msg: { payload?: unknown }) => void): LiveChannel {
    this.handlers.push({ type, event: filter.event, cb });
    return this;
  }
  subscribe(cb: (s: State) => void): LiveChannel {
    this.status = cb;
    return this;
  }
  fire(s: State) {
    this.status?.(s);
  }
  async send(args: { type: "broadcast"; event: string; payload: unknown }) {
    this.sent.push({ event: args.event, payload: args.payload });
    this.bus.deliver(this, args.event, args.payload);
    return "ok";
  }
  async track(payload: Record<string, unknown>) {
    this.tracked.push(payload);
    this.bus.syncPresence(this.name);
    return "ok";
  }
  presenceState() {
    return this.bus.presence(this.name);
  }
}

class FakeBus implements LiveClient {
  channels: FakeChannel[] = [];
  channel(name: string, opts: { config: { presence: { key: string } } }) {
    const ch = new FakeChannel(this, name, opts.config.presence.key);
    this.channels.push(ch);
    return ch;
  }
  async removeChannel(ch: LiveChannel) {
    (ch as FakeChannel).removed = true;
    this.syncPresence((ch as FakeChannel).name);
    return "ok";
  }
  live(name: string) {
    return this.channels.filter((c) => c.name === name && !c.removed);
  }
  deliver(from: FakeChannel, event: string, payload: unknown) {
    if (from.removed) return;
    for (const c of this.live(from.name)) {
      if (c === from) continue;
      for (const h of c.handlers) if (h.type === "broadcast" && h.event === event) h.cb({ payload });
    }
  }
  presence(name: string) {
    const out: Record<string, unknown[]> = {};
    for (const c of this.live(name)) if (c.tracked.length) (out[c.key] ??= []).push(c.tracked[c.tracked.length - 1]);
    return out;
  }
  syncPresence(name: string) {
    for (const c of this.live(name)) for (const h of c.handlers) if (h.type === "presence") h.cb({});
  }
}

const at = (x: number, t: number, extra: Partial<LiveFix> = {}): LiveFix => ({
  lng: 36.8 + x / 111320,
  lat: -1.28,
  acc: 8,
  heading: 90,
  speed: 1.2,
  t,
  ...extra,
});

let bus: FakeBus;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_800_000_000_000);
  bus = new FakeBus();
  setLiveClientFactory(async () => bus);
});

afterEach(() => {
  setLiveClientFactory(null);
  vi.useRealTimers();
});

async function share(statuses: LiveStatus[] = []) {
  const s = await startLiveShare({ encodedDoc: "abc", origin: "https://docent.test", onStatus: (x) => statuses.push(x) });
  const ch = bus.channels[bus.channels.length - 1];
  return { s, ch, statuses };
}

const fixes = (ch: FakeChannel) => ch.sent.filter((m) => m.event === "fix").map((m) => m.payload as { x: number; t: number });

describe("sending", () => {
  it("uses a live:<id> channel and reports connecting then live", async () => {
    const { s, ch, statuses } = await share();
    expect(ch.name).toBe(`live:${s.id}`);
    expect(statuses).toEqual(["connecting"]);
    ch.fire("SUBSCRIBED");
    expect(statuses).toEqual(["connecting", "live"]);
    expect(ch.tracked[0]).toMatchObject({ role: "guest" });
  });

  it("sends at most once every 3 s and always the latest fix", async () => {
    const { s, ch } = await share();
    ch.fire("SUBSCRIBED");
    s.send(at(0, Date.now()));
    expect(fixes(ch)).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    s.send(at(3, Date.now()));
    vi.advanceTimersByTime(500);
    s.send(at(6, Date.now()));
    expect(fixes(ch)).toHaveLength(1);
    vi.advanceTimersByTime(1499);
    expect(fixes(ch)).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(fixes(ch)).toHaveLength(2);
    expect(fixes(ch)[1].t).toBe(1_800_000_001_500);
    vi.advanceTimersByTime(10_000);
    expect(fixes(ch)).toHaveLength(2);
  });

  it("sends at once after moving more than 20 m", async () => {
    const { s, ch } = await share();
    ch.fire("SUBSCRIBED");
    s.send(at(0, Date.now()));
    vi.advanceTimersByTime(500);
    s.send(at(25, Date.now()));
    expect(fixes(ch)).toHaveLength(2);
  });

  it("drops stale fixes", async () => {
    const { s, ch } = await share();
    ch.fire("SUBSCRIBED");
    s.send(at(0, Date.now()));
    s.send(at(50, Date.now() - 5000));
    expect(fixes(ch)).toHaveLength(1);
  });

  it("holds the latest fix while offline and sends it on reconnect", async () => {
    const { s, ch, statuses } = await share();
    ch.fire("SUBSCRIBED");
    ch.fire("CHANNEL_ERROR");
    expect(statuses.at(-1)).toBe("offline");
    s.send(at(0, Date.now()));
    vi.advanceTimersByTime(100);
    s.send(at(5, Date.now()));
    expect(fixes(ch)).toHaveLength(0);
    ch.fire("SUBSCRIBED");
    expect(statuses.at(-1)).toBe("live");
    expect(fixes(ch)).toHaveLength(1);
    expect(fixes(ch)[0].t).toBe(1_800_000_000_100);
  });

  it("opens a fresh channel when the library does not rejoin", async () => {
    const { ch } = await share();
    ch.fire("SUBSCRIBED");
    ch.fire("CLOSED");
    vi.advanceTimersByTime(LIVE.reconnectMs[0]);
    expect(ch.removed).toBe(true);
    const next = bus.channels[bus.channels.length - 1];
    expect(next).not.toBe(ch);
    expect(next.name).toBe(ch.name);
  });

  it("sends a heartbeat every 15 s when still", async () => {
    const { ch } = await share();
    ch.fire("SUBSCRIBED");
    vi.advanceTimersByTime(LIVE.heartbeatMs);
    expect(ch.sent.filter((m) => m.event === "hb")).toHaveLength(1);
  });

  it("stop sends a stop event and leaves", async () => {
    const { s, ch, statuses } = await share();
    ch.fire("SUBSCRIBED");
    await s.stop();
    expect(ch.sent.at(-1)?.event).toBe("stop");
    expect(ch.removed).toBe(true);
    expect(statuses.at(-1)).toBe("stopped");
    s.send(at(0, Date.now()));
    expect(fixes(ch)).toHaveLength(0);
  });
});

describe("watching", () => {
  it("passes fixes through and tracks the guest status", async () => {
    const { s, ch } = await share();
    const got: LiveFix[] = [];
    const seen: LiveStatus[] = [];
    const off = await watchLive(s.id, (f) => got.push(f), (x) => seen.push(x));
    const host = bus.channels[bus.channels.length - 1];
    expect(host.key).toMatch(/^host-/);
    host.fire("SUBSCRIBED");
    expect(seen).toEqual(["connecting"]);
    ch.fire("SUBSCRIBED");
    expect(seen).toEqual(["connecting", "live"]);
    s.send(at(0, Date.now(), { heading: null }));
    expect(got).toHaveLength(1);
    expect(got[0].heading).toBeNull();
    expect(got[0].lng).toBeCloseTo(36.8, 6);
    await s.stop();
    expect(seen.at(-1)).toBe("stopped");
    off();
    expect(host.removed).toBe(true);
  });

  it("goes offline when the guest goes quiet, and live again when heard", async () => {
    const { s, ch } = await share();
    const seen: LiveStatus[] = [];
    await watchLive(s.id, () => {}, (x) => seen.push(x));
    const host = bus.channels[bus.channels.length - 1];
    host.fire("SUBSCRIBED");
    ch.fire("SUBSCRIBED");
    s.send(at(0, Date.now()));
    await bus.removeChannel(ch);
    vi.advanceTimersByTime(LIVE.silentMs + 5000);
    expect(seen.at(-1)).toBe("offline");
    ch.removed = false;
    await ch.track({ role: "guest" });
    expect(seen.at(-1)).toBe("live");
  });

  it("reports offline when its own connection drops", async () => {
    const seen: LiveStatus[] = [];
    const { s, ch } = await share();
    await watchLive(s.id, () => {}, (x) => seen.push(x));
    const host = bus.channels[bus.channels.length - 1];
    host.fire("SUBSCRIBED");
    ch.fire("SUBSCRIBED");
    host.fire("CHANNEL_ERROR");
    expect(seen.at(-1)).toBe("offline");
  });

  it("ignores bad and out of order payloads", async () => {
    const { s } = await share();
    const got: LiveFix[] = [];
    await watchLive(s.id, (f) => got.push(f), () => {});
    const host = bus.channels[bus.channels.length - 1];
    host.fire("SUBSCRIBED");
    const fire = (payload: unknown) =>
      host.handlers.filter((h) => h.event === "fix").forEach((h) => h.cb({ payload }));
    fire({ x: 36.8, y: -1.28, a: 5, t: 2000 });
    fire({ x: 36.8, y: -1.28, a: 5, t: 1000 });
    fire({ x: "bad" });
    expect(got.map((f) => f.t)).toEqual([2000]);
  });

  it("reports unavailable for a bad id", async () => {
    const seen: LiveStatus[] = [];
    await watchLive("short", () => {}, (x) => seen.push(x));
    expect(seen).toEqual(["unavailable"]);
  });
});
