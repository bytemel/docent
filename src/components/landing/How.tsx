import { Crosshair, PaperPlaneTilt, Path } from "@phosphor-icons/react/dist/ssr";
import { totalMeters } from "@/app/r/og-params";
import type { RouteDoc } from "@/lib/types";
import { landing } from "@/strings/common";
import RouteSketch from "./RouteSketch";

export default function How({ doc, link }: { doc: RouteDoc; link: string }) {
  const copy = landing.how;
  const total = totalMeters(doc);
  const lastLeg = doc.segments[doc.segments.length - 1];
  const stop = lastLeg?.from.label ?? "";
  const end = lastLeg?.to.label ?? "";
  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <h2 className="text-[2rem] font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">{copy.title}</h2>

        <div className="mt-12 grid gap-4 lg:grid-cols-12 lg:gap-5">
          <article className="relative flex min-h-80 min-w-0 flex-col overflow-hidden rounded-[12px] bg-accent-soft p-6 pb-40 sm:p-8 sm:pb-40 lg:col-span-5 lg:pb-8">
            <Crosshair size={40} weight="duotone" className="text-accent" aria-hidden />
            <h3 className="mt-6 text-2xl font-semibold tracking-tight">{copy.ask.title}</h3>
            <p className="relative mt-3 max-w-[40ch] leading-relaxed text-ink-2">{copy.ask.body}</p>
            <svg viewBox="0 0 240 240" className="pointer-events-none absolute -bottom-24 -right-20 w-72 text-accent" aria-hidden="true">
              {[108, 80, 52].map((r, i) => (
                <circle key={r} cx="120" cy="120" r={r} fill="none" stroke="currentColor" strokeWidth="2" opacity={0.18 + i * 0.14} />
              ))}
              <circle cx="120" cy="120" r="14" fill="currentColor" />
              <circle cx="120" cy="120" r="14" fill="none" stroke="var(--accent-soft)" strokeWidth="4" />
            </svg>
          </article>

          <article className="grid min-w-0 gap-6 rounded-[12px] border border-line bg-bg p-6 sm:p-8 lg:col-span-7">
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <Path size={28} weight="bold" className="mt-0.5 shrink-0 text-ink" aria-hidden />
              <div>
                <h3 className="text-2xl font-semibold tracking-tight">{copy.shape.title}</h3>
                <p className="mt-3 max-w-[52ch] leading-relaxed text-ink-2">{copy.shape.body}</p>
              </div>
            </div>
            <div className="self-end">
              <RouteSketch doc={doc} fromM={total - 1150} width={640} height={260} stroke={8} landmarks className="h-auto w-full" />
              <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-3">
                <span className="inline-flex items-center gap-2">
                  <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                    <circle cx="8" cy="8" r="5.5" style={{ fill: "var(--surface)", stroke: "var(--ink)" }} strokeWidth="2.5" />
                  </svg>
                  {stop}
                </span>
                <span className="inline-flex items-center gap-2">
                  <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                    <circle cx="8" cy="8" r="6" style={{ fill: "var(--ink)" }} />
                  </svg>
                  {end}
                </span>
              </p>
            </div>
          </article>

          <article className="grid min-w-0 gap-8 overflow-hidden rounded-[12px] bg-ink p-6 text-bg sm:p-8 lg:col-span-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
            <div>
              <PaperPlaneTilt size={32} weight="fill" className="text-accent" aria-hidden />
              <h3 className="mt-6 text-2xl font-semibold tracking-tight">{copy.send.title}</h3>
              <p className="mt-3 max-w-[44ch] leading-relaxed opacity-80">{copy.send.body}</p>
            </div>
            <p
              className="max-h-40 overflow-hidden break-all font-mono text-sm leading-relaxed opacity-70 [mask-image:linear-gradient(to_bottom,black_45%,transparent)]"
              translate="no"
              aria-hidden="true"
            >
              {link}
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
