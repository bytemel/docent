"use client";

import type { RefObject } from "react";
import { CaretDown, CaretUp, CornersOut, Crosshair, Pause, Play } from "@phosphor-icons/react";
import type { Tier } from "@/lib/tier";
import type { Step } from "@/lib/types";
import { PLAYER, stepLabel, timeLabel } from "@/strings/player";

const SPEEDS = [1, 2, 4];
const TIERS: { id: Tier; label: string }[] = [
  { id: "3d", label: PLAYER.tier3d },
  { id: "2d", label: PLAYER.tier2d },
  { id: "basic", label: PLAYER.tierBasic },
];

export interface ControlsProps {
  steps: Step[];
  stepIndex: number;
  playing: boolean;
  totalS: number;
  speed: number;
  tier: Tier;
  showFollow: boolean;
  sheetOpen: boolean;
  scrubRef: RefObject<HTMLInputElement | null>;
  timeRef: RefObject<HTMLSpanElement | null>;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onDrag: (on: boolean) => void;
  onSpeed: (v: number) => void;
  onTier: (t: Tier) => void;
  onWhole: () => void;
  onFollow: () => void;
  onSheet: () => void;
}

export default function Controls({
  steps,
  stepIndex,
  playing,
  totalS,
  speed,
  tier,
  showFollow,
  sheetOpen,
  scrubRef,
  timeRef,
  onToggle,
  onSeek,
  onDrag,
  onSpeed,
  onTier,
  onWhole,
  onFollow,
  onSheet,
}: ControlsProps) {
  const current = steps[stepIndex];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <div aria-live="polite" aria-atomic="true" className="min-h-[3.25rem]">
        <p className="text-xs font-medium text-ink-3">
          {steps.length ? stepLabel(stepIndex, steps.length) : PLAYER.currentStep}
        </p>
        <p className="text-lg font-semibold leading-snug text-pretty text-ink">{current?.text ?? ""}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-primary h-14 min-h-14 w-14 shrink-0 p-0"
          aria-label={playing ? PLAYER.pause : PLAYER.play}
          onClick={onToggle}
        >
          {playing ? (
            <Pause size={26} weight="fill" aria-hidden="true" />
          ) : (
            <Play size={26} weight="fill" aria-hidden="true" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <input
            ref={scrubRef}
            type="range"
            min={0}
            max={totalS}
            step={0.05}
            defaultValue={0}
            aria-label={PLAYER.seek}
            className="h-7 w-full cursor-pointer accent-accent"
            onChange={(e) => onSeek(Number(e.currentTarget.value))}
            onPointerDown={() => onDrag(true)}
            onPointerUp={() => onDrag(false)}
            onPointerCancel={() => onDrag(false)}
          />
          <span ref={timeRef} className="text-xs tabular-nums text-ink-3">
            {`${timeLabel(0)} / ${timeLabel(totalS)}`}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={PLAYER.speed} className="flex gap-1">
          {SPEEDS.map((v) => (
            <button
              key={v}
              type="button"
              className="chip min-w-11 justify-center px-2.5"
              aria-pressed={speed === v}
              onClick={() => onSpeed(v)}
            >
              {v}x
            </button>
          ))}
        </div>
        <div role="group" aria-label={PLAYER.view} className="flex gap-1">
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="chip justify-center px-2.5"
              aria-pressed={tier === t.id}
              onClick={() => onTier(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="chip" onClick={onWhole}>
          <CornersOut size={16} weight="bold" aria-hidden="true" />
          {PLAYER.showWhole}
        </button>
        {showFollow ? (
          <button type="button" className="chip" onClick={onFollow}>
            <Crosshair size={16} weight="bold" aria-hidden="true" />
            {PLAYER.follow}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="btn btn-ghost min-h-10 w-full lg:hidden"
        aria-expanded={sheetOpen}
        onClick={onSheet}
      >
        {sheetOpen ? PLAYER.hideSteps : PLAYER.showSteps}
        {sheetOpen ? (
          <CaretDown size={16} weight="bold" aria-hidden="true" />
        ) : (
          <CaretUp size={16} weight="bold" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
