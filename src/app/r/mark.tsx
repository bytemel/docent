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
    <Link href="/" className="inline-flex items-center gap-2 rounded-md font-semibold tracking-tight text-ink">
      <Mark />
      <span className="text-lg">{brand.name}</span>
    </Link>
  );
}

export function MessagePage({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8 sm:px-8">
      <Wordmark />
      <div className="flex flex-1 flex-col justify-center py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-ink-2">{body}</p>
        <div className="mt-8 flex flex-wrap gap-3">{children}</div>
      </div>
    </main>
  );
}
