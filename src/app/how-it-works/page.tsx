import {
  ArrowDown,
  ArrowRight,
  PersonSimpleBike,
  Car,
  Crosshair,
  DeviceMobile,
  NavigationArrow,
  PersonSimpleRun,
  PersonSimpleWalk,
  ShareFat,
  ShieldCheck,
  Signpost,
  SpeakerHigh,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { Metadata } from "next";
import Link from "next/link";
import DirectionPlate from "@/components/landing/DirectionPlate";
import { examplePlate } from "@/components/landing/examplePlate";
import HearExample from "@/components/landing/HearExample";
import Travellers from "@/components/landing/Travellers";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { ACTIVITIES, ACTIVITY_ORDER, type Activity } from "@/lib/nav";
import { t as editor } from "@/strings/editor";
import { ACTIVITY_LABEL } from "@/strings/nav";
import { guide, site } from "@/strings/pages";

export const metadata: Metadata = {
  title: guide.title,
  description: guide.metaDescription,
  alternates: { canonical: "/how-it-works" },
};

const CHAPTER_ICON: Record<string, Icon> = { directions: NavigationArrow, share: ShareFat, offline: ShieldCheck };
const ACTIVITY_ICON: Record<Activity, Icon> = { walk: PersonSimpleWalk, run: PersonSimpleRun, cycle: PersonSimpleBike, drive: Car };
const STAGES = [editor.stages.where, editor.stages.route, editor.stages.directions, editor.stages.send];
const { plate, spoken, lastLeg } = examplePlate();

function Chapter({ id, tone, children }: { id: string; tone?: "surface"; children: React.ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-20 border-t border-line ${tone === "surface" ? "bg-surface" : ""}`}>
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">{children}</div>
    </section>
  );
}

function ChapterHead({ icon: I, title, lead }: { icon: Icon; title: string; lead: string }) {
  return (
    <header className="max-w-3xl">
      <span className="grid size-14 place-items-center rounded-[14px] bg-accent text-accent-ink">
        <I size={30} weight="bold" aria-hidden />
      </span>
      <h2 className="mt-5 text-[1.6rem] font-black leading-[1.04] tracking-[-0.02em] text-balance min-[360px]:text-[2.1rem] sm:text-[3rem]">{title}</h2>
      {lead ? <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-pretty text-ink-2">{lead}</p> : null}
    </header>
  );
}

function Block({ title, children, icon: I }: { title: string; children: React.ReactNode; icon?: Icon }) {
  return (
    <div className="min-w-0">
      <h3 className="flex items-center gap-2.5 text-xl font-extrabold tracking-[-0.01em] text-balance sm:text-2xl">
        {I ? <I size={24} weight="bold" className="shrink-0" aria-hidden /> : null}
        {title}
      </h3>
      <div className="mt-3 leading-relaxed text-pretty text-ink-2">{children}</div>
    </div>
  );
}

export default function HowItWorks() {
  const d = guide.directions;
  const s = guide.share;
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end lg:gap-14 lg:pb-20 lg:pt-16">
          <div>
            <h1 className="text-[2rem] font-black leading-[1.02] tracking-[-0.025em] text-balance min-[360px]:text-[2.5rem] sm:text-[3.75rem]">{guide.title}</h1>
            <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-pretty text-ink-2 sm:text-xl">{guide.lead}</p>
          </div>
          <nav aria-label={guide.title} className="sign p-2">
            <ul className="divide-y divide-[color-mix(in_srgb,var(--sign-ink)_16%,transparent)]">
              {guide.chapters.map((c) => {
                const I = CHAPTER_ICON[c.id];
                return (
                  <li key={c.id}>
                    <a href={`#${c.id}`} className="group flex min-h-16 items-center gap-4 rounded-[12px] px-3 py-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-sign-ink text-sign">
                        <I size={22} weight="bold" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[1.0625rem] font-extrabold min-[360px]:text-lg">{c.label}</span>
                        <span className="block text-[0.8125rem] text-pretty opacity-75 min-[360px]:text-sm">{c.body}</span>
                      </span>
                      <ArrowDown size={22} weight="bold" className="hidden shrink-0 transition-transform group-hover:translate-y-0.5 min-[360px]:block" aria-hidden />
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </section>

        <Chapter id="directions" tone="surface">
          <ChapterHead icon={NavigationArrow} title={d.title} lead={d.lead} />
          <div className="mt-14 grid gap-14 lg:grid-cols-2 lg:gap-x-16 lg:gap-y-16">
            <Block title={d.moving.title}>
              <p>{d.moving.body}</p>
              <ul className="mt-5 divide-y divide-line rounded-[18px] border-[1.5px] border-line bg-bg">
                {ACTIVITY_ORDER.map((a) => {
                  const I = ACTIVITY_ICON[a];
                  const info = ACTIVITIES[a];
                  return (
                    <li key={a} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                      <span className="grid size-11 place-items-center rounded-[12px] bg-surface-2 text-ink">
                        <I size={24} weight="bold" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-extrabold text-ink">{ACTIVITY_LABEL[a]}</span>
                        <span className="num block text-sm text-ink-3">{d.moving.speed(info.speedKmh)}</span>
                      </span>
                      <span className="col-start-2 text-sm text-ink-3 sm:col-start-auto sm:text-right">
                        {d.moving.warn(info.thresholds[0], info.thresholds[1])}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Block>

            <Block title={d.options.title}>
              <p>{d.options.body}</p>
              <div className="mt-5 grid gap-3 rounded-[18px] border-[1.5px] border-line bg-bg p-4 sm:p-5">
                {[
                  { tag: "Shortest", time: d.options.tagTime, selected: true, body: d.options.shortestBody },
                  { tag: d.options.exampleLonger, time: d.options.tagTimeLonger, selected: false, body: d.options.longerBody },
                ].map((o) => (
                  <div key={o.tag} className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4">
                    <span
                      className={`min-h-11 whitespace-nowrap rounded-[10px] border-[1.5px] px-2 py-1 text-[13px] font-bold leading-tight shadow-float ${
                        o.selected ? "border-sign bg-sign text-sign-ink" : "border-line bg-surface text-ink"
                      }`}
                    >
                      <span className="block">{o.tag}</span>
                      <span className="num block font-semibold opacity-80">{o.time}</span>
                    </span>
                    <span className="text-[0.9375rem] text-pretty">{o.body}</span>
                  </div>
                ))}
              </div>
            </Block>

            <div className="grid gap-8 lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
              <Block title={d.voice.title} icon={SpeakerHigh}>
                <p>{d.voice.body}</p>
                <div className="mt-6">
                  <HearExample lines={spoken} />
                </div>
              </Block>
              <figure>
                <DirectionPlate now={plate[0]} next={plate.slice(1)} label={d.voice.caption} />
                <figcaption className="mt-3 px-1 text-sm text-ink-3">
                  {d.voice.caption}: {lastLeg.to.label}
                </figcaption>
              </figure>
            </div>

            <Block title={d.reroute.title} icon={Signpost}>
              <p>{d.reroute.body(ACTIVITIES.walk.offRouteM, ACTIVITIES.drive.offRouteM)}</p>
            </Block>
            <Block title={d.awake.title} icon={DeviceMobile}>
              <p>{d.awake.body}</p>
            </Block>
          </div>
          <Link href={site.go.href} className="btn btn-primary btn-lg mt-14">
            <NavigationArrow size={20} weight="fill" aria-hidden />
            {d.cta}
          </Link>
        </Chapter>

        <Chapter id="share">
          <ChapterHead icon={ShareFat} title={s.title} lead={s.lead} />
          <h3 className="mt-14 text-xl font-extrabold sm:text-2xl">{s.stagesTitle}</h3>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((st, i) => (
              <li key={st.rail} className="flex gap-4 rounded-[18px] border-[1.5px] border-line bg-surface p-4 lg:flex-col lg:p-5">
                <span className="num grid size-11 shrink-0 place-items-center rounded-[12px] bg-accent text-lg font-bold text-accent-ink">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-lg font-extrabold">{st.rail}</span>
                  <span className="mt-1 block text-[0.9375rem] leading-relaxed text-balance text-ink-2">{st.lead}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
            <Block title={s.askTitle} icon={Crosshair}>
              <p>{s.askBody}</p>
              <ol className="mt-5 grid gap-2">
                {editor.ask.steps.map((step, i) => (
                  <li key={step} className="flex min-h-12 items-center gap-3 rounded-[14px] bg-surface-2 px-4 py-2 font-semibold text-ink">
                    <span className="num text-ink-3">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </Block>
            <Block title={s.guestTitle}>
              <p>{s.guestBody}</p>
              <ul className="mt-4 grid gap-2">
                {s.guestPoints.map((p) => (
                  <li key={p} className="flex gap-3 font-semibold text-ink">
                    <ArrowRight size={20} weight="bold" className="mt-0.5 shrink-0" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </Block>
          </div>
          <div className="mt-10">
            <Travellers />
          </div>
          <Link href={site.share.href} className="btn btn-sign btn-lg mt-12">
            <ShareFat size={20} weight="fill" aria-hidden />
            {s.cta}
          </Link>
        </Chapter>

        <Chapter id="offline" tone="surface">
          <ChapterHead icon={ShieldCheck} title={guide.offline.title} lead="" />
          <dl className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-3">
            {guide.offline.points.map((p) => (
              <div key={p.title} className="border-t-[3px] border-ink pt-4">
                <dt className="text-xl font-extrabold text-balance">{p.title}</dt>
                <dd className="mt-2 leading-relaxed text-pretty text-ink-2">{p.body}</dd>
              </div>
            ))}
          </dl>
          <Link href={site.privacy.href} className="btn btn-lg mt-10">
            {guide.offline.more}
            <ArrowRight size={20} weight="bold" aria-hidden />
          </Link>
        </Chapter>
      </main>
      <SiteFooter />
    </>
  );
}
