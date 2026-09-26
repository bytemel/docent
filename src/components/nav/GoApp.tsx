"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Car,
  Check,
  MapPin,
  NavigationArrow,
  PersonSimpleBike,
  PersonSimpleRun,
  PersonSimpleWalk,
  type Icon,
} from "@phosphor-icons/react";
import PlaceSearch from "@/components/editor/PlaceSearch";
import VoiceToggle from "@/components/ui/VoiceToggle";
import { formatDistance, formatDuration, routeCoords } from "@/lib/geo";
import { prefersDark } from "@/lib/map";
import { MODES } from "@/lib/modes";
import {
  ACTIVITIES,
  ACTIVITY_ORDER,
  buildNavRoute,
  defaultOption,
  describeOptions,
  optionTag,
  tagPoint,
  type Activity,
} from "@/lib/nav";
import type { RouteOption } from "@/lib/routing";
import type { LngLat, RouteDoc } from "@/lib/types";
import { getVoice } from "@/lib/voice";
import { brand } from "@/strings/common";
import { ACTIVITY_LABEL, NAV } from "@/strings/nav";
import { Mark } from "@/app/r/mark";
import type { NavMap } from "./navMap";
import NavScreen from "./NavScreen";
import { fetchOptions, optionsTarget, planTrip, type Dest, type Trip } from "./plan";

export interface GoAppProps {
  to: Dest | null;
  doc: RouteDoc | null;
  badDoc: boolean;
}

const ACTIVITY_ICON: Record<Activity, Icon> = {
  walk: PersonSimpleWalk,
  run: PersonSimpleRun,
  cycle: PersonSimpleBike,
  drive: Car,
};

type Busy = null | "locating" | "routing";
type Pad = { top: number; bottom: number; left: number; right: number };

export default function GoApp({ to, doc, badDoc }: GoAppProps) {
  const [dest, setDest] = useState<Dest | null>(to);
  const [activity, setActivity] = useState<Activity>(doc && doc.segments[0]?.mode === "car" ? "drive" : "walk");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(badDoc ? NAV.badDoc : null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [firstFix, setFirstFix] = useState<GeolocationPosition | null>(null);
  const [map, setMap] = useState<NavMap | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const panelEl = useRef<HTMLElement>(null);
  const padRef = useRef<() => Pad>(() => ({ top: 40, bottom: 40, left: 40, right: 40 }));
  const canPick = useRef(!doc);
  const [center] = useState<LngLat | undefined>(() =>
    to ? [to.lng, to.lat] : doc ? routeCoords(doc.segments)[0] : undefined,
  );

  const [here, setHere] = useState<{ pos: LngLat; acc: number } | null>(null);
  const [locErr, setLocErr] = useState(false);
  const [optResult, setOptResult] = useState<{ key: string; options: RouteOption[]; failed: boolean } | null>(null);
  const [picked, setPicked] = useState<{ key: string; id: string } | null>(null);
  const locating = useRef(false);
  const fitted = useRef("");

  const wantOptions = Boolean(dest || doc) && !trip;
  useEffect(() => {
    if (!wantOptions || here || locating.current || !navigator.geolocation) return;
    locating.current = true;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        locating.current = false;
        setHere({ pos: [p.coords.longitude, p.coords.latitude], acc: p.coords.accuracy });
      },
      () => {
        locating.current = false;
        setLocErr(true);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    );
  }, [wantOptions, here]);

  const profile = ACTIVITIES[activity].profile;
  const target = useMemo(() => (here ? optionsTarget(dest, doc, here.pos) : null), [here, dest, doc]);
  const optKey =
    here && target
      ? `${target.lng.toFixed(5)},${target.lat.toFixed(5)}|${profile}|${here.pos[0].toFixed(4)},${here.pos[1].toFixed(4)}`
      : "";

  useEffect(() => {
    if (!optKey || !here || !target || trip) return;
    const ctrl = new AbortController();
    fetchOptions(here.pos, target, profile, ctrl.signal)
      .then((options) => setOptResult({ key: optKey, options, failed: false }))
      .catch(() => {
        if (!ctrl.signal.aborted) setOptResult({ key: optKey, options: [], failed: true });
      });
    return () => ctrl.abort();
  }, [optKey, here, target, profile, trip]);

  const current = optResult && optResult.key === optKey ? optResult : null;
  const options = useMemo(() => current?.options ?? [], [current]);
  const views = useMemo(() => describeOptions(options, activity), [options, activity]);
  const selKey = `${optKey}|${activity}`;
  const selectedId =
    picked && picked.key === selKey && options.some((o) => o.id === picked.id)
      ? picked.id
      : (defaultOption(options, activity)?.id ?? null);
  const selected = options.find((o) => o.id === selectedId) ?? null;

  useEffect(() => {
    if (map && here && !trip) map.setMe(here.pos, here.acc, null);
  }, [map, here, trip]);

  useEffect(() => {
    if (!map) return;
    if (trip || !options.length) {
      map.setOptions([], "", null);
      return;
    }
    map.setOptions(
      views.map((v) => {
        const o = options.find((x) => x.id === v.id)!;
        return {
          id: o.id,
          geometry: o.geometry,
          selected: o.id === selectedId,
          tag: optionTag(v),
          time: formatDuration(v.timeS),
          at: tagPoint(o, options.filter((x) => x !== o)),
        };
      }),
      MODES[ACTIVITIES[activity].mode].color,
      (id) => setPicked({ key: selKey, id }),
    );
    if (fitted.current !== optKey) {
      fitted.current = optKey;
      map.fitPoints([
        ...options.flatMap((o) => o.geometry),
        ...(here ? [here.pos] : []),
        ...(doc ? routeCoords(doc.segments) : []),
      ]);
    }
  }, [map, trip, options, views, selectedId, activity, selKey, optKey, here, doc]);

  const planPad = useCallback((): Pad => {
    const w = window.innerWidth;
    const h = panelEl.current?.offsetHeight ?? 0;
    if (w >= 768) return { top: 48, bottom: 48, left: 448, right: 48 };
    return { top: 32, bottom: Math.min(h, window.innerHeight * 0.62) + 24, left: 32, right: 32 };
  }, []);

  useEffect(() => {
    if (!trip) padRef.current = planPad;
    canPick.current = !trip && !doc;
  }, [trip, planPad, doc]);

  useEffect(() => {
    const el = mapEl.current;
    if (!el) return;
    let cancelled = false;
    let made: NavMap | null = null;
    import("./navMap")
      .then((mod) => {
        if (cancelled) return;
        made = new mod.NavMap({
          container: el,
          dark: prefersDark(),
          center,
          padding: () => padRef.current(),
          onClick: (p: LngLat) => {
            if (canPick.current) setDest({ lng: p[0], lat: p[1], label: "" });
          },
          onReady: () => setMap(made),
        });
      })
      .catch(() => setMapFailed(true));
    return () => {
      cancelled = true;
      made?.destroy();
      setMap(null);
    };
  }, [center]);

  useEffect(() => {
    if (!map || trip) return;
    if (doc) {
      map.setRoute(buildNavRoute([{ segments: doc.segments, steps: doc.steps }]), true);
      return;
    }
    map.setRoute(null);
    map.setDest(dest ? [dest.lng, dest.lat] : null, Boolean(dest));
  }, [map, dest, doc, trip]);

  const start = () => {
    setError(null);
    const voice = getVoice();
    voice.unlock();
    if (!navigator.geolocation) {
      setError(NAV.locUnsupported);
      return;
    }
    setBusy("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setBusy("routing");
        try {
          const here: LngLat = [pos.coords.longitude, pos.coords.latitude];
          const t = await planTrip({ here, activity, dest, doc, joined: false, baseM: 0, geometry: selected?.geometry });
          setFirstFix(pos);
          setTrip(t);
        } catch {
          setError(NAV.routeFailed);
        } finally {
          setBusy(null);
        }
      },
      (err) => {
        setBusy(null);
        setError(err.code === err.PERMISSION_DENIED ? NAV.locDenied : NAV.locWaiting);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    );
  };

  const end = () => {
    setTrip(null);
    setFirstFix(null);
    map?.setFollow("off");
    if (!doc) setDest(null);
  };

  const docStart = doc?.segments[0]?.from.label;
  const docEnd = doc?.segments[doc.segments.length - 1]?.to.label;
  const docLength = doc ? doc.segments.reduce((a, s) => a + s.distanceM, 0) : 0;

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-surface-2">
      <div className="absolute inset-0">
        <div ref={mapEl} className="h-full w-full" />
      </div>
      {mapFailed ? (
        <p className="panel absolute inset-x-4 top-4 z-10 px-4 py-2 text-sm text-ink-2" role="status">
          {NAV.mapFailed}
        </p>
      ) : null}
      {trip && firstFix && map ? (
        <NavScreen
          trip={trip}
          activity={activity}
          dest={dest}
          doc={doc}
          firstFix={firstFix}
          map={map}
          setPadding={(f) => (padRef.current = f)}
          onEnd={end}
        />
      ) : (
        <section
          ref={panelEl}
          aria-label={NAV.pageTitle}
          className="panel absolute inset-x-0 bottom-0 z-10 max-h-[62dvh] overflow-y-auto rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:inset-x-auto md:top-4 md:bottom-auto md:left-4 md:max-h-[calc(100dvh-2rem)] md:w-[400px] md:rounded-b-[18px]"
        >
          <div className="flex items-center justify-between gap-3">
            <Link href="/" aria-label={brand.name} className="rounded-md">
              <Mark className="size-8" />
            </Link>
            <VoiceToggle />
          </div>
          {doc ? (
            <div className="mt-4">
              <h1 className="text-[28px] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance">
                {doc.title.trim() || NAV.sharedRoute}
              </h1>
              <p className="mt-2 text-[15px] text-ink-2">
                {[docStart, docEnd].filter(Boolean).join(" to ")}
                {docStart || docEnd ? ", " : ""}
                {formatDistance(docLength)}
              </p>
              <p className="mt-2 text-[15px] text-ink-3">{NAV.guideToStart}</p>
            </div>
          ) : (
            <div className="mt-4">
              <h1 className="text-[28px] leading-[1.05] font-extrabold tracking-[-0.02em]">{NAV.heading}</h1>
              <div className="mt-3">
                {dest ? (
                  <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-line p-3">
                    <MapPin size={22} weight="bold" aria-hidden className="shrink-0 text-ink-2" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink-3">{NAV.to}</span>
                      <span className="block truncate font-bold">
                        {dest.label || `${NAV.droppedPin}, ${dest.lat.toFixed(5)}, ${dest.lng.toFixed(5)}`}
                      </span>
                    </span>
                    <button type="button" className="btn btn-ghost px-3" onClick={() => setDest(null)} disabled={!!busy}>
                      {NAV.change}
                    </button>
                  </div>
                ) : (
                  <>
                    <PlaceSearch
                      label={NAV.searchLabel}
                      showLocate={false}
                      getCenter={() => {
                        const c = map?.map.getCenter();
                        return c ? [c.lng, c.lat] : [36.8219, -1.2921];
                      }}
                      onPick={(p) => setDest({ lng: p.lng, lat: p.lat, label: p.label })}
                    />
                    <p className="mt-2 text-sm text-ink-3">{NAV.orTapMap}</p>
                  </>
                )}
              </div>
            </div>
          )}
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-ink-2">{NAV.activity}</legend>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {ACTIVITY_ORDER.map((a) => {
                const I = ACTIVITY_ICON[a];
                return (
                  <button
                    key={a}
                    type="button"
                    className="chip h-16 flex-col gap-1 px-1"
                    aria-pressed={activity === a}
                    onClick={() => setActivity(a)}
                  >
                    <I size={22} weight={activity === a ? "bold" : "regular"} aria-hidden />
                    {ACTIVITY_LABEL[a]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {dest || doc ? (
            <div className="mt-5">
              <h2 className="text-sm font-semibold text-ink-2">{doc ? NAV.routesTo : NAV.routes}</h2>
              {views.length ? (
                <div role="radiogroup" aria-label={doc ? NAV.routesTo : NAV.routes} className="mt-2 flex flex-col gap-2">
                  {views.map((v) => {
                    const on = v.id === selectedId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPicked({ key: selKey, id: v.id })}
                        className={`flex w-full items-center gap-3 rounded-[14px] border-[1.5px] p-3 text-left ${on ? "border-sign bg-surface-2" : "border-line bg-surface"}`}
                      >
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] ${on ? "border-sign bg-sign text-sign-ink" : "border-line"}`}
                          aria-hidden
                        >
                          {on ? <Check size={14} weight="bold" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="num block text-[20px] leading-tight font-bold">{formatDuration(v.timeS)}</span>
                          <span className="block text-[15px] text-ink-2">
                            {formatDistance(v.distanceM)}
                            {v.deltaM >= 10 ? `, ${optionTag(v)}` : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {v.shortest ? (
                            <span className="rounded-[8px] bg-accent px-2 py-0.5 text-[12px] font-bold text-accent-ink">
                              {NAV.shortest}
                            </span>
                          ) : null}
                          {v.fastest ? (
                            <span className="rounded-[8px] border-[1.5px] border-line px-2 py-0.5 text-[12px] font-bold text-ink-2">
                              {NAV.fastest}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-3" role="status">
                  {locErr
                    ? NAV.routesNeedLocation
                    : here && doc && !target
                      ? NAV.atStartAlready
                      : current?.failed
                        ? NAV.routesFailed
                        : NAV.findingRoutes}
                </p>
              )}
            </div>
          ) : null}
          <button
            type="button"
            className="btn btn-primary btn-lg mt-5 w-full"
            onClick={start}
            disabled={(!dest && !doc) || !!busy}
          >
            <NavigationArrow size={22} weight="bold" aria-hidden />
            {busy === "locating" ? NAV.starting : busy === "routing" ? NAV.routing : NAV.start}
          </button>
          {error ? (
            <p role="alert" className="mt-3 text-[15px] font-medium text-danger">
              {error}
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink-3">{NAV.keepAwake}</p>
          )}
        </section>
      )}
    </div>
  );
}
