import { ArrowRight, Bicycle, Car, Motorcycle, PersonSimpleWalk, Play, Van } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import PlayerClient from "@/components/player/PlayerClient";
import { EXAMPLE_DOC } from "@/lib/example";
import { MODE_ORDER, MODES } from "@/lib/modes";
import { encodeDoc } from "@/lib/share";
import type { Mode } from "@/lib/types";
import { brand, landing } from "@/strings/common";
import { Wordmark } from "./r/mark";

const MODE_ICON = {
  walk: PersonSimpleWalk,
  boda: Motorcycle,
  matatu: Van,
  car: Car,
  bike: Bicycle,
} satisfies Record<Mode, unknown>;

const exampleHref = `/r?d=${encodeDoc(EXAMPLE_DOC)}`;

function ModeLine({ mode }: { mode: Mode }) {
  const info = MODES[mode];
  return (
    <svg viewBox="0 0 64 8" className="h-2 w-16" aria-hidden="true">
      <line
        x1="4"
        y1="4"
        x2="60"
        y2="4"
        stroke={info.color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={info.dashed ? "0.5 7" : undefined}
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8">
        <Wordmark />
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-14 lg:pb-24 lg:pt-12">
          <div className="min-w-0">
            <h1 className="max-w-[20ch] text-[1.75rem] font-semibold min-[380px]:text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl xl:text-[3.25rem]">
              {landing.headline}
            </h1>
            <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-ink-2">{landing.subtext}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/new" className="btn btn-primary">
                {landing.make}
                <ArrowRight size={18} weight="bold" aria-hidden />
              </Link>
              <Link href={exampleHref} className="btn">
                <Play size={16} weight="fill" aria-hidden />
                {landing.example}
              </Link>
            </div>
          </div>
          <div
            className="relative h-[440px] min-w-0 overflow-hidden rounded-[12px] border border-line bg-surface shadow-float sm:h-[500px] lg:h-[560px]"
            aria-label={landing.exampleFrameLabel}
            role="region"
          >
            <PlayerClient doc={EXAMPLE_DOC} variant="embed" autoplay />
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-14 lg:py-24">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{landing.howTitle}</h2>
            <ol className="min-w-0 divide-y divide-line">
              {landing.how.map((item) => (
                <li
                  key={item.title}
                  className="grid gap-2 py-6 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-8"
                >
                  <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
                  <p className="leading-relaxed text-ink-2">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
            <h2 className="max-w-[22ch] text-3xl font-semibold tracking-tight sm:text-4xl">{landing.modesTitle}</h2>
            <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-ink-2">{landing.modesBody}</p>
            <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              {MODE_ORDER.map((mode) => {
                const Icon = MODE_ICON[mode];
                return (
                  <li key={mode} className="flex min-w-0 flex-col gap-3 sm:last:col-span-2 lg:last:col-span-1">
                    <div className="flex items-center gap-3">
                      <Icon size={24} className="text-ink" aria-hidden />
                      <ModeLine mode={mode} />
                    </div>
                    <h3 className="font-semibold">{MODES[mode].label}</h3>
                    <p className="text-sm leading-relaxed text-ink-2">{landing.modes[mode]}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {new Date().getFullYear()} {brand.name}
          </p>
          <p>{brand.attribution}</p>
        </div>
      </footer>
    </div>
  );
}
