"use client";

import type { RefObject } from "react";
import { CornersOut, Crosshair, Pause, Play } from "@phosphor-icons/react";
import type { Tier } from "@/lib/tier";
import { PLAYER, timeLabel } from "@/strings/player";

const SPEEDS = [1, 2, 4];
const TIERS: { id: Tier; label: string }[] = [
  { id: "3d", label: PLAYER.tier3d },
  { id: "2d", label: PLAYER.tier2d },
  { id: "basic", label: PLAYER.tierBasic },
];

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-[14px] border-[1.5px] border-line bg-surface p-[3px]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className="min-h-[38px] min-w-11 rounded-[11px] px-3 text-sm font-bold text-ink-2 transition-colors aria-pressed:bg-sign aria-pressed:text-sign-ink"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface ControlsProps {
  playing: boolean;
  totalS: number;
  speed: number;
  tier: Tier;
  showFollow: boolean;
  scrubRef: RefObject<HTMLInputElement | null>;
  playRef: RefObject<HTMLButtonElement | null>;
  timeRef: RefObject<HTMLSpanElement | null>;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onDrag: (on: boolean) => void;
  onSpeed: (v: number) => void;
  onTier: (t: Tier) => void;
  onWhole: () => void;
  onFollow: () => void;
}

export default function Controls({
  playing,
  totalS,
  speed,
  tier,
  showFollow,
  scrubRef,
  playRef,
  timeRef,
  onToggle,
  onSeek,
  onDrag,
  onSpeed,
  onTier,
  onWhole,
  onFollow,
}: ControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          ref={playRef}
          type="button"
          className="btn btn-primary btn-lg h-14 w-14 shrink-0 p-0"
          aria-label={playing ? PLAYER.pause : PLAYER.play}
          onClick={onToggle}
        >
          {playing ? <Pause size={26} weight="fill" aria-hidden="true" /> : <Play size={26} weight="fill" aria-hidden="true" />}
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <input
            ref={scrubRef}
            type="range"
            min={0}
            max={totalS}
            step={0.05}
            defaultValue={0}
            aria-label={PLAYER.seek}
            className="dp-range"
            onChange={(e) => onSeek(Number(e.currentTarget.value))}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onDrag(true);
            }}
            onPointerUp={() => onDrag(false)}
            onPointerCancel={() => onDrag(false)}
          />
          <span ref={timeRef} className="num -mt-1 text-xs text-ink-3">
            {`${timeLabel(0)} / ${timeLabel(totalS)}`}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          {showFollow ? (
            <button
              type="button"
              className="btn btn-icon"
              aria-label={PLAYER.followTraveller}
              title={PLAYER.followTraveller}
              onClick={onFollow}
            >
              <Crosshair size={20} weight="bold" aria-hidden="true" />
            </button>
          ) : null}
          <button type="button" className="btn btn-icon" aria-label={PLAYER.showWhole} title={PLAYER.showWhole} onClick={onWhole}>
            <CornersOut size={20} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label={PLAYER.animationSpeed}
          options={SPEEDS.map((v) => ({ id: v, label: `${v}x` }))}
          value={speed}
          onChange={onSpeed}
        />
        <Segmented label={PLAYER.mapView} options={TIERS} value={tier} onChange={onTier} />
      </div>
    </div>
  );
}
