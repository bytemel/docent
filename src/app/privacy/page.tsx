import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { CONTACT_EMAIL, PRIVACY_UPDATED } from "@/lib/app";
import { privacyPage as t } from "@/strings/pages";

export const metadata: Metadata = {
  title: t.title,
  description: t.metaDescription,
  alternates: { canonical: "/privacy" },
};

const H2 = "scroll-mt-20 text-2xl font-black tracking-[-0.02em] text-balance sm:text-[1.75rem]";
const P = "mt-3 leading-relaxed text-pretty text-ink-2";

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-10 sm:px-8 lg:pt-16">
        <h1 className="text-[2.5rem] font-black leading-[1.02] tracking-[-0.025em] sm:text-[3.5rem]">{t.title}</h1>
        <p className="mt-3 text-ink-3">{t.updated(PRIVACY_UPDATED)}</p>

        <section aria-labelledby="summary" className="sign mt-8 p-6 sm:p-7">
          <h2 id="summary" className="text-xl font-black">
            {t.summaryTitle}
          </h2>
          <ul className="mt-4 grid gap-3">
            {t.summary.map((s) => (
              <li key={s} className="flex gap-3 text-pretty">
                <span className="mt-2 size-2 shrink-0 rounded-[2px] bg-accent" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-12 grid gap-12">
          {t.sections.map((s) => (
            <section key={s.id} aria-labelledby={s.id}>
              <h2 id={s.id} className={H2}>
                {s.title}
              </h2>
              {s.paras.map((p) => (
                <p key={p} className={P}>
                  {p}
                </p>
              ))}
            </section>
          ))}

          <section aria-labelledby="services">
            <h2 id="services" className={H2}>
              {t.thirdTitle}
            </h2>
            <p className={P}>{t.thirdLead}</p>
            <dl className="mt-5 divide-y divide-line rounded-[18px] border-[1.5px] border-line bg-surface">
              {t.third.map((x) => (
                <div key={x.name} className="p-4 sm:p-5">
                  <dt className="font-extrabold text-balance">{x.name}</dt>
                  <dd className="mt-1 leading-relaxed text-pretty text-ink-2">{x.what}</dd>
                </div>
              ))}
            </dl>
            <p className={P}>{t.thirdNote}</p>
          </section>

          <section aria-labelledby="children">
            <h2 id="children" className={H2}>
              {t.childrenTitle}
            </h2>
            <p className={P}>{t.children}</p>
          </section>

          <section aria-labelledby="rights">
            <h2 id="rights" className={H2}>
              {t.rightsTitle}
            </h2>
            {t.rights.map((p) => (
              <p key={p} className={P}>
                {p}
              </p>
            ))}
          </section>

          <section aria-labelledby="changes">
            <h2 id="changes" className={H2}>
              {t.changesTitle}
            </h2>
            <p className={P}>{t.changes}</p>
          </section>

          <section aria-labelledby="contact">
            <h2 id="contact" className={H2}>
              {t.contactTitle}
            </h2>
            <p className={P}>{t.contact}</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-lg mt-4">
              <EnvelopeSimple size={20} weight="bold" aria-hidden />
              {CONTACT_EMAIL}
            </a>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
