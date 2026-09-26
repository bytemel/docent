"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowCounterClockwise, ArrowSquareOut, PencilSimple, Plus, X } from "@phosphor-icons/react";
import { formatDistance, formatDuration } from "@/lib/geo";
import { prefersReducedMotion } from "@/lib/map";
import { MODES } from "@/lib/modes";
import { safeMode } from "@/lib/timeline";
import type { Mode, RouteDoc, Step } from "@/lib/types";
import { PLAYER } from "@/strings/player";

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

export function Summary({ doc, heading }: { doc: RouteDoc; heading: boolean }) {
  const { distanceM, durationS, modes } = routeStats(doc);
  const Title = heading ? "h1" : "h2";
  return (
    <div className="flex flex-col gap-3">
      <Title className="text-xl font-semibold leading-tight text-ink text-balance">{doc.title || PLAYER.untitled}</Title>
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-[12px] bg-surface-2 px-3 py-2">
          <dt className="text-xs text-ink-2">{PLAYER.distance}</dt>
          <dd className="text-base font-semibold text-ink">{formatDistance(distanceM)}</dd>
        </div>
        <div className="rounded-[12px] bg-surface-2 px-3 py-2">
          <dt className="text-xs text-ink-2">{PLAYER.realTime}</dt>
          <dd className="text-base font-semibold text-ink">{formatDuration(durationS)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-3">{PLAYER.modes}</span>
        {modes.map((m) => (
          <span key={m} className="chip min-h-8 px-2.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: MODES[m].color }} aria-hidden="true" />
            {MODES[m].label}
          </span>
        ))}
      </div>
      <p className="text-xs text-ink-3">{PLAYER.playbackNote}</p>
    </div>
  );
}

export function StepList({
  steps,
  current,
  onPick,
}: {
  steps: Step[];
  current: number;
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

  if (steps.length === 0) return <p className="text-sm text-ink-3">{PLAYER.noSteps}</p>;
  return (
    <ol ref={listRef} className="relative flex flex-col gap-1">
      {steps.map((s, i) => {
        const on = i === current;
        const content = (
          <>
            <span
              className={
                on
                  ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink"
                  : "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink-2"
              }
            >
              {i + 1}
            </span>
            <span className={on ? "text-[15px] font-semibold text-ink" : "text-[15px] text-ink-2"}>{s.text}</span>
          </>
        );
        const cls = on
          ? "flex w-full items-start gap-3 rounded-[12px] bg-accent-soft px-3 py-2.5 text-left"
          : "flex w-full items-start gap-3 rounded-[12px] px-3 py-2.5 text-left hover:bg-surface-2";
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
  copyHref,
  onReplay,
}: {
  doc: RouteDoc;
  copyHref: string | null;
  onReplay: () => void;
}) {
  const gm = googleMapsUrl(doc);
  const note = doc.arrival?.note?.trim();
  return (
    <div className="panel flex w-full max-w-sm flex-col gap-3 p-4">
      <h2 className="text-lg font-semibold text-ink">{PLAYER.arrived}</h2>
      {note ? <p className="whitespace-pre-line text-[15px] text-ink-2">{note}</p> : null}
      <div className="flex flex-col gap-2">
        {gm ? (
          <a className="btn btn-primary w-full" href={gm} target="_blank" rel="noopener noreferrer">
            <ArrowSquareOut size={18} weight="bold" aria-hidden="true" />
            {PLAYER.openGoogleMaps}
          </a>
        ) : null}
        <button type="button" className="btn w-full" onClick={onReplay}>
          <ArrowCounterClockwise size={18} weight="bold" aria-hidden="true" />
          {PLAYER.replay}
        </button>
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
  const shell =
    variant === "preview"
      ? "fixed inset-0 z-50 overflow-y-auto bg-bg"
      : embed
        ? "h-full w-full overflow-y-auto rounded-[12px] bg-surface"
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
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
        <p role="status" className="panel p-3 text-sm text-ink-2">
          {note}
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
