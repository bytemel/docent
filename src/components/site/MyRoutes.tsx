"use client";

import { ArrowRight, NavigationArrow, PencilSimple, Play, ShareNetwork, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import Plates from "@/components/landing/Plates";
import { clearDraft, DRAFT_KEY, loadDraft } from "@/lib/draft";
import { formatDistance, lineLength } from "@/lib/geo";
import { parseSaved, removeRoute, savedSnapshot, subscribeSaved, type SavedRoute } from "@/lib/saved";
import type { RouteDoc } from "@/lib/types";
import { routesPage as t } from "@/strings/pages";

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const noop = () => () => {};

function subscribeDraft(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === DRAFT_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function draftSnapshot(): string {
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function draftSummary(doc: RouteDoc) {
  const first = doc.segments[0];
  const last = doc.segments[doc.segments.length - 1];
  const meters = doc.segments.reduce((sum, s) => sum + lineLength(s.geometry), 0);
  const ends = [first?.from.label, last?.to.label].filter(Boolean).join(" to ");
  return { title: doc.title.trim() || ends || t.draftUntitled, meta: t.draftMeta(doc.segments.length, formatDistance(meters)) };
}

function DraftCard({ doc, onDiscard }: { doc: RouteDoc; onDiscard: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const { title, meta } = draftSummary(doc);
  return (
    <section aria-labelledby="draft-title" className="sign p-5 sm:p-6">
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] opacity-80">
        <PencilSimple size={18} weight="bold" aria-hidden />
        {t.draftTitle}
      </p>
      <h2 id="draft-title" className="mt-3 text-2xl font-black leading-tight tracking-[-0.02em] text-balance">
        {title}
      </h2>
      <p className="num mt-1 text-sm opacity-75">{meta}</p>
      <p className="mt-3 max-w-[48ch] text-pretty opacity-85">{t.draftBody}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {confirm ? (
          <>
            <span className="flex min-h-11 w-full items-center font-bold sm:w-auto sm:pr-2">{t.discardConfirm}</span>
            <button type="button" className="btn btn-primary" onClick={onDiscard}>
              {t.discardDraft}
            </button>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              {t.keep}
            </button>
          </>
        ) : (
          <>
            <Link href="/new" className="btn btn-primary btn-lg">
              {t.continueDraft}
              <ArrowRight size={20} weight="bold" aria-hidden />
            </Link>
            <button type="button" className="btn btn-lg border-transparent bg-transparent text-sign-ink" onClick={() => setConfirm(true)}>
              {t.discardDraft}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function SavedCard({ r, onStatus }: { r: SavedRoute; onStatus: (msg: string) => void }) {
  const [confirm, setConfirm] = useState(false);
  const title = r.title || t.untitled;
  const share = async () => {
    const url = `${window.location.origin}/r?d=${r.d}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      onStatus(t.copied);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") onStatus(t.copyFailed);
    }
  };
  return (
    <li className="rounded-[18px] border-[1.5px] border-line bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-extrabold leading-snug text-pretty">{title}</h3>
          <p className="mt-0.5 text-sm text-ink-3">
            <span className="num">{r.distance}</span>
            <span aria-hidden>, </span>
            {t.opened(date.format(new Date(r.savedAt)))}
          </p>
        </div>
        {confirm ? null : (
          <button type="button" className="btn btn-ghost btn-icon -mr-2 -mt-1 shrink-0 text-ink-3" aria-label={t.removeLabel(title)} onClick={() => setConfirm(true)}>
            <Trash size={20} weight="bold" aria-hidden />
          </button>
        )}
      </div>
      {confirm ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="flex min-h-11 w-full items-center font-bold sm:w-auto sm:pr-2">{t.removeConfirm}</span>
          <button type="button" className="btn btn-sign" onClick={() => removeRoute(r.d)}>
            {t.remove}
          </button>
          <button type="button" className="btn" onClick={() => setConfirm(false)}>
            {t.keep}
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 sm:flex sm:flex-wrap">
          <Link href={`/go?d=${r.d}`} className="btn btn-primary">
            <NavigationArrow size={18} weight="fill" aria-hidden />
            {t.start}
          </Link>
          <Link href={`/r?d=${r.d}`} className="btn" aria-label={`${t.watch}: ${title}`}>
            <Play size={18} weight="fill" aria-hidden />
            <span className="hidden sm:inline">{t.watch}</span>
          </Link>
          <button type="button" className="btn" onClick={share} aria-label={t.shareLabel(title)}>
            <ShareNetwork size={18} weight="bold" aria-hidden />
            <span className="hidden sm:inline">{t.share}</span>
          </button>
        </div>
      )}
    </li>
  );
}

export default function MyRoutes() {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const raw = useSyncExternalStore(subscribeSaved, savedSnapshot, () => "");
  const draftRaw = useSyncExternalStore(subscribeDraft, draftSnapshot, () => "");
  const [draftGone, setDraftGone] = useState(false);
  const [status, setStatus] = useState("");
  const saved = useMemo(() => parseSaved(raw), [raw]);
  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(""), 2600);
  };
  const draft = useMemo(() => (draftRaw && !draftGone ? loadDraft() : null), [draftRaw, draftGone]);

  if (!hydrated) {
    return (
      <p className="rounded-[18px] border-[1.5px] border-line bg-surface p-6 text-ink-3" role="status">
        {t.loading}
      </p>
    );
  }

  if (!saved.length && !draft) {
    return (
      <section aria-labelledby="empty-title" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center lg:gap-14">
        <div>
          <h2 id="empty-title" className="text-3xl font-black tracking-[-0.02em] text-balance sm:text-4xl">
            {t.emptyTitle}
          </h2>
          <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-pretty text-ink-2">{t.emptyBody}</p>
        </div>
        <Plates size="md" />
      </section>
    );
  }

  return (
    <div className="grid gap-10">
      {draft ? (
        <DraftCard
          doc={draft}
          onDiscard={() => {
            clearDraft();
            setDraftGone(true);
          }}
        />
      ) : null}
      {saved.length ? (
        <section aria-labelledby="saved-title">
          <h2 id="saved-title" className="text-2xl font-black tracking-[-0.02em]">
            {t.savedTitle}
          </h2>
          <p className="mt-1 text-pretty text-ink-2">{t.savedBody}</p>
          <ul className="mt-5 grid max-w-3xl gap-3">
            {saved.map((r) => (
              <SavedCard key={r.d} r={r} onStatus={flash} />
            ))}
          </ul>
        </section>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {status ? (
        <p className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-[14px] bg-sign px-4 py-3 text-center font-bold text-sign-ink shadow-float" aria-hidden>
          {status}
        </p>
      ) : null}
    </div>
  );
}
