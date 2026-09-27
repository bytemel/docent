"use client";

import { ArrowRight, BookmarkSimple, X } from "@phosphor-icons/react";
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
    <section className="rounded-[18px] border-[1.5px] border-line bg-surface" aria-labelledby="saved-title">
      <div className="flex items-center justify-between gap-2 pl-4 pr-2 pt-2 sm:pl-5">
        <h2 id="saved-title" className="flex items-center gap-2 pt-2 text-[1.0625rem] font-extrabold">
          <BookmarkSimple size={20} weight="fill" aria-hidden />
          {copy.title}
        </h2>
        <Link href="/routes" className="btn btn-ghost min-h-11 px-3 text-sm">
          {copy.all(list.length)}
          <ArrowRight size={16} weight="bold" aria-hidden />
        </Link>
      </div>
      <p className="px-4 pt-1 text-sm text-pretty text-ink-3 sm:px-5">{copy.body}</p>
      <ul className="mt-2 divide-y divide-line">
        {list.slice(0, 3).map((r) => (
          <li key={r.d} className="flex items-center gap-1 pr-2">
            <Link href={`/r?d=${r.d}`} className="group flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-[14px] py-2 pl-4 sm:pl-5">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{r.title || copy.untitled}</span>
                <span className="block text-sm text-ink-3">
                  <span className="num">{r.distance}</span>
                  {copy.meta("", date.format(new Date(r.savedAt)))}
                </span>
              </span>
              <span className="sr-only">{copy.open}</span>
              <ArrowRight size={20} weight="bold" className="shrink-0 text-ink-2 transition-transform group-hover:translate-x-1" aria-hidden />
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
    </section>
  );
}
