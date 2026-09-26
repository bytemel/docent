import LostRoute from "@/components/landing/LostRoute";
import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "@/strings/common";

export function Mark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <path d="M9 23c4 0 5-4 7-7s3-7 7-7" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="9" cy="23" r="3.25" fill="var(--accent)" stroke="var(--ink)" strokeWidth="1.5" />
      <circle cx="23" cy="9" r="3.25" fill="var(--accent)" stroke="var(--ink)" strokeWidth="1.5" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 self-start rounded-md font-semibold tracking-tight text-ink">
      <Mark />
      <span className="text-lg">{brand.name}</span>
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-6 sm:px-8">
      <Wordmark />
      <div className="grid flex-1 content-center items-center gap-8 py-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-12">
        <div className="w-full max-w-[18rem] md:order-2 md:max-w-none">{art ?? <LostRoute kind="broken" className="h-auto w-full" />}</div>
        <div className="min-w-0">
          <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-ink-2">{body}</p>
          {hint ? <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-ink-3">{hint}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">{children}</div>
        </div>
      </div>
    </main>
  );
}
