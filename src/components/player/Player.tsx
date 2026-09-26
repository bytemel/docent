"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, X } from "@phosphor-icons/react";
import { prefersDark, prefersReducedMotion } from "@/lib/map";
import { pickTier, type Tier } from "@/lib/tier";
import { buildTimeline, stepTimes } from "@/lib/timeline";
import type { RouteDoc } from "@/lib/types";
import { PLAYER } from "@/strings/player";
import Controls from "./Controls";
import { PlaybackEngine } from "./engine";
import { EndCard, googleMapsUrl, StepList, Summary } from "./Panels";
import { EndpointContent, PinContent } from "./Pins";
import { PROP_CSS } from "./props2d";
import type { PinEl } from "./scene";

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

export default function Player({ doc, variant = "page", autoplay, onClose }: PlayerProps) {
  const embed = variant === "embed";
  const [env] = useState(detectEnv);
  const tl = useMemo(() => buildTimeline(doc), [doc]);
  const steps = doc.steps;
  const times = useMemo(() => stepTimes(tl, steps), [tl, steps]);
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
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(env.reducedMotion);
  const [note, setNote] = useState(false);
  const [mapState, setMapState] = useState<"loading" | "ready" | "failed">("loading");
  const [noMap, setNoMap] = useState(!env.webgl2);
  const [copyHref] = useState(() => {
    if (variant !== "page") return null;
    const d = new URLSearchParams(window.location.search).get("d");
    return d ? `/new?d=${encodeURIComponent(d)}` : null;
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);
  const engRef = useRef<PlaybackEngine | null>(null);
  const tierRef = useRef(tier);
  const autoRef = useRef(true);

  useEffect(() => {
    if (noMap || !mapRef.current) return;
    const container = mapRef.current;
    const wantAuto = (autoplay ?? true) && !env.reducedMotion;
    const eng = new PlaybackEngine({
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
      },
    });
    engRef.current = eng;
    let io: IntersectionObserver | null = null;
    if (embed && rootRef.current && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => eng.visible(!!entries[entries.length - 1]?.isIntersecting), {
        threshold: 0.25,
      });
      io.observe(rootRef.current);
    }
    return () => {
      io?.disconnect();
      eng.destroy();
      engRef.current = null;
    };
  }, [noMap, tl, doc, times, pins, endpoints, env, embed, autoplay]);

  useEffect(() => {
    tierRef.current = tier;
    engRef.current?.applyTier(tier);
  }, [tier]);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(false), 6000);
    return () => clearTimeout(id);
  }, [note]);

  useEffect(() => {
    if (embed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape" && variant === "preview" && onClose) {
        onClose();
        return;
      }
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const range = tag === "INPUT" && (el as HTMLInputElement).type === "range";
      if (!range && (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable)) return;
      if (e.key === " ") {
        if (tag === "BUTTON" || tag === "A") return;
        e.preventDefault();
        engRef.current?.toggle();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        engRef.current?.nudge(e.key === "ArrowRight" ? 5 : -5);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embed, variant, onClose]);

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
  const closeBtn =
    variant === "preview" && onClose ? (
      <button type="button" className="btn btn-icon absolute right-3 top-3 z-20 shadow-float" aria-label={PLAYER.close} onClick={onClose}>
        <X size={20} weight="bold" aria-hidden="true" />
      </button>
    ) : null;

  if (noMap) {
    const gm = googleMapsUrl(doc);
    const shell =
      variant === "preview"
        ? "fixed inset-0 z-50 overflow-y-auto bg-bg"
        : embed
          ? "h-full w-full overflow-y-auto rounded-[12px] bg-surface"
          : "min-h-dvh w-full bg-bg";
    return (
      <div className={shell}>
        {closeBtn}
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
          <p role="status" className="panel p-3 text-sm text-ink-2">
            {PLAYER.noWebgl}
          </p>
          <Summary doc={doc} heading={variant === "page"} />
          {embed ? null : <StepList steps={steps} current={-1} />}
          {gm && !embed ? (
            <a className="btn btn-primary" href={gm} target="_blank" rel="noopener noreferrer">
              {PLAYER.openGoogleMaps}
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (embed) {
    return (
      <div ref={rootRef} className="relative h-full w-full overflow-hidden rounded-[12px] bg-surface-2">
        {style}
        <div className="absolute inset-0">
            <div ref={mapRef} className="h-full w-full" />
          </div>
        <button
          type="button"
          className="btn btn-icon absolute bottom-3 left-3 z-10 shadow-float"
          aria-label={playing ? PLAYER.pause : PLAYER.play}
          onClick={() => engRef.current?.toggle()}
        >
          {playing ? <Pause size={20} weight="fill" aria-hidden="true" /> : <Play size={20} weight="fill" aria-hidden="true" />}
        </button>
        {portals}
      </div>
    );
  }

  const rows = sheetOpen ? "grid-rows-[32dvh_auto_minmax(0,1fr)]" : "grid-rows-[minmax(0,1fr)_auto]";
  return (
    <div ref={rootRef} className={variant === "preview" ? "fixed inset-0 z-50 bg-bg" : "relative h-dvh w-full overflow-hidden bg-bg"}>
      {style}
      <div className={`grid h-full w-full ${rows} lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)_auto]`}>
        <div className="relative min-h-0 overflow-hidden bg-surface-2 lg:col-start-1 lg:row-start-1">
          <div className="absolute inset-0">
            <div ref={mapRef} className="h-full w-full" />
          </div>
          <div className="pointer-events-none absolute left-3 right-16 top-3 z-10 lg:hidden">
            <span className="chip max-w-full font-semibold text-ink shadow-float">
              <span className="truncate">{doc.title || PLAYER.untitled}</span>
            </span>
          </div>
          {closeBtn}
          {mapState === "loading" ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <span className="chip shadow-float">{PLAYER.loadingMap}</span>
            </div>
          ) : null}
          {mapState === "failed" ? (
            <div className="absolute inset-x-3 top-16 z-10 flex justify-center">
              <p role="status" className="panel px-3 py-2 text-sm text-ink-2">
                {PLAYER.mapFailed}
              </p>
            </div>
          ) : null}
          {note ? (
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex">
              <p role="status" className="panel px-3 py-2 text-sm text-ink-2">
                {PLAYER.switchedLighter}
              </p>
            </div>
          ) : null}
          {ended ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-bg/60 p-4">
              <EndCard doc={doc} copyHref={copyHref} onReplay={() => engRef.current?.play()} />
            </div>
          ) : null}
        </div>

        <section
          aria-label={PLAYER.currentStep}
          className="border-t border-line bg-surface px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 lg:col-start-1 lg:row-start-2 lg:px-6 lg:pb-4"
        >
          <Controls
            steps={steps}
            stepIndex={stepIndex}
            playing={playing}
            totalS={tl.totalS}
            speed={speed}
            tier={tier}
            showFollow={!follow && tier !== "basic" && mapState === "ready"}
            sheetOpen={sheetOpen}
            scrubRef={scrubRef}
            timeRef={timeRef}
            onToggle={() => engRef.current?.toggle()}
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
            onSheet={() => setSheetOpen((o) => !o)}
          />
        </section>

        <aside
          data-scroll
          className={`${sheetOpen ? "flex" : "hidden"} min-h-0 flex-col gap-5 overflow-y-auto border-t border-line bg-surface p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:border-l lg:border-t-0 lg:p-5`}
        >
          <Summary doc={doc} heading={variant === "page"} />
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-ink-2">{PLAYER.steps}</h2>
            <StepList steps={steps} current={stepIndex} onPick={(i) => engRef.current?.seek(times[i] ?? 0)} />
          </div>
          <p className="hidden text-xs text-ink-3 lg:block">{PLAYER.keyboardHint}</p>
        </aside>
      </div>
      {portals}
    </div>
  );
}
