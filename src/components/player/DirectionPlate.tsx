"use client";

import type { RefObject } from "react";
import {
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowUUpLeft,
  Bicycle,
  Bus,
  Car,
  FlagCheckered,
  Motorcycle,
  NavigationArrow,
  PersonSimpleWalk,
  Signpost,
  type Icon,
} from "@phosphor-icons/react";
import VoiceToggle from "@/components/ui/VoiceToggle";
import type { Step } from "@/lib/types";
import { GLYPH_LABEL, PLAYER } from "@/strings/player";
import { plateText, type Glyph } from "./glyph";

export const GLYPH_ICON: Record<Glyph, Icon> = {
  start: NavigationArrow,
  arrive: FlagCheckered,
  left: ArrowBendUpLeft,
  right: ArrowBendUpRight,
  slightLeft: ArrowUpLeft,
  slightRight: ArrowUpRight,
  uturn: ArrowUUpLeft,
  straight: ArrowUp,
  landmark: Signpost,
  walk: PersonSimpleWalk,
  boda: Motorcycle,
  matatu: Bus,
  car: Car,
  bike: Bicycle,
};

export function GlyphTile({ glyph, size = "md", tone = "accent" }: { glyph: Glyph; size?: "sm" | "md" | "lg"; tone?: "accent" | "plain" }) {
  const I = GLYPH_ICON[glyph] ?? ArrowUp;
  const box = size === "lg" ? "h-16 w-16 rounded-[14px]" : size === "md" ? "h-11 w-11 rounded-[12px]" : "h-9 w-9 rounded-[10px]";
  const px = size === "lg" ? 44 : size === "md" ? 26 : 20;
  const colour = tone === "accent" ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink";
  return (
    <span className={`flex shrink-0 items-center justify-center ${box} ${colour}`} aria-hidden="true">
      <I size={px} weight="bold" />
    </span>
  );
}

export default function DirectionPlate({
  steps,
  index,
  glyph,
  next,
  distRef,
  live,
  onRepeat,
}: {
  steps: Step[];
  index: number;
  glyph: Glyph;
  next: Step | undefined;
  distRef: RefObject<HTMLSpanElement | null>;
  live: boolean;
  onRepeat: () => void;
}) {
  const step = steps[index];
  const text = step ? plateText(step.text) : PLAYER.noSteps;
  return (
    <div className="flex flex-col gap-2">
      <div className="sign flex items-stretch gap-2 p-2.5 sm:p-3">
        <button
          type="button"
          onClick={onRepeat}
          title={PLAYER.repeatStep}
          aria-label={`${GLYPH_LABEL[glyph] ?? ""}. ${text} ${PLAYER.repeatStep}`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-[14px] p-1 text-left"
        >
          <GlyphTile glyph={glyph} size="lg" />
          <span key={index} className="dp-plate-in flex min-w-0 flex-col gap-1">
            {live ? (
              <span className="text-xs font-bold uppercase tracking-wide opacity-75">{PLAYER.now.replace(":", "")}</span>
            ) : (
              <span ref={distRef} className="num text-[28px] font-bold leading-none sm:text-[32px] empty:hidden" />
            )}
            <span className="text-[19px] font-bold leading-tight text-pretty sm:text-[21px]">{text}</span>
          </span>
        </button>
        <VoiceToggle className="shrink-0 self-start border-transparent" />
      </div>
      {next ? (
        <p className="flex min-w-0 items-baseline gap-2 px-1 text-sm text-ink-2">
          <span className="shrink-0 font-bold text-ink">{PLAYER.then}</span>
          <span className="line-clamp-2 text-pretty">{plateText(next.text)}</span>
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {text}
      </p>
    </div>
  );
}
