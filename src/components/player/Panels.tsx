"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { ArrowCounterClockwise, ArrowSquareOut, NavigationArrow, PencilSimple, Plus, X } from "@phosphor-icons/react";
import { formatDistance, formatDuration } from "@/lib/geo";
import { prefersReducedMotion } from "@/lib/map";
import { MODES } from "@/lib/modes";
import { buildTimeline, safeMode } from "@/lib/timeline";
import type { Mode, RouteDoc, Step } from "@/lib/types";
import { PLAYER } from "@/strings/player";
import { GlyphTile } from "./DirectionPlate";
import { glyphFor, plateText, stepGapMeters, type Glyph } from "./glyph";

export function routeStats(doc: RouteDoc) {
  let distanceM = 0;
  let durationS = 0;
  const modes: Mode[] = [];
  for (const s of Array.isArray(doc.segments) ? doc.segments : []) {
    if (Number.isFinite(s.distanceM)) distanceM += s.distanceM;
    if (Number.isFinite(s.durationS)) durationS += s.durationS;
    const m = safeMode(s.mode);
    if (!modes.includes(m)) modes.push(m);
  }
  return { distanceM, durationS, modes };
}

export function googleMapsUrl(doc: RouteDoc): string | null {
  const segs = Array.isArray(doc.segments) ? doc.segments : [];
  const last = segs[segs.length - 1];
  if (!last || !Number.isFinite(last.to?.lat) || !Number.isFinite(last.to?.lng)) return null;
  const mode = safeMode(last.mode);
  const travelmode = mode === "walk" ? "walking" : mode === "bike" ? "bicycling" : "driving";
  return `https://www.google.com/maps/dir/?api=1&destination=${last.to.lat},${last.to.lng}&travelmode=${travelmode}`;
}

export function goHref(d: string | null): string | null {
  return d ? `/go?d=${encodeURIComponent(d)}` : null;
}

function ModeSwatch({ mode }: { mode: Mode }) {
  const info = MODES[mode];
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
      <span
        aria-hidden="true"
        className="h-0 w-5 rounded-full"
        style={{ borderTop: `4px ${info.dashed ? "dotted" : "solid"} ${info.color}` }}
      />
      {info.label}
    </span>
  );
}

export function Summary({ doc, heading, compact = false }: { doc: RouteDoc; heading: boolean; compact?: boolean }) {
  const { distanceM, durationS, modes } = routeStats(doc);
  const Title = heading ? "h1" : "h2";
  const segs = Array.isArray(doc.segments) ? doc.segments : [];
  const from = segs[0]?.from?.label;
  const to = segs[segs.length - 1]?.to?.label;
  return (
    <div className="flex flex-col gap-3">
      {compact ? null : <p className="text-sm font-semibold text-ink-2">{PLAYER.routeFor}</p>}
      <Title
        className={
          compact
            ? "text-[20px] font-extrabold leading-[1.1] tracking-[-0.01em] text-ink text-balance"
            : "text-[28px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink text-balance sm:text-[34px]"
        }
      >
        {doc.title || PLAYER.untitled}
      </Title>
      {from && to && !compact ? (
        <ol className="flex flex-col gap-1.5 text-[15px]">
          <li className="flex min-w-0 items-start gap-2.5 text-ink-2">
            <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-sign text-[11px] font-extrabold text-sign-ink">A</span>
            <span className="min-w-0 line-clamp-2 text-pretty">{from}</span>
          </li>
          <li className="flex min-w-0 items-start gap-2.5 font-semibold text-ink">
            <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-accent text-[11px] font-extrabold text-accent-ink">B</span>
            <span className="min-w-0 line-clamp-2 text-pretty">{to}</span>
          </li>
        </ol>
      ) : null}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <dl className="flex gap-6">
          <div>
            <dt className="text-xs font-semibold text-ink-2">{PLAYER.distance}</dt>
            <dd className="num text-[22px] font-bold leading-tight text-ink">{formatDistance(distanceM)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink-2">{PLAYER.time}</dt>
            <dd className="text-[22px] font-bold leading-tight text-ink">
              <span className="mr-1.5 text-sm font-semibold text-ink-2">{PLAYER.about}</span>
              <span className="num">{formatDuration(durationS)}</span>
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-1" aria-label={PLAYER.modes}>
          {modes.map((m) => (
            <ModeSwatch key={m} mode={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function useStepMeta(doc: RouteDoc) {
  return useMemo(() => {
    const tl = buildTimeline(doc);
    const steps = Array.isArray(doc.steps) ? doc.steps : [];
    return {
      glyphs: steps.map((s) => glyphFor(s, tl)),
      legs: steps.map((_, i) => stepGapMeters(steps, i, tl.totalM)),
    };
  }, [doc]);
}

export function StepList({
  steps,
  current,
  glyphs,
  legs,
  onPick,
}: {
  steps: Step[];
  current: number;
  glyphs: Glyph[];
  legs: (number | null)[];
  onPick?: (i: number) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[current] as HTMLElement | undefined;
    if (!list || !item) return;
    const scroller = list.closest("[data-scroll]") as HTMLElement | null;
    if (!scroller) return;
    const top = item.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    if (top < scroller.scrollTop || top + item.offsetHeight > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTo({ top: Math.max(0, top - 12), behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }, [current]);

  if (steps.length === 0) return <p className="text-sm text-ink-2">{PLAYER.noSteps}</p>;
  return (
    <ol ref={listRef} className="flex flex-col gap-1.5">
      {steps.map((s, i) => {
        const on = i === current;
        const leg = legs[i];
        const content = (
          <>
            <GlyphTile glyph={glyphs[i] ?? "straight"} size="sm" tone={on ? "accent" : "plain"} />
            <span className={on ? "flex-1 text-[15px] font-bold leading-snug text-pretty" : "flex-1 text-[15px] leading-snug text-ink text-pretty"}>
              {plateText(s.text)}
            </span>
            {leg ? (
              <span className={on ? "shrink-0 pt-0.5 text-right text-xs font-semibold opacity-80" : "shrink-0 pt-0.5 text-right text-xs font-semibold text-ink-2"}>
                {PLAYER.inDistance} <span className="num">{formatDistance(leg)}</span>
              </span>
            ) : null}
          </>
        );
        const cls = on
          ? "sign flex w-full items-start gap-3 px-3 py-2.5 text-left"
          : "flex w-full items-start gap-3 rounded-[18px] border-[1.5px] border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-ink-3";
        return (
          <li key={s.id} aria-current={on ? "step" : undefined}>
            {onPick ? (
              <button type="button" className={cls} onClick={() => onPick(i)}>
                {content}
              </button>
            ) : (
              <div className={cls}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function EndCard({
  doc,
  directionsHref,
  copyHref,
  onReplay,
  flat = false,
}: {
  doc: RouteDoc;
  directionsHref: string | null;
  copyHref: string | null;
  onReplay: () => void;
  flat?: boolean;
}) {
  const gm = googleMapsUrl(doc);
  const note = doc.arrival?.note?.trim();
  return (
    <div className={flat ? "flex w-full flex-col gap-4" : "panel flex w-full max-w-sm flex-col gap-4 p-5"}>
      <div className="flex items-center gap-3">
        <GlyphTile glyph="arrive" size="lg" />
        <h2 className="text-[24px] font-extrabold leading-tight tracking-[-0.01em] text-ink">{PLAYER.arrivalHeading}</h2>
      </div>
      {note ? <p className="whitespace-pre-line text-[16px] leading-relaxed text-ink text-pretty">{note}</p> : null}
      <div className="flex flex-col gap-2">
        {directionsHref ? (
          <Link className="btn btn-primary btn-lg w-full" href={directionsHref}>
            <NavigationArrow size={20} weight="bold" aria-hidden="true" />
            {PLAYER.startDirections}
          </Link>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn" onClick={onReplay}>
            <ArrowCounterClockwise size={18} weight="bold" aria-hidden="true" />
            {PLAYER.replay}
          </button>
          {gm ? (
            <a className="btn" href={gm} target="_blank" rel="noopener noreferrer">
              <ArrowSquareOut size={18} weight="bold" aria-hidden="true" />
              {PLAYER.googleMaps}
            </a>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-ghost flex-1" href="/new">
            <Plus size={18} weight="bold" aria-hidden="true" />
            {PLAYER.makeYourOwn}
          </Link>
          {copyHref ? (
            <Link className="btn btn-ghost flex-1" href={copyHref}>
              <PencilSimple size={18} weight="bold" aria-hidden="true" />
              {PLAYER.editCopy}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StaticView({
  doc,
  variant,
  note,
  onClose,
}: {
  doc: RouteDoc;
  variant: "page" | "preview" | "embed";
  note: string;
  onClose?: () => void;
}) {
  const embed = variant === "embed";
  const gm = googleMapsUrl(doc);
  const steps = Array.isArray(doc.steps) ? doc.steps : [];
  const { glyphs, legs } = useStepMeta(doc);
  const shell =
    variant === "preview"
      ? "fixed inset-0 z-50 overflow-y-auto bg-bg"
      : embed
        ? "h-full w-full overflow-y-auto rounded-[18px] bg-surface"
        : "min-h-dvh w-full bg-bg";
  return (
    <div className={shell}>
      {variant === "preview" && onClose ? (
        <button
          type="button"
          className="btn btn-icon absolute right-3 top-3 z-20 shadow-float"
          aria-label={PLAYER.close}
          onClick={onClose}
        >
          <X size={20} weight="bold" aria-hidden="true" />
        </button>
      ) : null}
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
        <p role="status" className="sign p-4 text-[15px] font-semibold">
          {note}
        </p>
        <Summary doc={doc} heading={variant === "page"} />
        {embed ? null : <StepList steps={steps} current={-1} glyphs={glyphs} legs={legs} />}
        {gm && !embed ? (
          <a className="btn btn-primary btn-lg" href={gm} target="_blank" rel="noopener noreferrer">
            {PLAYER.openGoogleMaps}
          </a>
        ) : null}
      </div>
    </div>
  );
}
