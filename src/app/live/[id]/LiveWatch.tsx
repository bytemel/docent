"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Crosshair, LinkSimple, ShieldCheck } from "@phosphor-icons/react";
import { formatDistance, formatDuration } from "@/lib/geo";
import { watchLive, type LiveFix, type LiveStatus } from "@/lib/live";
import { createLiveFilter, FILTER, progressAlong, snapToRoute } from "@/lib/liveFilter";
import { prefersDark } from "@/lib/map";
import { buildTimeline } from "@/lib/timeline";
import type { LngLat, RouteDoc } from "@/lib/types";
import { brand } from "@/strings/common";
import { LIVE_COPY } from "@/strings/live";
import { Mark } from "../../r/mark";
import type { FakeMode } from "./fake";
import type { LiveMap, TrailPoint } from "./liveMap";

export interface LiveWatchProps {
  id: string;
  doc: RouteDoc;
  name: string;
  fake: FakeMode | null;
}

interface View {
  pos: LngLat;
  atM: number;
  offRouteM: number;
  snapped: boolean;
  acc: number;
  heading: number | null;
  seenAt: number;
}

const ARRIVED_M = 30;
const OFF_ROUTE_NOTE_M = 40;

function ago(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return LIVE_COPY.justNow;
  if (min < 60) return LIVE_COPY.minutesAgo(min);
  return LIVE_COPY.hoursAgo(Math.floor(min / 60));
}

function statusLine(status: LiveStatus, view: View | null, now: number, who: string): { text: string; on: boolean } {
  if (status === "stopped") return { text: view ? LIVE_COPY.stoppedAt(ago(now - view.seenAt)) : LIVE_COPY.stopped, on: false };
  if (status === "live") return { text: view ? LIVE_COPY.live : LIVE_COPY.waitingFirst(who), on: true };
  if (status === "unavailable") return { text: LIVE_COPY.off, on: false };
  if (view) return { text: LIVE_COPY.lastSeen(ago(now - view.seenAt)), on: false };
  return { text: status === "offline" ? LIVE_COPY.reconnecting : LIVE_COPY.waiting(who), on: false };
}

export default function LiveWatch({ id, doc, name, fake }: LiveWatchProps) {
  const who = name || LIVE_COPY.guestFallback;
  const tl = useMemo(() => buildTimeline(doc), [doc]);
  const legs = useMemo(
    () => tl.legModes.map((mode, i) => ({ mode, startM: tl.legStartM[i], endM: tl.legEndM[i] })),
    [tl],
  );
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [view, setView] = useState<View | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [follow, setFollow] = useState(true);
  const [mapState, setMapState] = useState<"loading" | "ready" | "failed">("loading");
  const [toast, setToast] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const liveMap = useRef<LiveMap | null>(null);
  const trail = useRef<TrailPoint[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    let cancelled = false;
    let map: LiveMap | null = null;
    const failTimer = setTimeout(() => setMapState((s) => (s === "ready" ? s : "failed")), 20000);
    import("./liveMap")
      .then((mod) => {
        if (cancelled) return;
        map = new mod.LiveMap({
          container: el,
          doc,
          tl,
          dark: prefersDark(),
          labels: { start: LIVE_COPY.start, destination: LIVE_COPY.destination, guest: LIVE_COPY.guestDot(who) },
          onFollowChange: setFollow,
          onReady: () => setMapState("ready"),
        });
        liveMap.current = map;
      })
      .catch(() => {
        if (!cancelled) setMapState("failed");
      });
    return () => {
      cancelled = true;
      clearTimeout(failTimer);
      map?.destroy();
      liveMap.current = null;
    };
  }, [doc, tl, who]);

  useEffect(() => {
    const filter = createLiveFilter();
    const onFix = (fix: LiveFix) => {
      const f = filter.push(fix);
      if (!f) return;
      const seenAt = Date.now();
      const snap = snapToRoute(f, tl.coords, tl.cum);
      trail.current = [...trail.current.filter((p) => seenAt - p.at <= FILTER.trailMs), { pos: snap.pos, at: seenAt }];
      const heading = f.heading !== null && (f.speed === null || f.speed > 0.5) ? f.heading : null;
      setView({ pos: snap.pos, atM: snap.atM, offRouteM: snap.offRouteM, snapped: snap.snapped, acc: f.acc, heading, seenAt });
      setNow(seenAt);
    };
    let cancelled = false;
    let off: (() => void) | null = null;
    const started =
      process.env.NODE_ENV !== "production" && fake
        ? import("./fake").then((m) => m.startFakeFeed(fake, tl.coords, tl.cum, onFix, setStatus))
        : watchLive(id, onFix, setStatus);
    started.then((stop) => {
      if (cancelled) stop();
      else off = stop;
    });
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      cancelled = true;
      clearInterval(tick);
      off?.();
    };
  }, [id, fake, tl]);

  useEffect(() => {
    if (!view || mapState !== "ready") return;
    liveMap.current?.setGuest({
      pos: view.pos,
      acc: view.acc,
      heading: view.heading,
      live: status === "live",
      trail: trail.current,
      now: Date.now(),
    });
  }, [view, status, mapState]);

  const line = statusLine(status, view, now, who);
  const progress = view ? progressAlong(view.atM, legs) : null;
  const arrived = !!progress && !!view && view.snapped && progress.leftM <= ARRIVED_M;
  const offRoute = !!view && !view.snapped && view.offRouteM > OFF_ROUTE_NOTE_M;

  const flash = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flash(LIVE_COPY.copied);
    } catch {
      flash(LIVE_COPY.copyFailed);
    }
  };

  const toggleFollow = () => {
    const next = !follow;
    setFollow(next);
    liveMap.current?.setFollow(next);
  };

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-surface-2">
      <div className="absolute inset-0">
        <div ref={mapRef} className="h-full w-full" />
      </div>
      {mapState !== "ready" && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center px-6">
          <p className="panel px-4 py-2 text-sm text-ink-2" role="status">
            {mapState === "failed" ? LIVE_COPY.mapFailed : LIVE_COPY.loadingMap}
          </p>
        </div>
      )}
      <section
        className="panel absolute inset-x-3 bottom-3 z-10 max-h-[62dvh] overflow-y-auto p-4 sm:inset-x-auto sm:top-4 sm:bottom-auto sm:left-4 sm:w-[372px] sm:p-5"
        aria-label={LIVE_COPY.eyebrow}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{LIVE_COPY.eyebrow}</p>
          <Link href="/" aria-label={brand.name} className="rounded-md">
            <Mark className="size-6" />
          </Link>
        </div>
        <h1 className="mt-1 text-lg leading-snug font-semibold text-balance">{doc.title.trim() || LIVE_COPY.untitled}</h1>
        <p role="status" aria-live="polite" className="mt-3 flex items-center gap-2 text-sm font-medium text-ink">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            {line.on && <span className="absolute inset-0 rounded-full bg-ok opacity-60 motion-safe:animate-ping" />}
            <span className={`relative h-2.5 w-2.5 rounded-full ${line.on ? "bg-ok" : "bg-ink-3"}`} />
          </span>
          {line.text}
        </p>
        {progress && (
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-2 px-3 py-2">
              <dt className="text-xs text-ink-3">{LIVE_COPY.left}</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatDistance(progress.leftM)}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 px-3 py-2">
              <dt className="text-xs text-ink-3">{LIVE_COPY.timeLeft}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {arrived ? LIVE_COPY.here : LIVE_COPY.about(formatDuration(progress.etaS))}
              </dd>
            </div>
          </dl>
        )}
        {arrived && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-2">
            <Check size={16} weight="bold" className="text-ok" aria-hidden="true" />
            {LIVE_COPY.arrived(who)}
          </p>
        )}
        {offRoute && view && <p className="mt-3 text-sm text-ink-2">{LIVE_COPY.offRoute(formatDistance(view.offRouteM))}</p>}
        {view && status === "live" && (
          <p className="mt-2 text-xs text-ink-3">{LIVE_COPY.updated(ago(now - view.seenAt))}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="chip" aria-pressed={follow} onClick={toggleFollow}>
            <Crosshair size={16} weight="bold" aria-hidden="true" />
            {LIVE_COPY.follow}
          </button>
          <button type="button" className="chip" onClick={copy}>
            <LinkSimple size={16} weight="bold" aria-hidden="true" />
            {LIVE_COPY.copyLink}
          </button>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-3">
          <ShieldCheck size={16} className="mt-px shrink-0" aria-hidden="true" />
          {LIVE_COPY.privacy}
        </p>
      </section>
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4 sm:top-6">
          <p className="panel px-4 py-2 text-sm font-medium" role="status">
            {toast}
          </p>
        </div>
      )}
    </div>
  );
}
