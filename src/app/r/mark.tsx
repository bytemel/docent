import { Signpost } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import LostRoute from "@/components/landing/LostRoute";
import { MARK_HEAD, MARK_PATH } from "@/components/landing/markPaths";
import { brand, notFound } from "@/strings/common";


export function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d={MARK_PATH} fill="none" stroke="var(--accent-ink)" strokeWidth="3.4" strokeLinecap="round" />
      <path d={MARK_HEAD} fill="var(--accent-ink)" stroke="var(--accent-ink)" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 self-start rounded-[14px] text-ink">
      <Mark />
      <span className="text-[1.3rem] font-extrabold tracking-[-0.02em]">{brand.name}</span>
    </Link>
  );
}

export function MessagePage({
  title,
  body,
  hint,
  art,
  children,
}: {
  title: string;
  body: string;
  hint?: string;
  art?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 pb-8 pt-4 sm:px-8">
      <Wordmark />
      <div className="grid flex-1 content-center items-center gap-10 py-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-14">
        <div className="min-w-0">
          <h1 className="text-[2.25rem] font-black leading-[1.04] tracking-[-0.02em] text-balance sm:text-[3.25rem]">{title}</h1>
          <p className="mt-4 max-w-[42ch] text-lg leading-relaxed text-ink-2">{body}</p>
          {hint ? <p className="mt-3 max-w-[46ch] text-[0.9375rem] leading-relaxed text-ink-3">{hint}</p> : null}
          <div className="sign mt-8 p-5 sm:p-6">
            <p className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-[0.08em] opacity-80">
              <Signpost size={20} weight="bold" aria-hidden />
              {notFound.signTitle}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 [&>*]:min-h-[52px] [&>*]:flex-1 [&>*]:basis-44">{children}</div>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[20rem] md:max-w-none">{art ?? <LostRoute kind="broken" className="h-auto w-full" />}</div>
      </div>
    </main>
  );
}
