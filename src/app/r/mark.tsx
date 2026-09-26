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

const ARROW =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M221.66 133.66l-72 72a8 8 0 0 1-11.32-11.32L196.69 136H40a8 8 0 0 1 0-16h156.69l-58.35-58.34a8 8 0 0 1 11.32-11.32l72 72a8 8 0 0 1 0 11.32Z'/%3E%3C/svg%3E\")";

const ACTIONS_CSS = `
.msg-actions{display:grid;gap:.75rem}
.msg-actions>a,.msg-actions>button{display:flex;align-items:center;justify-content:space-between;gap:.75rem;width:100%;min-height:56px;padding:0 1.125rem;border-radius:16px;font-size:1.0625rem;text-align:left;white-space:normal}
.msg-actions>a::after,.msg-actions>button::after{content:"";flex:none;width:20px;height:20px;background:currentColor;-webkit-mask:${ARROW} center/contain no-repeat;mask:${ARROW} center/contain no-repeat}
`;

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
      <style href="docent-message-actions" precedence="default">
        {ACTIONS_CSS}
      </style>
      <Wordmark />
      <div className="grid flex-1 content-center items-center gap-10 py-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-[2.25rem] font-black leading-[1.04] tracking-[-0.02em] text-balance sm:text-[3.25rem]">{title}</h1>
          <p className="mt-4 max-w-[42ch] text-lg leading-relaxed text-pretty text-ink-2">{body}</p>
          {hint ? <p className="mt-3 max-w-[46ch] text-[0.9375rem] leading-relaxed text-pretty text-ink-3">{hint}</p> : null}
          <div className="sign mt-8 p-5 sm:p-6">
            <p className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-[0.08em] opacity-80">
              <Signpost size={20} weight="bold" aria-hidden />
              {notFound.signTitle}
            </p>
            <div className="msg-actions mt-4">{children}</div>
          </div>
        </div>
        <div className="w-full max-w-2xl">{art ?? <LostRoute kind="broken" className="h-auto w-full" />}</div>
      </div>
    </main>
  );
}
