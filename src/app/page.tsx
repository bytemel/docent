import { ArrowRight, Play } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import How from "@/components/landing/How";
import Problem from "@/components/landing/Problem";
import RegisterOffline from "@/components/landing/RegisterOffline";
import RouteSketch from "@/components/landing/RouteSketch";
import SavedRoutes from "@/components/landing/SavedRoutes";
import Travellers from "@/components/landing/Travellers";
import PlayerClient from "@/components/player/PlayerClient";
import { EXAMPLE_DOC } from "@/lib/example";
import { formatDistance } from "@/lib/geo";
import { encodeDoc } from "@/lib/share";
import { brand, landing } from "@/strings/common";
import { modeList, totalMeters } from "./r/og-params";
import { Wordmark } from "./r/mark";

const encoded = encodeDoc(EXAMPLE_DOC);
const exampleHref = `/r?d=${encoded}`;
const chars = encoded.length.toLocaleString("en-GB");
const first = EXAMPLE_DOC.segments[0];
const last = EXAMPLE_DOC.segments[EXAMPLE_DOC.segments.length - 1];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Wordmark />
        <Link href="/new" className="btn btn-ghost hidden text-sm sm:inline-flex">
          {landing.make}
        </Link>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-8 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:items-center lg:gap-12 lg:pb-24 lg:pt-10">
          <div className="min-w-0">
            <h1 className="text-[2rem] font-semibold leading-[1.04] tracking-tight text-balance min-[360px]:text-[2.3rem] sm:text-5xl lg:text-[3rem] xl:text-[3.25rem]">
              {landing.headline}
            </h1>
            <p className="mt-5 max-w-[38ch] text-lg leading-relaxed text-ink-2">{landing.subtext}</p>
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
          <figure className="min-w-0">
            <div
              className="relative h-[68svh] max-h-[620px] min-h-[420px] overflow-hidden rounded-[12px] border border-line bg-surface-2 shadow-float lg:h-[640px] lg:max-h-none"
              role="region"
              aria-label={landing.exampleFrameLabel}
            >
              <RouteSketch doc={EXAMPLE_DOC} width={640} height={640} stroke={5} className="absolute inset-0 h-full w-full p-8 opacity-40" />
              <div className="absolute inset-0">
                <PlayerClient doc={EXAMPLE_DOC} variant="embed" autoplay />
              </div>
            </div>
            <figcaption className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 px-1 text-sm text-ink-3">
              <span>
                {first.from.label} to {last.to.label}
              </span>
              <span>{landing.exampleCaption(formatDistance(totalMeters(EXAMPLE_DOC)), modeList(EXAMPLE_DOC))}</span>
            </figcaption>
          </figure>
        </section>

        <SavedRoutes />
        <RegisterOffline />
        <Problem doc={EXAMPLE_DOC} link={exampleHref} chars={encoded.length} />
        <How doc={EXAMPLE_DOC} link={exampleHref} />

        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
            <h2 className="max-w-[18ch] text-[2rem] font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
              {landing.travellers.title}
            </h2>
            <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-ink-2">{landing.travellers.body}</p>
            <div className="mt-10">
              <Travellers />
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-28">
            <div className="min-w-0">
              <h2 className="max-w-[16ch] text-[2rem] font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
                {landing.phones.title}
              </h2>
              <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-ink-2">{landing.phones.body}</p>
              <p className="mt-10 text-5xl font-semibold tracking-tight text-accent sm:text-6xl">
                {landing.phones.linkTitle(chars)}
              </p>
              <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-ink-2">{landing.phones.linkBody}</p>
            </div>
            <dl className="grid min-w-0 content-start gap-x-10 gap-y-10 sm:grid-cols-2 lg:pt-3">
              {landing.phones.facts.map((f) => (
                <div key={f.title} className="border-t border-line pt-5">
                  <dt className="text-lg font-semibold">{f.title}</dt>
                  <dd className="mt-2 leading-relaxed text-ink-2">{f.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="bg-accent text-accent-ink">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-20">
            <div className="min-w-0">
              <h2 className="max-w-[22ch] text-[2rem] font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
                {landing.closing.title}
              </h2>
              <p className="mt-4 max-w-[48ch] text-lg leading-relaxed opacity-90">{landing.closing.body}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/new" className="btn border-transparent">
                {landing.make}
                <ArrowRight size={18} weight="bold" aria-hidden />
              </Link>
              <Link href={exampleHref} className="btn btn-ghost border-current text-accent-ink">
                <Play size={16} weight="fill" aria-hidden />
                {landing.example}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          © {new Date().getFullYear()} {brand.name}
        </p>
        <p>{brand.attribution}</p>
      </footer>
    </div>
  );
}
