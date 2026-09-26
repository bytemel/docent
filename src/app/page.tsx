import { ArrowRight, CheckCircle, Play } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import DirectionPlate, { type PlateStep } from "@/components/landing/DirectionPlate";
import HearExample from "@/components/landing/HearExample";
import PaceTable from "@/components/landing/PaceTable";
import Plates from "@/components/landing/Plates";
import RegisterOffline from "@/components/landing/RegisterOffline";
import ResponsivePlayer from "@/components/landing/ResponsivePlayer";
import RouteSketch from "@/components/landing/RouteSketch";
import SavedRoutes from "@/components/landing/SavedRoutes";
import { plainStep, stepIcon } from "@/components/landing/stepIcon";
import Travellers from "@/components/landing/Travellers";
import { EXAMPLE_DOC } from "@/lib/example";
import { formatDistance, lineLength } from "@/lib/geo";
import { encodeDoc } from "@/lib/share";
import { brand, landing } from "@/strings/common";
import { totalMeters } from "./r/og-params";
import { Wordmark } from "./r/mark";

const encoded = encodeDoc(EXAMPLE_DOC);
const exampleHref = `/r?d=${encoded}`;
const lastLeg = EXAMPLE_DOC.segments[EXAMPLE_DOC.segments.length - 1];
const lastLegMeters = lineLength(lastLeg.geometry);
const total = totalMeters(EXAMPLE_DOC);

const walkSteps = EXAMPLE_DOC.steps.filter((s) => s.atM > total - lastLegMeters && (s.kind === "turn" || s.kind === "arrive"));
const plate: PlateStep[] = walkSteps.slice(0, 3).map((s) => {
  const prev = EXAMPLE_DOC.steps[EXAMPLE_DOC.steps.indexOf(s) - 1];
  return { Icon: stepIcon(s, EXAMPLE_DOC), distance: formatDistance(s.atM - (prev?.atM ?? 0)), text: plainStep(s.text) };
});
const spoken = plate.map((p) => landing.voice.spoken(p.distance, p.text.charAt(0).toLowerCase() + p.text.slice(1)));

function Section({ children, tone = "bg", id }: { children: React.ReactNode; tone?: "bg" | "surface" | "sign"; id?: string }) {
  const bg = tone === "surface" ? "bg-surface" : tone === "sign" ? "bg-sign text-sign-ink" : "";
  return (
    <section id={id} className={`${bg} ${tone === "bg" ? "border-t border-line" : ""}`}>
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">{children}</div>
    </section>
  );
}

function H2({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-[2.1rem] font-black leading-[1.04] tracking-[-0.02em] text-balance sm:text-[3.25rem] ${className}`}>
      {children}
    </h2>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-4 sm:px-8 lg:min-h-[min(100svh,900px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-14 lg:pb-20">
          <div className="flex min-w-0 flex-col gap-7 lg:py-10">
            <Wordmark />
            <div>
              <h1 className="text-[2.5rem] font-black leading-[1.02] tracking-[-0.025em] text-balance min-[400px]:text-[2.85rem] sm:text-[3.6rem] xl:text-[4.25rem]">
                {landing.headline}
              </h1>
              <p className="mt-4 max-w-[36ch] text-lg leading-relaxed text-ink-2 sm:text-xl">{landing.subtext}</p>
            </div>
            <Plates />
            <SavedRoutes />
          </div>
          <figure className="relative hidden h-[min(80svh,760px)] min-h-[560px] overflow-hidden rounded-[18px] border border-line bg-surface-2 shadow-float lg:block">
            <RouteSketch doc={EXAMPLE_DOC} width={640} height={760} stroke={6} className="absolute inset-0 h-full w-full p-10 opacity-40" />
            <div className="absolute inset-0" role="region" aria-label={landing.exampleFrameLabel}>
              <ResponsivePlayer when="wide" />
            </div>
          </figure>
        </section>
        <RegisterOffline />

        <Section>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <H2 className="max-w-[16ch]">{landing.pin.title}</H2>
              <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-2">{landing.pin.body}</p>
            </div>
            <ul className="flex flex-col gap-7 lg:pt-3">
              {landing.pin.quotes.map((q) => (
                <li key={q.text}>
                  <p className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.015em] sm:text-[2rem]">
                    <span className="text-accent-text">&ldquo;</span>
                    {q.text}
                    <span className="text-accent-text">&rdquo;</span>
                  </p>
                  {q.gloss ? <p className="mt-1.5 text-[0.9375rem] text-ink-3">{q.gloss}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section tone="sign">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
            <div>
              <H2 className="max-w-[15ch]">{landing.voice.title}</H2>
              <p className="mt-5 max-w-[44ch] text-lg leading-relaxed opacity-80">{landing.voice.body}</p>
              <div className="mt-8">
                <HearExample lines={spoken} />
              </div>
            </div>
            <div>
              <DirectionPlate now={plate[0]} next={plate.slice(1)} label={landing.voice.title} />
              <p className="mt-3 px-1 text-sm opacity-70">
                {landing.voice.caption(lastLeg.from.label ?? "", lastLeg.to.label ?? "")}
              </p>
            </div>
          </div>
        </Section>

        <Section>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <H2 className="max-w-[14ch]">{landing.move.title}</H2>
              <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-2">{landing.move.body}</p>
            </div>
            <PaceTable meters={lastLegMeters} />
          </div>
        </Section>

        <Section tone="surface">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div className="relative h-[70svh] max-h-[620px] min-h-[440px] overflow-hidden rounded-[18px] border border-line bg-surface-2 lg:order-2 lg:h-[560px]">
              <RouteSketch doc={EXAMPLE_DOC} fromM={total - 1150} width={640} height={640} stroke={9} landmarks className="absolute inset-0 h-full w-full p-10" />
              <div className="absolute inset-0 lg:hidden" role="region" aria-label={landing.exampleFrameLabel}>
                <ResponsivePlayer when="narrow" />
              </div>
              <Link href={exampleHref} className="btn btn-sign btn-lg absolute bottom-5 left-5 hidden shadow-float lg:inline-flex">
                <Play size={20} weight="fill" aria-hidden />
                {landing.example}
              </Link>
            </div>
            <div>
              <H2 className="max-w-[16ch]">{landing.shareStory.title}</H2>
              <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-2">{landing.shareStory.body}</p>
              <ul className="mt-7 flex flex-col gap-3">
                {landing.shareStory.points.map((p) => (
                  <li key={p} className="flex gap-3 text-[1.0625rem] font-semibold">
                    <CheckCircle size={24} weight="fill" className="mt-px shrink-0 text-ink" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={landing.share.href} className="btn btn-sign btn-lg">
                  {landing.share.title}
                  <ArrowRight size={20} weight="bold" aria-hidden />
                </Link>
                <Link href={exampleHref} className="btn btn-lg lg:hidden">
                  <Play size={20} weight="fill" aria-hidden />
                  {landing.example}
                </Link>
              </div>
            </div>
          </div>
        </Section>

        <Section>
          <H2 className="max-w-[16ch]">{landing.travellers.title}</H2>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-ink-2">{landing.travellers.body}</p>
          <div className="mt-10">
            <Travellers />
          </div>
        </Section>

        <Section tone="surface">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div>
              <H2 className="max-w-[14ch]">{landing.phones.title}</H2>
              <p className="mt-10 flex flex-wrap items-baseline gap-x-3">
                <span className="num text-[3.5rem] font-bold leading-none tracking-[-0.04em] sm:text-[4.5rem]">
                  {encoded.length.toLocaleString("en-GB")}
                </span>
                <span className="text-2xl font-extrabold">{landing.phones.charsUnit}</span>
              </p>
              <p className="mt-3 max-w-[38ch] text-[0.9375rem] leading-relaxed text-ink-2">{landing.phones.charsBody}</p>
            </div>
            <dl className="grid content-start gap-x-10 gap-y-9 sm:grid-cols-2 lg:pt-3">
              {landing.phones.facts.map((f) => (
                <div key={f.title} className="border-t-[3px] border-ink pt-4">
                  <dt className="text-xl font-extrabold">{f.title}</dt>
                  <dd className="mt-1.5 leading-relaxed text-ink-2">{f.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>

        <Section>
          <H2>{landing.closing.title}</H2>
          <div className="mt-8">
            <Plates ask={false} size="md" />
          </div>
        </Section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {new Date().getFullYear()} {brand.name}
          </p>
          <p>{brand.attribution}</p>
        </div>
      </footer>
    </div>
  );
}
