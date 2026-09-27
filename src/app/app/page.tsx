import { DotsThreeVertical, Export, LinkSimple, LockSimple, SpeakerSimpleHigh } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { Metadata } from "next";
import AppDownload from "@/components/site/AppDownload";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { appPage as t } from "@/strings/pages";

export const metadata: Metadata = {
  title: t.title,
  description: t.metaDescription,
  alternates: { canonical: "/app" },
};

const WHY_ICON: Icon[] = [LockSimple, SpeakerSimpleHigh, LinkSimple];

function Steps({ title, steps, icon: I }: { title: string; steps: string[]; icon: Icon }) {
  return (
    <div className="min-w-0 rounded-[18px] border-[1.5px] border-line bg-surface p-5 sm:p-6">
      <h3 className="flex items-center gap-2.5 text-xl font-extrabold">
        <I size={24} weight="bold" aria-hidden />
        {title}
      </h3>
      <ol className="mt-4 grid gap-3">
        {steps.map((s, i) => (
          <li key={s} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3">
            <span className="num grid size-9 place-items-center rounded-[10px] bg-surface-2 font-bold">{i + 1}</span>
            <span className="pt-1.5 text-pretty">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function AppPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-5 pb-14 pt-10 sm:px-8 lg:pt-16">
          <h1 className="text-[2.5rem] font-black leading-[1.02] tracking-[-0.025em] text-balance sm:text-[3.75rem]">{t.title}</h1>
          <p className="mt-4 max-w-[50ch] text-lg leading-relaxed text-pretty text-ink-2 sm:text-xl">{t.lead}</p>
          <div className="mt-10">
            <AppDownload />
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16 lg:py-20">
            <h2 className="text-[2rem] font-black leading-[1.05] tracking-[-0.02em] text-balance sm:text-[2.75rem]">{t.whyTitle}</h2>
            <ul className="divide-y divide-line">
              {t.why.map((w, i) => {
                const I = WHY_ICON[i];
                return (
                  <li key={w.title} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                    <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-accent text-accent-ink">
                      <I size={26} weight="bold" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xl font-extrabold text-balance">{w.title}</span>
                      <span className="mt-1 block leading-relaxed text-pretty text-ink-2">{w.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <h2 className="text-[2rem] font-black leading-[1.05] tracking-[-0.02em] text-balance sm:text-[2.75rem]">{t.browserTitle}</h2>
            <p className="mt-3 max-w-[52ch] text-lg leading-relaxed text-pretty text-ink-2">{t.browserLead}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Steps title={t.androidSteps.title} steps={t.androidSteps.steps} icon={DotsThreeVertical} />
              <Steps title={t.iphoneSteps.title} steps={t.iphoneSteps.steps} icon={Export} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
