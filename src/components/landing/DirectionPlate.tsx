import type { Icon } from "@phosphor-icons/react";
import { SpeakerHigh } from "@phosphor-icons/react/dist/ssr";

export interface PlateStep {
  Icon: Icon;
  distance: string;
  text: string;
}

export default function DirectionPlate({ now, next, label }: { now: PlateStep; next: PlateStep[]; label: string }) {
  return (
    <div className="overflow-hidden rounded-[18px] bg-surface text-ink shadow-float" role="group" aria-label={label}>
      <div className="flex gap-4 p-5 sm:gap-5 sm:p-6">
        <span className="grid size-16 shrink-0 place-items-center rounded-[14px] bg-accent text-accent-ink sm:size-20">
          <now.Icon size={44} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-start justify-between gap-3">
            <span className="num text-[2.25rem] font-bold leading-none sm:text-[2.6rem]">{now.distance}</span>
            <SpeakerHigh size={24} weight="bold" className="mt-1 shrink-0 text-ink-3" aria-hidden />
          </p>
          <p className="mt-2 text-[1.3rem] font-bold leading-snug tracking-[-0.01em] text-pretty sm:text-[1.45rem]">{now.text}</p>
        </div>
      </div>
      <ol className="divide-y divide-line border-t border-line bg-surface-2/60">
        {next.map((s, i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3 sm:px-6">
            <s.Icon size={22} weight="bold" className="shrink-0 text-ink-2" aria-hidden />
            <span className="num w-16 shrink-0 text-sm font-semibold text-ink-2">{s.distance}</span>
            <span className="min-w-0 text-[0.9375rem] font-semibold">{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
