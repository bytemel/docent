import Link from "next/link";
import { Wordmark } from "@/app/r/mark";
import { brand } from "@/strings/common";
import { site } from "@/strings/pages";

const linkClass = "flex min-h-11 items-center font-semibold text-ink-2 hover:text-ink";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-5 py-12 sm:px-8 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="col-span-2 min-w-0 md:col-span-1">
          <Wordmark />
          <p className="mt-3 max-w-[36ch] text-pretty text-ink-2">{site.footerTagline}</p>
        </div>
        <nav aria-label={site.footerNav}>
          <ul>
            {[...site.nav, site.privacy].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={site.toolsNav}>
          <ul>
            {[site.go, site.share].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-sm text-ink-3 sm:flex-row sm:justify-between sm:px-8">
          <p>
            © {new Date().getFullYear()} {brand.name}
          </p>
          <p className="text-pretty">{brand.attribution}</p>
        </div>
      </div>
    </footer>
  );
}
