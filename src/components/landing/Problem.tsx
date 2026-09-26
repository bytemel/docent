import {
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowUUpLeft,
  Bicycle,
  Car,
  FlagCheckered,
  MapPin,
  Motorcycle,
  NavigationArrow,
  PersonSimpleWalk,
  Van,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { segmentOffsets } from "@/lib/steps";
import type { Mode, RouteDoc, Step } from "@/lib/types";
import { landing } from "@/strings/common";

const MODE_ICON: Record<Mode, Icon> = { walk: PersonSimpleWalk, boda: Motorcycle, matatu: Van, car: Car, bike: Bicycle };

function stepIcon(step: Step, doc: RouteDoc): Icon {
  if (step.kind === "start") return NavigationArrow;
  if (step.kind === "arrive") return FlagCheckered;
  if (step.kind === "landmark") return MapPin;
  if (step.kind === "turn") {
    if (/u-turn/i.test(step.text)) return ArrowUUpLeft;
    return /right/i.test(step.text) ? ArrowBendUpRight : ArrowBendUpLeft;
  }
  const offsets = segmentOffsets(doc.segments);
  let i = 0;
  while (i + 1 < offsets.length && offsets[i + 1] <= step.atM + 1) i++;
  return MODE_ICON[doc.segments[i]?.mode ?? "walk"];
}

export default function Problem({ doc, link, chars }: { doc: RouteDoc; link: string; chars: number }) {
  const copy = landing.problem;
  return (
    <section className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <h2 className="max-w-[18ch] text-[2rem] font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
          {copy.title}
        </h2>
        <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-ink-2">{copy.body}</p>

        <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <ul className="flex min-w-0 flex-col gap-9">
            {copy.sent.map((q, i) => (
              <li key={q.text} className={i % 2 ? "sm:pl-12" : undefined}>
                <p className="text-[1.75rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
                  <span className="text-accent">&ldquo;</span>
                  {q.text}
                  <span className="text-accent">&rdquo;</span>
                </p>
                {q.gloss ? <p className="mt-2 text-sm text-ink-3">{q.gloss}</p> : null}
              </li>
            ))}
          </ul>

          <div className="min-w-0 rounded-[12px] border border-line bg-surface p-5 shadow-float sm:p-7">
            <h3 className="text-xl font-semibold tracking-tight">{copy.insteadTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{copy.insteadBody}</p>
            <ol className="mt-6 flex flex-col gap-3">
              {doc.steps.map((s) => {
                const I = stepIcon(s, doc);
                return (
                  <li key={s.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-3 text-[0.9375rem] leading-snug">
                    <I size={20} weight={s.kind === "mode" ? "fill" : "regular"} className="mt-px text-ink-3" aria-hidden />
                    <span>{s.text}</span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-7 border-t border-line pt-5">
              <p className="truncate font-mono text-xs text-ink-3" translate="no">
                {link}
              </p>
              <p className="mt-2 text-sm text-ink-2">{copy.linkNote(chars.toLocaleString("en-GB"))}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
