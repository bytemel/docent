"use client";

import { NavigationArrow } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/app/r/mark";
import { site } from "@/strings/pages";

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = (href: string) => (pathname === href ? "page" : undefined);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <div className="flex items-center">
          <Wordmark />
        </div>
        <nav aria-label={site.mainNav} className="hidden items-center gap-1 md:flex">
          {site.nav.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={current(l.href)}
              className="btn btn-ghost text-ink-2 hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-accent aria-[current=page]:decoration-[3px] aria-[current=page]:underline-offset-8"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href={site.go.href} className="btn btn-primary hidden sm:inline-flex">
            <NavigationArrow size={18} weight="fill" aria-hidden />
            {site.go.label}
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-icon relative md:hidden"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? site.closeMenu : site.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            <span
              className={`absolute left-1/2 top-1/2 h-[2.5px] w-5 -translate-x-1/2 rounded-full bg-ink transition-transform duration-200 ${open ? "-translate-y-1/2 rotate-45" : "-translate-y-[5px]"}`}
            />
            <span
              className={`absolute left-1/2 top-1/2 h-[2.5px] w-5 -translate-x-1/2 rounded-full bg-ink transition-transform duration-200 ${open ? "-translate-y-1/2 -rotate-45" : "translate-y-[3px]"}`}
            />
          </button>
        </div>
      </div>
      <div
        id="site-menu"
        inert={!open}
        className={`grid border-line transition-[grid-template-rows] duration-200 md:hidden ${open ? "grid-rows-[1fr] border-t" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <nav aria-label={site.mainNav} className="mx-auto flex max-w-6xl flex-col px-5 pb-5 pt-2 sm:px-8">
            {[...site.nav, site.privacy].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                aria-current={current(l.href)}
                className="flex min-h-14 items-center border-b border-line text-lg font-bold aria-[current=page]:text-accent-text"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href={site.go.href} onClick={close} className="btn btn-primary btn-lg">
                <NavigationArrow size={20} weight="fill" aria-hidden />
                {site.go.label}
              </Link>
              <Link href={site.share.href} onClick={close} className="btn btn-sign btn-lg">
                {site.share.label}
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
