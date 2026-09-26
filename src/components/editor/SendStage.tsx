"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  CheckIcon,
  CopyIcon,
  ExportIcon,
  PaperPlaneTiltIcon,
  PlayIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react";
import type { RouteDoc, Walker } from "@/lib/types";
import { formatDistance, formatDuration } from "@/lib/geo";
import RouteSketch from "@/components/landing/RouteSketch";
import { t } from "@/strings/editor";
import { MODE_ICON } from "./RouteStage";

const WALKERS: Walker[] = ["neutral", "man", "woman"];
const noop = () => () => undefined;

export function whatsappHref(title: string, url: string) {
  return `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
}

export function SendActions({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <a className="btn btn-primary btn-lg min-w-0 px-3" href={whatsappHref(title, url)} target="_blank" rel="noopener noreferrer">
        <WhatsappLogoIcon size={22} weight="bold" aria-hidden />
        <span className="truncate">{t.whatsapp}</span>
      </a>
      <button type="button" className="btn btn-sign btn-lg min-w-0 px-3" onClick={copy} aria-live="polite">
        {copied ? <CheckIcon size={20} weight="bold" aria-hidden /> : <CopyIcon size={20} weight="bold" aria-hidden />}
        <span className="truncate">{copied ? t.send.copied : t.send.copyLink}</span>
      </button>
    </div>
  );
}

interface Props {
  doc: RouteDoc;
  url: string;
  title: string;
  titlePlaceholder: string;
  snapshot: string | null;
  snapshotting: boolean;
  onTitle(v: string): void;
  onWalker(w: Walker): void;
  onPreview(): void;
  onAsk(): void;
}

export default function SendStage(p: Props) {
  const canShare = useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  );
  const total = p.doc.segments.reduce((a, s) => a + s.distanceM, 0);
  const time = p.doc.segments.reduce((a, s) => a + s.durationS, 0);
  const modes = p.doc.segments.map((s) => s.mode).filter((m, i, all) => all.indexOf(m) === i);

  async function share() {
    try {
      await navigator.share({ title: p.doc.title, text: p.doc.title, url: p.url });
    } catch {
      return;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <figure className="overflow-hidden rounded-[18px] border border-line bg-surface-2" aria-label={t.send.summaryLabel}>
        <div className="relative aspect-[16/10] w-full">
          {p.snapshot ? (
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${p.snapshot})` }} />
          ) : p.snapshotting ? (
            <div className="absolute inset-0 animate-pulse bg-surface-2" />
          ) : (
            <RouteSketch doc={p.doc} width={640} height={400} stroke={6} className="absolute inset-0 h-full w-full p-4" />
          )}
        </div>
        <figcaption className="flex items-center gap-3 border-t border-line bg-surface px-3 py-2.5">
          <p className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="num text-[20px] font-bold leading-none text-ink">{formatDistance(total)}</span>
            <span className="num truncate text-sm text-ink-2">about {formatDuration(time)}</span>
          </p>
          <span className="flex shrink-0 gap-1" aria-hidden>
            {modes.map((m) => {
              const I = MODE_ICON[m];
              return (
                <span key={m} className="grid size-8 place-items-center rounded-[10px] bg-surface-2 text-ink">
                  <I size={18} weight="bold" />
                </span>
              );
            })}
          </span>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="send-title" className="text-sm font-semibold text-ink-2">
          {t.send.titleLabel}
        </label>
        <input
          id="send-title"
          className="field text-[18px] font-bold"
          value={p.title}
          placeholder={p.titlePlaceholder}
          onChange={(e) => p.onTitle(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="share-link" className="text-sm font-semibold text-ink-2">
          {t.linkLabel}
        </label>
        <input
          id="share-link"
          className="field num text-sm text-ink-2"
          readOnly
          value={p.url}
          onFocus={(e) => e.currentTarget.select()}
        />
        {p.url.length > 6000 ? <p className="text-sm text-ink-3">{t.longLink}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <button type="button" className="btn btn-lg w-full" onClick={p.onPreview}>
          <PlayIcon size={20} weight="fill" aria-hidden />
          {t.send.previewCta}
        </button>
        {canShare ? (
          <button type="button" className="btn w-full" onClick={share}>
            <ExportIcon size={18} weight="bold" aria-hidden />
            {t.send.more}
          </button>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-ink-2">{t.send.travellerLabel}</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {WALKERS.map((w) => (
            <button
              key={w}
              type="button"
              className="chip min-w-0"
              aria-pressed={p.doc.walker === w}
              onClick={() => p.onWalker(w)}
            >
              {t.walkers[w]}
            </button>
          ))}
        </div>
      </fieldset>

      <section className="flex items-center gap-3 rounded-[18px] border border-line p-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-surface-2 text-ink">
          <PaperPlaneTiltIcon size={22} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold leading-tight text-ink">{t.send.nextTrip}</h3>
          <p className="text-sm leading-snug text-ink-2">{t.send.nextTripBody}</p>
        </div>
        <button type="button" className="btn shrink-0 px-3" onClick={p.onAsk}>
          {t.send.askCta}
        </button>
      </section>
    </div>
  );
}
