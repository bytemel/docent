"use client";

import { useEffect, useRef, useState } from "react";
import { Broadcast, Compass, Crosshair, FlagCheckered, NavigationArrow, X } from "@phosphor-icons/react";
import VoiceToggle from "@/components/ui/VoiceToggle";
import { bearing, formatDistance, formatDuration, haversine } from "@/lib/geo";
import { isLiveConfigured, type LiveFix, type LiveShare } from "@/lib/live";
import { createLiveFilter, snapToRoute } from "@/lib/liveFilter";
import {
  ACTIVITIES,
  createAnnouncer,
  formatPace,
  navProgress,
  rerouteDue,
  startAnnouncement,
  type Activity,
  type NavState,
} from "@/lib/nav";
import type { LngLat, RouteDoc } from "@/lib/types";
import { getVoice } from "@/lib/voice";
import { NAV, SAY } from "@/strings/nav";
import type { Follow, NavMap } from "./navMap";
import { planTrip, type Dest, type Trip } from "./plan";
import ShareSheet from "./ShareSheet";
import Sign from "./Sign";

type Pad = { top: number; bottom: number; left: number; right: number };

interface Props {
  trip: Trip;
  activity: Activity;
  dest: Dest | null;
  doc: RouteDoc | null;
  firstFix: GeolocationPosition;
  map: NavMap;
  setPadding: (f: () => Pad) => void;
  onEnd: () => void;
}

const ZOOM: Record<Activity, number> = { walk: 17.5, run: 17, cycle: 16.5, drive: 16 };
const LOST_MS = 20000;

function toFix(p: GeolocationPosition): LiveFix {
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

function clock(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function speak(text: string | null | undefined, interrupt = false) {
  if (text && document.visibilityState === "visible") getVoice().speak(text, { interrupt });
}

export default function NavScreen({ trip, activity, dest, doc, firstFix, map, setPadding, onEnd }: Props) {
  const [view, setView] = useState<NavState>(() => navProgress(trip.route, { atM: 0, offRouteM: 0 }, activity, 0));
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [lastFixAt, setLastFixAt] = useState(() => Date.now());
  const [weak, setWeak] = useState(false);
  const [denied, setDenied] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [follow, setFollow] = useState<Follow>("heading");
  const [shareOpen, setShareOpen] = useState(false);
  const [share, setShare] = useState<LiveShare | null>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const shareRef = useRef<LiveShare | null>(null);
  const repeatRef = useRef<() => void>(() => {});
  const docRef = useRef(trip.doc);
  const [liveOn] = useState(isLiveConfigured);

  useEffect(() => {
    setPadding(() => {
      if (window.innerWidth >= 768) return { top: 48, bottom: 48, left: 448, right: 48 };
      const top = (plateRef.current?.getBoundingClientRect().bottom ?? 140) + 12;
      const bottom = (barRef.current?.offsetHeight ?? 140) + 12;
      return { top, bottom, left: 24, right: 24 };
    });
  }, [setPadding]);

  useEffect(() => {
    shareRef.current = share;
  }, [share]);

  useEffect(() => {
    const s = {
      trip,
      filter: createLiveFilter(),
      announcer: createAnnouncer(trip.route, activity),
      lastPos: null as LngLat | null,
      heading: null as number | null,
      offSince: null as number | null,
      lastReroute: 0,
      joined: trip.joinM === null,
      atM: 0,
      arrived: false,
      busy: false,
      stopped: false,
    };
    const info = ACTIVITIES[activity];
    map.setRoute(trip.route);
    map.setDest(null);
    map.setFollow("heading");
    map.setUserMove(() => {
      map.setFollow("off");
      setFollow("off");
    });
    repeatRef.current = () => getVoice().speak(s.announcer.current(s.atM), { interrupt: true });

    const reroute = (here: LngLat, doneM: number) => {
      s.busy = true;
      s.lastReroute = Date.now();
      setRerouting(true);
      speak(SAY.rerouting, true);
      planTrip({ here, activity, dest, doc, joined: s.joined, baseM: doneM })
        .then((t) => {
          if (s.stopped) return;
          s.trip = t;
          s.joined = s.joined || t.joinM === null;
          s.announcer = createAnnouncer(t.route, activity);
          docRef.current = t.doc;
          map.setRoute(t.route);
          speak(startAnnouncement(t.route, activity));
        })
        .catch(() => {})
        .finally(() => {
          s.busy = false;
          s.offSince = null;
          setRerouting(false);
        });
    };

    const onFix = (raw: LiveFix, first = false) => {
      if (s.stopped) return;
      shareRef.current?.send(raw);
      setLastFixAt(Date.now());
      const f = s.filter.push(raw);
      if (!f) return;
      setWeak(f.acc > 60);
      const route = s.trip.route;
      const snap = snapToRoute(f, route.coords, route.cum);
      const pos: LngLat = snap.snapped ? snap.pos : [f.lng, f.lat];
      if (raw.heading !== null && (raw.speed ?? 0) > 0.7) s.heading = raw.heading;
      else if (s.lastPos && haversine(s.lastPos, pos) > 6) s.heading = bearing(s.lastPos, pos);
      if (!s.lastPos || haversine(s.lastPos, pos) > 6) s.lastPos = pos;
      const st = navProgress(route, { atM: snap.atM, offRouteM: snap.offRouteM, acc: f.acc }, activity, (Date.now() - startedAt) / 1000);
      s.atM = snap.atM;
      if (!s.joined && s.trip.joinM !== null && snap.snapped && snap.atM >= s.trip.joinM - info.arriveM) s.joined = true;
      map.setMe(pos, f.acc, s.heading);
      map.track(pos, s.heading, ZOOM[activity]);
      if (first) {
        s.announcer = createAnnouncer(route, activity, snap.atM);
        speak(startAnnouncement(route, activity, snap.atM), true);
      } else if (!st.offRoute) {
        s.offSince = null;
        speak(s.announcer.update(snap.atM));
      } else if (!s.busy) {
        s.offSince ??= Date.now();
        if (rerouteDue(s.offSince, s.lastReroute, Date.now())) reroute([f.lng, f.lat], st.doneM);
      }
      const end = route.coords[route.coords.length - 1];
      const atEnd = end && haversine([f.lng, f.lat], end) <= info.arriveM + Math.min(f.acc, 20);
      if ((st.arrived || atEnd) && !s.arrived) {
        s.arrived = true;
        const last = route.maneuvers[route.maneuvers.length - 1];
        s.announcer.update(route.totalM);
        speak(last.now, true);
        map.setFollow("off");
        setArrived(true);
      }
      setView(st);
    };

    onFix(toFix(firstFix), true);
    const watch = navigator.geolocation.watchPosition(
      (p) => onFix(toFix(p)),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setDenied(true);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 },
    );

    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      navigator.wakeLock
        ?.request("screen")
        .then((l) => {
          if (s.stopped) l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    };
    acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        acquire();
        if (!s.arrived) speak(s.announcer.current(s.atM), true);
      } else {
        getVoice().cancel();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    const tick = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      s.stopped = true;
      navigator.geolocation.clearWatch(watch);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(tick);
      lock?.release().catch(() => {});
      map.setUserMove(null);
      getVoice().cancel();
    };
  }, [trip, activity, dest, doc, firstFix, map, startedAt]);

  const end = () => {
    shareRef.current?.stop().catch(() => {});
    onEnd();
  };

  const toggleFollow = () => {
    const next: Follow = follow === "heading" ? "north" : "heading";
    setFollow(next);
    map.setFollow(next);
  };

  const recentre = () => {
    setFollow("heading");
    map.setFollow("heading");
  };

  const elapsedS = (now - startedAt) / 1000;
  const info = ACTIVITIES[activity];
  const cur = view.current;
  const lost = now - lastFixAt > LOST_MS;
  const note = denied
    ? NAV.locDenied
    : rerouting
      ? NAV.rerouting
      : view.offRoute
        ? NAV.offRoute
        : lost
          ? NAV.locWaiting
          : weak
            ? NAV.locWeak
            : null;
  const etaParts = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).formatToParts(
    new Date(now + view.etaS * 1000),
  );
  const etaTime = etaParts
    .filter((p) => p.type !== "dayPeriod")
    .map((p) => p.value)
    .join("")
    .trim();
  const etaPeriod = etaParts.find((p) => p.type === "dayPeriod")?.value.toLowerCase() ?? "";
  const [leftNum, leftUnit] = formatDistance(view.leftM).split(" ");
  const stats = [
    { k: NAV.left, v: leftNum, u: leftUnit },
    { k: NAV.eta, v: etaTime, u: etaPeriod },
    { k: NAV.elapsed, v: clock(elapsedS), u: "" },
    ...(info.pace
      ? [{ k: NAV.pace, v: view.paceSPerKm ? formatPace(view.paceSPerKm) : "--", u: NAV.perKm }]
      : []),
  ];

  return (
    <>
      {!arrived ? (
        <div
          ref={plateRef}
          className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 md:inset-x-auto md:left-4 md:w-[400px]"
        >
          <Sign
            arrow={cur.arrow}
            distanceM={cur.kind === "arrive" && view.toNextM < info.arriveM ? null : view.toNextM}
            text={cur.text}
            next={view.next?.text}
            note={note}
            onRepeat={() => repeatRef.current()}
          />
        </div>
      ) : null}
      <section
        ref={barRef}
        aria-label={NAV.pageTitle}
        className="panel absolute inset-x-0 bottom-0 z-10 rounded-b-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-4 md:left-4 md:w-[400px] md:rounded-b-[18px]"
      >
        {follow === "off" && !arrived ? (
          <button
            type="button"
            onClick={recentre}
            className="btn btn-sign btn-lg absolute -top-[68px] right-3 shadow-float md:right-0"
          >
            <Crosshair size={20} weight="bold" aria-hidden />
            {NAV.recentre}
          </button>
        ) : null}
        {arrived ? (
          <div>
            <div className="flex items-center gap-4">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-[14px] bg-accent text-accent-ink">
                <FlagCheckered size={40} weight="bold" aria-hidden />
              </span>
              <div>
                <h2 className="text-[28px] leading-none font-extrabold tracking-[-0.02em]">{NAV.arrivedTitle}</h2>
                <p className="mt-2 text-[17px] font-medium text-ink-2">
                  {NAV.arrivedBody(formatDistance(view.doneM), formatDuration(elapsedS))}
                </p>
              </div>
            </div>
            {doc?.arrival.note ? <p className="mt-4 text-[17px] leading-snug font-medium">{doc.arrival.note}</p> : null}
            <button type="button" className="btn btn-primary btn-lg mt-5 w-full" onClick={end}>
              {NAV.done}
            </button>
          </div>
        ) : (
          <>
            <dl className={`grid gap-2 ${stats.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
              {stats.map((x) => (
                <div key={x.k} className="min-w-0">
                  <dt className="text-[13px] font-semibold text-ink-3">{x.k}</dt>
                  <dd className="num truncate text-[20px] leading-tight font-bold">
                    {x.v}
                    {x.u ? <span className="ml-0.5 text-[13px] font-semibold text-ink-2">{x.u}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-center gap-2">
              <VoiceToggle />
              <button
                type="button"
                className="btn btn-icon"
                onClick={toggleFollow}
                aria-label={follow === "north" ? NAV.headingUp : NAV.northUp}
                title={follow === "north" ? NAV.headingUp : NAV.northUp}
              >
                {follow === "north" ? (
                  <NavigationArrow size={20} weight="bold" aria-hidden />
                ) : (
                  <Compass size={20} weight="bold" aria-hidden />
                )}
              </button>
              {liveOn ? (
                <button
                  type="button"
                  className={`btn ${share ? "btn-primary" : ""}`}
                  onClick={() => setShareOpen(true)}
                  aria-label={share ? NAV.sharing : NAV.shareLive}
                >
                  <Broadcast size={20} weight="bold" aria-hidden />
                  <span className="hidden min-[400px]:inline">{share ? NAV.sharing : NAV.shareLive}</span>
                </button>
              ) : null}
              <button type="button" className="btn btn-sign ml-auto px-4" onClick={end}>
                <X size={18} weight="bold" aria-hidden />
                {NAV.end}
              </button>
            </div>
          </>
        )}
      </section>
      {shareOpen ? (
        <ShareSheet
          share={share}
          getDoc={() => docRef.current}
          onShare={setShare}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </>
  );
}
