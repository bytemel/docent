"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Crosshair,
  FlagCheckered,
  Hourglass,
  LinkSimple,
  NavigationArrow,
  Pause,
  ShieldCheck,
  WifiSlash,
} from "@phosphor-icons/react";
import { formatDistance } from "@/lib/geo";
import { watchLive, type LiveFix, type LiveStatus } from "@/lib/live";
import { isNativeApp, share } from "@/lib/native";
import { createLiveFilter, FILTER, progressAlong, snapToRoute } from "@/lib/liveFilter";
import { prefersDark } from "@/lib/map";
import { buildTimeline } from "@/lib/timeline";
import type { LngLat, RouteDoc } from "@/lib/types";
import { brand } from "@/strings/common";
import { LIVE_COPY } from "@/strings/live";
import { Mark } from "../../r/mark";
import type { FakeMode } from "./fake";
import { useCreditOffset } from "@/components/nav/useCreditOffset";
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
  const panelRef = useRef<HTMLElement>(null);
  const creditTarget = useMemo(() => ({ setCreditOffset: (px: number) => liveMap.current?.setCreditOffset(px) }), []);
  useCreditOffset(mapState === "ready" ? creditTarget : null, panelRef, undefined, Boolean(view));
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
    if (isNativeApp() && (await share({ title: doc.title.trim() || LIVE_COPY.untitled, url: window.location.href }))) return;
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

  const [leftNum, leftUnit] = progress ? formatDistance(progress.leftM).split(" ") : ["", ""];
  const eta = progress
    ? new Date(now + progress.etaS * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
  const PlateIcon = arrived ? FlagCheckered : line.on ? NavigationArrow : status === "stopped" ? Pause : view ? WifiSlash : Hourglass;
  const stats = progress
    ? [
        { k: LIVE_COPY.left, v: leftNum, u: leftUnit },
        { k: LIVE_COPY.etaShort, v: arrived ? LIVE_COPY.here : eta, u: "" },
        { k: LIVE_COPY.seen, v: view ? ago(now - view.seenAt) : "", u: "" },
      ]
    : [];

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-surface-2">
      <div className="absolute inset-0">
        <div ref={mapRef} className="h-full w-full" />
      </div>
      {mapState !== "ready" && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex justify-center px-6">
          <p className="panel px-4 py-2 text-sm text-ink-2" role="status">
            {mapState === "failed" ? LIVE_COPY.mapFailed : LIVE_COPY.loadingMap}
          </p>
        </div>
      )}
      <div className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 md:inset-x-auto md:left-4 md:w-[400px]">
        <div className="sign flex items-center gap-4 p-4 shadow-float" role="status" aria-live="polite">
          <span
            className={`flex size-20 shrink-0 items-center justify-center rounded-[14px] ${line.on || arrived ? "bg-accent text-accent-ink" : "border-2 border-current opacity-80"}`}
            aria-hidden
          >
            <PlateIcon size={48} weight="bold" />
          </span>
          <span className="min-w-0 flex-1">
            {progress && !arrived ? (
              <span className="num block text-[38px] leading-none font-bold">
                {leftNum}
                <span className="ml-1 text-[0.55em]">{leftUnit}</span>
              </span>
            ) : null}
            <span className="mt-1 block text-[20px] leading-tight font-bold text-balance">
              {arrived ? LIVE_COPY.arrived(who) : line.text}
            </span>
            {progress && !arrived && status !== "stopped" ? (
              <span className="mt-1.5 block text-[15px] font-medium opacity-75">{LIVE_COPY.arrivesAt(eta)}</span>
            ) : null}
          </span>
        </div>
      </div>
      <section
        ref={panelRef}
        className="panel absolute inset-x-0 bottom-0 z-10 rounded-b-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-4 md:left-4 md:w-[400px] md:rounded-b-[18px]"
        aria-label={LIVE_COPY.eyebrow}
      >
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-[17px] font-extrabold tracking-[-0.01em]">
            {doc.title.trim() || LIVE_COPY.untitled}
          </h1>
          <Link href="/" aria-label={brand.name} className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md">
            <Mark className="size-7" />
          </Link>
        </div>
        {stats.length ? (
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {stats.map((x) => (
              <div key={x.k} className="min-w-0">
                <dt className="text-[13px] font-semibold text-ink-3">{x.k}</dt>
                <dd className="truncate text-[18px] leading-tight font-bold">
                  <span className={x.u ? "num" : ""}>{x.v}</span>
                  {x.u ? <span className="ml-0.5 text-[13px] font-semibold text-ink-2">{x.u}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {offRoute && view ? (
          <p className="mt-3 text-[15px] font-medium text-ink-2">{LIVE_COPY.offRoute(formatDistance(view.offRouteM))}</p>
        ) : null}
        {arrived ? (
          <p className="mt-3 flex items-center gap-2 text-[15px] text-ink-2">
            <Check size={18} weight="bold" className="text-ok" aria-hidden />
            {LIVE_COPY.arrived(who)}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button type="button" className="chip flex-1" aria-pressed={follow} onClick={toggleFollow}>
            <Crosshair size={18} weight="bold" aria-hidden />
            {LIVE_COPY.follow}
          </button>
          <button type="button" className="btn flex-1" onClick={copy}>
            <LinkSimple size={18} weight="bold" aria-hidden />
            {LIVE_COPY.copyLink}
          </button>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-pretty text-ink-3">
          <ShieldCheck size={16} className="mt-px shrink-0" aria-hidden />
          {LIVE_COPY.privacy}
        </p>
      </section>
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-20 flex justify-center px-4">
          <p className="panel px-4 py-2 text-sm font-semibold" role="status">
            {toast}
          </p>
        </div>
      )}
    </div>
  );
}
