import { haversine } from "./geo";

export interface LiveFix {
  lng: number;
  lat: number;
  acc: number;
  heading: number | null;
  speed: number | null;
  t: number;
}

export type LiveStatus = "connecting" | "live" | "stopped" | "offline" | "unavailable";

export interface LiveShare {
  id: string;
  watchUrl: string;
  send(fix: LiveFix): void;
  stop(): Promise<void>;
}

export interface StartLiveShareOptions {
  encodedDoc: string;
  origin: string;
  name?: string;
  onStatus?: (status: LiveStatus) => void;
}

type SubscribeState = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

export interface LiveChannel {
  on(type: "broadcast", filter: { event: string }, cb: (msg: { payload?: unknown }) => void): LiveChannel;
  on(type: "presence", filter: { event: "sync" }, cb: () => void): LiveChannel;
  subscribe(cb: (status: SubscribeState, err?: Error) => void): LiveChannel;
  send(args: { type: "broadcast"; event: string; payload: unknown }): Promise<unknown>;
  track(payload: Record<string, unknown>): Promise<unknown>;
  presenceState(): Record<string, unknown[]>;
}

export interface LiveClient {
  channel(
    name: string,
    opts: { config: { broadcast: { self: boolean; ack: boolean }; presence: { key: string; enabled: boolean } } },
  ): LiveChannel;
  removeChannel(ch: LiveChannel): Promise<unknown>;
}

export type LiveClientFactory = () => Promise<LiveClient>;

export const LIVE = {
  minIntervalMs: 3000,
  moveM: 20,
  heartbeatMs: 15000,
  silentMs: 40000,
  reconnectMs: [2000, 5000, 10000, 20000, 30000],
  idBytes: 18,
  nameMax: 40,
} as const;

const ID_RE = /^[A-Za-z0-9_-]{22,64}$/;

let injected: LiveClientFactory | null = null;
let clientPromise: Promise<LiveClient> | null = null;

export function setLiveClientFactory(factory: LiveClientFactory | null): void {
  injected = factory;
  clientPromise = null;
}

export function isLiveConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function canConnect(): boolean {
  return injected !== null || isLiveConfigured();
}

async function supabaseClient(): Promise<LiveClient> {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client as unknown as LiveClient;
}

function getClient(): Promise<LiveClient> {
  if (!clientPromise) {
    const p = (injected ?? supabaseClient)();
    clientPromise = p;
    p.catch(() => {
      if (clientPromise === p) clientPromise = null;
    });
  }
  return clientPromise;
}

export function newLiveId(): string {
  const bytes = new Uint8Array(LIVE.idBytes);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isValidLiveId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

export function cleanName(name: unknown): string {
  if (typeof name !== "string") return "";
  let out = "";
  for (const ch of name) {
    const c = ch.codePointAt(0) ?? 0;
    out += c < 32 || c === 127 ? " " : ch;
  }
  return Array.from(out.replace(/\s+/g, " ").trim()).slice(0, LIVE.nameMax).join("").trim();
}

export function liveWatchUrl(origin: string, id: string, encodedDoc: string, name?: string): string {
  const n = cleanName(name);
  return `${origin.replace(/\/+$/, "")}/live/${id}?d=${encodedDoc}${n ? `&n=${encodeURIComponent(n)}` : ""}`;
}

export function encodeFix(fix: LiveFix): Record<string, number> {
  const out: Record<string, number> = {
    x: Math.round(fix.lng * 1e6) / 1e6,
    y: Math.round(fix.lat * 1e6) / 1e6,
    a: Math.round(fix.acc),
    t: Math.round(fix.t),
  };
  if (fix.heading !== null && Number.isFinite(fix.heading)) out.h = Math.round(fix.heading);
  if (fix.speed !== null && Number.isFinite(fix.speed)) out.s = Math.round(fix.speed * 10) / 10;
  return out;
}

export function decodeFix(payload: unknown): LiveFix | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const lng = num(p.x);
  const lat = num(p.y);
  const acc = num(p.a);
  const t = num(p.t);
  if (lng === null || lat === null || acc === null || t === null) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90 || acc < 0 || t <= 0) return null;
  const h = num(p.h);
  const s = num(p.s);
  return {
    lng,
    lat,
    acc,
    heading: h === null ? null : ((h % 360) + 360) % 360,
    speed: s === null || s < 0 ? null : s,
    t,
  };
}

interface Connection {
  channel: LiveChannel | null;
  joined: boolean;
  closed: boolean;
  attempt: number;
  retry: ReturnType<typeof setTimeout> | null;
}

function connect(
  client: LiveClient,
  id: string,
  presenceKey: string,
  setup: (ch: LiveChannel) => void,
  onJoin: (ch: LiveChannel) => void,
  onDrop: () => void,
): Connection {
  const conn: Connection = { channel: null, joined: false, closed: false, attempt: 0, retry: null };
  const open = () => {
    if (conn.closed) return;
    const ch = client.channel(`live:${id}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: presenceKey, enabled: true } },
    });
    conn.channel = ch;
    setup(ch);
    ch.subscribe((state) => {
      if (conn.closed || conn.channel !== ch) return;
      if (state === "SUBSCRIBED") {
        conn.joined = true;
        conn.attempt = 0;
        if (conn.retry) clearTimeout(conn.retry);
        conn.retry = null;
        onJoin(ch);
        return;
      }
      conn.joined = false;
      onDrop();
      if (conn.retry) return;
      const wait = LIVE.reconnectMs[Math.min(conn.attempt, LIVE.reconnectMs.length - 1)];
      conn.attempt++;
      conn.retry = setTimeout(() => {
        conn.retry = null;
        if (conn.closed || conn.joined) return;
        void client.removeChannel(ch).catch(() => {});
        open();
      }, wait);
    });
  };
  open();
  return conn;
}

async function close(client: LiveClient, conn: Connection): Promise<void> {
  conn.closed = true;
  conn.joined = false;
  if (conn.retry) clearTimeout(conn.retry);
  conn.retry = null;
  const ch = conn.channel;
  conn.channel = null;
  if (ch) await client.removeChannel(ch).catch(() => {});
}

function emit(ch: LiveChannel, event: string, payload: unknown): void {
  void ch.send({ type: "broadcast", event, payload }).catch(() => {});
}

export async function startLiveShare(opts: StartLiveShareOptions): Promise<LiveShare> {
  if (!canConnect()) throw new Error("Live sharing is not switched on for this site.");
  const client = await getClient();
  const id = newLiveId();
  let status: LiveStatus | null = null;
  const report = (s: LiveStatus) => {
    if (s === status) return;
    status = s;
    opts.onStatus?.(s);
  };

  let pending: LiveFix | null = null;
  let lastSent: LiveFix | null = null;
  let lastSentAt = 0;
  let lastT = -Infinity;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const flush = () => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    if (stopped || !pending || !conn.joined || !conn.channel) return;
    emit(conn.channel, "fix", encodeFix(pending));
    lastSent = pending;
    lastSentAt = Date.now();
    pending = null;
  };

  const schedule = () => {
    if (!pending || stopped || !conn.joined) return;
    const since = Date.now() - lastSentAt;
    const moved = lastSent ? haversine([lastSent.lng, lastSent.lat], [pending.lng, pending.lat]) : Infinity;
    if (since >= LIVE.minIntervalMs || moved > LIVE.moveM) flush();
    else if (!flushTimer) flushTimer = setTimeout(flush, LIVE.minIntervalMs - since);
  };

  report("connecting");
  const conn = connect(
    client,
    id,
    "guest",
    () => {},
    (ch) => {
      report("live");
      void ch.track({ role: "guest", t: Date.now() }).catch(() => {});
      schedule();
    },
    () => {
      if (!stopped) report("offline");
    },
  );

  const beat = setInterval(() => {
    if (stopped || !conn.joined || !conn.channel) return;
    if (Date.now() - lastSentAt >= LIVE.heartbeatMs - 500) emit(conn.channel, "hb", { t: Date.now() });
  }, LIVE.heartbeatMs);

  return {
    id,
    watchUrl: liveWatchUrl(opts.origin, id, opts.encodedDoc, opts.name),
    send(fix: LiveFix) {
      if (stopped || !Number.isFinite(fix.lng) || !Number.isFinite(fix.lat) || !Number.isFinite(fix.t)) return;
      if (fix.t <= lastT) return;
      lastT = fix.t;
      pending = fix;
      schedule();
    },
    async stop() {
      if (stopped) return;
      if (conn.joined && conn.channel) {
        if (pending) {
          emit(conn.channel, "fix", encodeFix(pending));
          pending = null;
        }
        emit(conn.channel, "stop", { t: Date.now() });
      }
      stopped = true;
      pending = null;
      if (flushTimer) clearTimeout(flushTimer);
      clearInterval(beat);
      await close(client, conn);
      report("stopped");
    },
  };
}

export async function watchLive(
  id: string,
  onFix: (fix: LiveFix) => void,
  onStatus: (status: LiveStatus) => void,
): Promise<() => void> {
  if (!canConnect() || !isValidLiveId(id)) {
    onStatus("unavailable");
    return () => {};
  }
  let status: LiveStatus | null = null;
  const report = (s: LiveStatus) => {
    if (s === status) return;
    status = s;
    onStatus(s);
  };
  report("connecting");
  let client: LiveClient;
  try {
    client = await getClient();
  } catch {
    report("offline");
    return () => {};
  }

  let lastHeard = 0;
  let lastT = -Infinity;
  let guestPresent = false;
  let heardAny = false;

  const heard = () => {
    lastHeard = Date.now();
    heardAny = true;
    report("live");
  };

  const conn = connect(
    client,
    id,
    `host-${newLiveId().slice(0, 8)}`,
    (ch) => {
      ch.on("broadcast", { event: "fix" }, ({ payload }) => {
        const fix = decodeFix(payload);
        if (!fix || fix.t <= lastT) return;
        lastT = fix.t;
        heard();
        onFix(fix);
      });
      ch.on("broadcast", { event: "hb" }, () => heard());
      ch.on("broadcast", { event: "stop" }, () => {
        guestPresent = false;
        report("stopped");
      });
      ch.on("presence", { event: "sync" }, () => {
        const guests = ch.presenceState().guest;
        guestPresent = Array.isArray(guests) && guests.length > 0;
        if (guestPresent && status !== "stopped") heard();
      });
    },
    () => {
      if (status === "stopped") return;
      if (heardAny && Date.now() - lastHeard < LIVE.silentMs) report("live");
      else report(heardAny ? "offline" : "connecting");
    },
    () => {
      if (status !== "stopped") report(heardAny ? "offline" : "connecting");
    },
  );

  const watchdog = setInterval(() => {
    if (status === "live" && !guestPresent && Date.now() - lastHeard > LIVE.silentMs) report("offline");
  }, 5000);

  return () => {
    clearInterval(watchdog);
    void close(client, conn);
  };
}
