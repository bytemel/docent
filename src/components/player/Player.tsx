"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Crosshair, ListBullets, NavigationArrow, Pause, Play, X } from "@phosphor-icons/react";
import { prefersDark, prefersReducedMotion } from "@/lib/map";
import { pickTier, type Tier } from "@/lib/tier";
import { buildTimeline, stepTimes } from "@/lib/timeline";
import type { RouteDoc } from "@/lib/types";
import { getVoice } from "@/lib/voice";
import { PLAYER } from "@/strings/player";
import Controls from "./Controls";
import DirectionPlate from "./DirectionPlate";
import { PlaybackEngine } from "./engine";
import { glyphFor, plateText } from "./glyph";
import LivePanel, { isTracking, LiveToggle } from "./LivePanel";
import { LOC_OFF, type FixOut, type LocStatus } from "./location";
import { EndCard, goHref, StaticView, StepList, Summary, useStepMeta } from "./Panels";
import { EndpointContent, PinContent } from "./Pins";
import { PROP_CSS } from "./props2d";
import type { PinEl } from "./scene";
import { stepMeters } from "./track";

export interface PlayerProps {
  doc: RouteDoc;
  variant?: "page" | "preview" | "embed";
  autoplay?: boolean;
  onClose?: () => void;
}

interface Env {
  reducedMotion: boolean;
  webgl2: boolean;
  deviceMemory?: number;
  cores?: number;
  dark: boolean;
}

function detectEnv(): Env {
  let webgl2 = false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    webgl2 = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    reducedMotion: prefersReducedMotion(),
    webgl2,
    deviceMemory: typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
    cores: nav.hardwareConcurrency || undefined,
    dark: prefersDark(),
  };
}

let lastSpoken = "";

function say(text: string, repeat = false) {
  const voice = getVoice();
  if (!voice.enabled()) return;
  let line = text;
  if (repeat && line === lastSpoken) line = `${line}.`;
  lastSpoken = line;
  voice.speak(line, { interrupt: true });
}

export default function Player({ doc, variant = "page", autoplay, onClose }: PlayerProps) {
  const embed = variant === "embed";
  const [env] = useState(detectEnv);
  const tl = useMemo(() => buildTimeline(doc), [doc]);
  const steps = doc.steps;
  const times = useMemo(() => stepTimes(tl, steps), [tl, steps]);
  const stepsM = useMemo(() => stepMeters(tl, steps), [tl, steps]);
  const glyphs = useMemo(() => steps.map((s) => glyphFor(s, tl)), [steps, tl]);
  const { legs } = useStepMeta(doc);
  const landmarks = useMemo(() => doc.landmarks.filter((l) => !l.hidden), [doc.landmarks]);
  const pins = useMemo<PinEl[]>(
    () =>
      landmarks.map((l) => {
        const el = document.createElement("div");
        el.className = "group";
        el.dataset.near = "false";
        return { id: l.id, el, lngLat: [l.lng, l.lat] };
      }),
    [landmarks],
  );
  const endpoints = useMemo(() => ({ a: document.createElement("div"), b: document.createElement("div") }), []);

  const [tier, setTier] = useState<Tier>(() => {
    const t = pickTier(env);
    return embed && t === "3d" ? "2d" : t;
  });
  const [stage, setStage] = useState<"intro" | "watch">(variant === "page" ? "intro" : "watch");
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [note, setNote] = useState(false);
  const [mapState, setMapState] = useState<"loading" | "ready" | "failed">("loading");
  const [noMap, setNoMap] = useState(!env.webgl2);
  const [links] = useState(() => {
    if (variant !== "page") return { copy: null, go: null };
    const d = new URLSearchParams(window.location.search).get("d");
    return { copy: d ? `/new?d=${encodeURIComponent(d)}` : null, go: goHref(d) };
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const distRef = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);
  const engRef = useRef<PlaybackEngine | null>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const sinkRef = useRef<((fix: FixOut) => void) | null>(null);
  const unlockedRef = useRef(false);
  const [loc, setLoc] = useState<LocStatus>(LOC_OFF);
  const [followMe, setFollowMe] = useState(false);
  const tierRef = useRef(tier);
  const autoRef = useRef(true);

  useEffect(() => {
    if (noMap || !mapRef.current) return;
    const container = mapRef.current;
    const wantAuto = (autoplay ?? true) && !env.reducedMotion && variant !== "page";
    let eng: PlaybackEngine | null = null;
    const create = () =>
      new PlaybackEngine({
        container,
        doc,
        tl,
        times,
        pins,
        endpoints,
        dark: env.dark,
        reducedMotion: env.reducedMotion,
        embed,
        autoplay: wantAuto,
        tier: () => tierRef.current,
        auto: () => autoRef.current,
        scrub: () => scrubRef.current,
        time: () => timeRef.current,
        dragging: () => dragging.current,
        dist: () => distRef.current,
        stepsM,
        startOverview: variant === "page",
        cb: {
          playing: setPlaying,
          ended: (on) => {
            setEnded(on);
            if (on) setSheetOpen(false);
          },
          step: setStepIndex,
          follow: setFollow,
          tier: (t, downgraded) => {
            if (downgraded) setNote(true);
            setTier(t);
          },
          mapState: setMapState,
          noMap: () => setNoMap(true),
          speak: (i) => {
            const s = doc.steps[i];
            const note = s?.kind === "arrive" ? doc.arrival?.note?.trim() : "";
            if (!embed && s) say(note ? `${plateText(s.text)} ${note}` : plateText(s.text));
          },
          hush: () => getVoice().cancel(),
        },
      });
    let io: IntersectionObserver | null = null;
    if (embed && rootRef.current && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          const vis = !!entries[entries.length - 1]?.isIntersecting;
          if (vis && !eng) {
            eng = create();
            engRef.current = eng;
          }
          eng?.visible(vis);
        },
        { threshold: 0.25, rootMargin: "200px 0px" },
      );
      io.observe(rootRef.current);
    } else {
      eng = create();
      engRef.current = eng;
    }
    return () => {
      io?.disconnect();
      eng?.destroy();
      engRef.current = null;
      getVoice().cancel();
      setLoc(LOC_OFF);
      setFollowMe(false);
    };
  }, [noMap, tl, doc, times, stepsM, pins, endpoints, env, embed, autoplay, variant]);

  useEffect(() => {
    tierRef.current = tier;
    engRef.current?.applyTier(tier);
  }, [tier]);

  useEffect(() => {
    engRef.current?.refreshDist();
  }, [stepIndex, stage, loc.state]);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(false), 6000);
    return () => clearTimeout(id);
  }, [note]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") getVoice().cancel();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const unlockVoice = () => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    getVoice().unlock();
  };

  const togglePlay = () => {
    unlockVoice();
    engRef.current?.toggle();
  };

  const startWatch = () => {
    unlockVoice();
    setStage("watch");
    if (tier !== "basic") engRef.current?.follow();
    engRef.current?.play();
  };

  const backToIntro = () => {
    engRef.current?.pause();
    engRef.current?.showWhole();
    setStage("intro");
  };

  const startLocation = () =>
    engRef.current?.startLocation({
      onStatus: setLoc,
      onFollowOff: () => setFollowMe(false),
      onFix: (fix) => sinkRef.current?.(fix),
    });
  const stopLocation = () => {
    engRef.current?.stopLocation();
    setFollowMe(false);
  };

  useEffect(() => {
    if (embed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const range = tag === "INPUT" && (el as HTMLInputElement).type === "range";
      if (!range && (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable)) return;
      if (e.key === " ") {
        if (tag === "BUTTON" || tag === "A") return;
        e.preventDefault();
        if (!unlockedRef.current) {
          unlockedRef.current = true;
          getVoice().unlock();
        }
        engRef.current?.toggle();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        engRef.current?.nudge(e.key === "ArrowRight" ? 5 : -5);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embed]);

  useEffect(() => {
    if (variant !== "preview") return;
    const id = requestAnimationFrame(() => playRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [variant]);

  useEffect(() => {
    if (variant !== "preview") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [variant]);

  const portals = (
    <>
      {pins.map((p, i) => createPortal(<PinContent kind={landmarks[i].kind} label={landmarks[i].label} />, p.el, p.id))}
      {createPortal(<EndpointContent which="a" label={doc.segments[0]?.from.label ?? PLAYER.start} />, endpoints.a, "a")}
      {createPortal(
        <EndpointContent which="b" label={doc.segments[doc.segments.length - 1]?.to.label ?? PLAYER.destination} />,
        endpoints.b,
        "b",
      )}
    </>
  );
  const style = (
    <style href="docent-player-props" precedence="default">
      {PROP_CSS}
    </style>
  );

  if (noMap) return <StaticView doc={doc} variant={variant} note={PLAYER.noWebgl} onClose={onClose} />;

  if (embed) {
    return (
      <div ref={rootRef} className="relative h-full w-full overflow-hidden rounded-[inherit] bg-surface-2">
        {style}
        <div className="absolute inset-0">
          <div ref={mapRef} className="dp-map h-full w-full" />
        </div>
        <button
          type="button"
          className="btn btn-icon absolute left-3 top-3 z-10 border-transparent shadow-float"
          aria-label={playing ? PLAYER.pause : PLAYER.play}
          onClick={() => engRef.current?.toggle()}
        >
          {playing ? <Pause size={20} weight="fill" aria-hidden="true" /> : <Play size={20} weight="fill" aria-hidden="true" />}
        </button>
        {portals}
      </div>
    );
  }

  const tracking = isTracking(loc);
  const live = loc.state === "on" && loc.stepIndex !== null;
  const shownStep = live ? (loc.stepIndex ?? 0) : stepIndex;
  const intro = stage === "intro";
  const onPick = (i: number) => {
    if (intro) {
      setStage("watch");
      if (tier !== "basic") engRef.current?.follow();
    }
    engRef.current?.seek(times[i] ?? 0);
  };
  const locButton = (
    <button
      type="button"
      className={`btn btn-lg w-14 shrink-0 p-0 ${tracking ? "btn-sign" : ""}`}
      aria-pressed={tracking}
      aria-label={tracking ? PLAYER.stopShowingMe : PLAYER.showMe}
      title={tracking ? PLAYER.stopShowingMe : PLAYER.showMe}
      onClick={() => (tracking ? stopLocation() : startLocation())}
      disabled={mapState !== "ready"}
    >
      <Crosshair size={24} weight="bold" aria-hidden="true" />
    </button>
  );
  const livePanel =
    variant === "page" && loc.state !== "off" ? (
      <LivePanel loc={loc} arrivalNote={doc.arrival?.note?.trim() ?? ""} sinkRef={sinkRef} onGuide={() => engRef.current?.guideMe()} />
    ) : null;
  const stepsBlock = (
    <div className="flex flex-col gap-3">
      <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">{PLAYER.stepsHeading}</h2>
      <StepList steps={steps} current={intro && !live ? -1 : shownStep} glyphs={glyphs} legs={legs} onPick={onPick} />
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`${variant === "preview" ? "fixed inset-0 z-50" : "relative h-dvh w-full"} flex flex-col overflow-hidden bg-bg lg:flex-row-reverse`}
    >
      {style}
      <div className="relative min-h-[34dvh] flex-1 overflow-hidden bg-surface-2">
        <div className="absolute inset-x-0 bottom-5 top-0 lg:bottom-0">
          <div ref={mapRef} className="dp-map h-full w-full" />
        </div>
        {variant === "page" && !intro ? (
          <button
            type="button"
            className="btn btn-icon absolute left-3 top-3 z-20 border-transparent shadow-float"
            aria-label={PLAYER.backToOverview}
            title={PLAYER.backToOverview}
            onClick={backToIntro}
          >
            <ArrowLeft size={20} weight="bold" aria-hidden="true" />
          </button>
        ) : null}
        {variant === "preview" && onClose ? (
          <button
            type="button"
            className="btn btn-icon absolute right-3 top-3 z-20 border-transparent shadow-float"
            aria-label={PLAYER.close}
            onClick={onClose}
          >
            <X size={20} weight="bold" aria-hidden="true" />
          </button>
        ) : null}
        {variant === "page" && mapState === "ready" && !ended && (!intro || tracking) ? (
          <div className="absolute bottom-12 right-3 z-10 lg:bottom-9">
            <LiveToggle
              loc={loc}
              followMe={followMe}
              onStart={startLocation}
              onStop={stopLocation}
              onFollowMe={(on) => {
                setFollowMe(on);
                engRef.current?.followMe(on);
              }}
            />
          </div>
        ) : null}
        {mapState === "loading" ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="panel px-4 py-2.5 text-sm font-semibold text-ink-2">{PLAYER.loadingMap}</span>
          </div>
        ) : null}
        {mapState === "failed" ? (
          <div className="absolute inset-x-3 top-16 z-10 flex justify-center">
            <p role="status" className="panel px-4 py-3 text-sm font-medium text-ink">
              {PLAYER.mapFailed}
            </p>
          </div>
        ) : null}
        {note ? (
          <div className="pointer-events-none absolute left-16 right-3 top-3 z-10 flex">
            <p role="status" className="sign px-4 py-2.5 text-sm font-semibold">
              {PLAYER.switchedLighter}
            </p>
          </div>
        ) : null}
        {ended ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-bg/70 p-4">
            <EndCard doc={doc} directionsHref={links.go} copyHref={links.copy} onReplay={() => engRef.current?.play()} />
          </div>
        ) : null}
      </div>

      <section
        aria-label={intro ? PLAYER.overview : PLAYER.currentStep}
        className="relative z-10 -mt-5 flex max-h-[66dvh] min-h-0 flex-col rounded-t-[18px] border-t border-line bg-surface shadow-float lg:mt-0 lg:max-h-none lg:w-[400px] lg:shrink-0 lg:rounded-none lg:border-r lg:border-t-0 lg:shadow-none"
      >
        <div
          data-scroll
          className="flex min-h-0 flex-col gap-5 overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 lg:gap-6 lg:px-6 lg:pb-6 lg:pt-7"
        >
          <span aria-hidden="true" className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-line lg:hidden" />
          {intro ? (
            <>
              <Summary doc={doc} heading />
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {links.go ? (
                    <Link href={links.go} className="btn btn-primary btn-lg min-w-0 flex-1">
                      <NavigationArrow size={22} weight="bold" aria-hidden="true" />
                      {PLAYER.startDirections}
                    </Link>
                  ) : null}
                  {locButton}
                </div>
                <button type="button" className="btn btn-sign btn-lg w-full" onClick={startWatch}>
                  <Play size={20} weight="fill" aria-hidden="true" />
                  {PLAYER.watchRoute}
                </button>
                <p className="text-[13px] text-ink-2">{PLAYER.watchHint}</p>
              </div>
              {livePanel}
              {stepsBlock}
            </>
          ) : (
            <>
              <div className="hidden lg:block">
                <Summary doc={doc} heading={variant === "page"} compact />
              </div>
              <DirectionPlate
                steps={steps}
                index={shownStep}
                glyph={glyphs[shownStep] ?? "straight"}
                next={steps[shownStep + 1]}
                distRef={distRef}
                live={live}
                onRepeat={() => {
                  unlockVoice();
                  const s = steps[shownStep];
                  if (s) say(plateText(s.text), true);
                }}
              />
              <Controls
                playing={playing}
                totalS={tl.totalS}
                speed={speed}
                tier={tier}
                showFollow={!follow && tier !== "basic" && mapState === "ready"}
                scrubRef={scrubRef}
                playRef={playRef}
                timeRef={timeRef}
                onToggle={togglePlay}
                onSeek={(t) => engRef.current?.seek(t)}
                onDrag={(on) => {
                  dragging.current = on;
                }}
                onSpeed={(v) => {
                  setSpeed(v);
                  engRef.current?.setSpeed(v);
                }}
                onTier={(t) => {
                  autoRef.current = false;
                  setNote(false);
                  setTier(t);
                }}
                onWhole={() => engRef.current?.showWhole()}
                onFollow={() => engRef.current?.follow()}
              />
              {livePanel}
              <button
                type="button"
                className="btn w-full lg:hidden"
                aria-expanded={sheetOpen}
                onClick={() => setSheetOpen((o) => !o)}
              >
                <ListBullets size={18} weight="bold" aria-hidden="true" />
                {sheetOpen ? PLAYER.hideSteps : PLAYER.allSteps}
              </button>
              <div className={sheetOpen ? "block" : "hidden lg:block"}>{stepsBlock}</div>
              <p className="hidden text-xs text-ink-2 lg:block">{PLAYER.keyboardHint}</p>
            </>
          )}
        </div>
      </section>
      {portals}
    </div>
  );
}
