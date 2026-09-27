import type { Metadata } from "next";
import MyRoutes from "@/components/site/MyRoutes";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { routesPage as t } from "@/strings/pages";

export const metadata: Metadata = {
  title: t.title,
  description: t.metaDescription,
  robots: { index: false, follow: false },
};

export default function RoutesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20 pt-10 sm:px-8 lg:pt-14">
        <h1 className="text-[2.5rem] font-black leading-[1.02] tracking-[-0.025em] sm:text-[3.5rem]">{t.title}</h1>
        <p className="mt-3 max-w-[48ch] text-lg leading-relaxed text-pretty text-ink-2">{t.lead}</p>
        <div className="mt-10">
          <MyRoutes />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
