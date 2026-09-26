"use client";

import { ArrowRight, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { parseSaved, removeRoute, savedSnapshot, subscribeSaved } from "@/lib/saved";
import { saved as copy } from "@/strings/common";

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export default function SavedRoutes() {
  const raw = useSyncExternalStore(subscribeSaved, savedSnapshot, () => "");
  const list = useMemo(() => parseSaved(raw), [raw]);
  if (!list.length) return null;
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8" aria-labelledby="saved-title">
      <div className="rounded-[12px] border border-line bg-surface p-5 sm:p-6">
        <h2 id="saved-title" className="text-lg font-semibold tracking-tight">
          {copy.title}
        </h2>
        <p className="mt-1 text-sm text-ink-2">{copy.body}</p>
        <ul className="mt-4 divide-y divide-line">
          {list.map((r) => (
            <li key={r.d} className="flex items-center gap-2 py-2">
              <Link href={`/r?d=${r.d}`} className="group flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.title || copy.untitled}</span>
                  <span className="block text-sm text-ink-3">
                    {copy.meta(r.distance, date.format(new Date(r.savedAt)))}
                  </span>
                </span>
                <span className="hidden items-center gap-1 text-sm font-semibold text-accent sm:inline-flex">
                  {copy.open}
                  <ArrowRight size={16} weight="bold" aria-hidden />
                </span>
              </Link>
              <button
                type="button"
                className="btn btn-ghost btn-icon shrink-0 text-ink-3"
                aria-label={copy.remove(r.title || copy.untitled)}
                onClick={() => removeRoute(r.d)}
              >
                <X size={18} weight="bold" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
