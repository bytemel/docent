"use client";

import {
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowElbowDownLeft,
  ArrowElbowDownRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowUUpLeft,
  Bus,
  FlagCheckered,
  SignOut,
  type Icon,
} from "@phosphor-icons/react";
import { formatDistance } from "@/lib/geo";
import type { Arrow } from "@/lib/nav";
import { NAV } from "@/strings/nav";

export const ARROW_ICON: Record<Arrow, Icon> = {
  straight: ArrowUp,
  "slight-left": ArrowUpLeft,
  left: ArrowBendUpLeft,
  "sharp-left": ArrowElbowDownLeft,
  "slight-right": ArrowUpRight,
  right: ArrowBendUpRight,
  "sharp-right": ArrowElbowDownRight,
  "u-turn": ArrowUUpLeft,
  board: Bus,
  alight: SignOut,
  arrive: FlagCheckered,
};

interface SignProps {
  arrow: Arrow;
  distanceM: number | null;
  text: string;
  next?: string | null;
  note?: string | null;
  onRepeat?: () => void;
  compact?: boolean;
}

export default function Sign({ arrow, distanceM, text, next, note, onRepeat, compact }: SignProps) {
  const I = ARROW_ICON[arrow];
  const body = (
    <>
      <span
        className={`flex shrink-0 items-center justify-center rounded-[14px] bg-accent text-accent-ink ${compact ? "size-16" : "size-20 sm:size-24"}`}
        aria-hidden
      >
        <I size={compact ? 44 : 60} weight="bold" />
      </span>
      <span className="min-w-0 flex-1">
        {distanceM !== null ? (
          <span className={`num block leading-none font-bold ${compact ? "text-[30px]" : "text-[38px] sm:text-[40px]"}`}>
            {formatDistance(distanceM).split(" ")[0]}
            <span className="ml-1 text-[0.55em]">{formatDistance(distanceM).split(" ")[1]}</span>
          </span>
        ) : null}
        <span
          key={text}
          className={`mt-1 block leading-tight font-bold text-balance ${compact ? "text-lg" : "text-[20px] sm:text-[24px]"}`}
        >
          {text}
        </span>
        {next ? <span className="mt-1.5 line-clamp-2 text-[15px] font-medium opacity-75">{NAV.then(next)}</span> : null}
        {note ? <span className="mt-2 inline-block rounded-[8px] bg-accent px-2 py-0.5 text-[15px] font-bold text-accent-ink">{note}</span> : null}
      </span>
    </>
  );
  if (!onRepeat) return <div className="sign flex items-center gap-4 p-4 shadow-float">{body}</div>;
  return (
    <button
      type="button"
      onClick={onRepeat}
      aria-label={`${text}. ${NAV.repeat}`}
      className="sign flex w-full items-center gap-4 p-4 text-left shadow-float active:scale-[0.99]"
    >
      {body}
    </button>
  );
}
