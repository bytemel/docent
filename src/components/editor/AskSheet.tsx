"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, ExportIcon, PaperPlaneTiltIcon, WhatsappLogoIcon, XIcon } from "@phosphor-icons/react";
import type { Waypoint } from "@/lib/types";
import { hereUrl, NAME_MAX } from "@/app/here/params";
import { t } from "@/strings/editor";

const NAME_KEY = "docent:name";

interface Props {
  destination: Waypoint | null;
  onClose(): void;
}

function savedName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function AskSheet({ destination, onClose }: Props) {
  const [name, setName] = useState(savedName);
  const [includeTo, setIncludeTo] = useState(true);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const to = destination && includeTo ? destination : null;
  const link = hereUrl(window.location.origin, { name, to });
  const text = t.ask.message(name.trim(), link);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    try {
      window.localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      return;
    }
  }, [name]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    try {
      await navigator.share({ text, url: link });
    } catch {
      return;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgb(0 0 0 / 0.55)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-h"
        className="panel flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-b-none sm:m-4 sm:rounded-b-[18px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-accent text-accent-ink">
              <PaperPlaneTiltIcon size={26} weight="bold" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="ask-h" className="text-[22px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">
                {t.ask.heading}
              </h2>
              <p className="mt-1 text-[14px] leading-snug text-ink-2">{t.ask.body}</p>
            </div>
            <button ref={closeRef} type="button" className="btn btn-icon btn-ghost -mr-2 -mt-2 shrink-0" aria-label={t.close} onClick={onClose}>
              <XIcon size={20} weight="bold" aria-hidden />
            </button>
          </div>
          <ol className="flex flex-col gap-2">
            {t.ask.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-3 text-[15px] font-semibold text-ink">
                <span className="num grid size-7 shrink-0 place-items-center rounded-[9px] bg-sign text-[13px] font-bold text-sign-ink">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ask-name" className="text-sm font-semibold text-ink-2">
              {t.ask.nameLabel}
            </label>
            <input
              id="ask-name"
              className="field font-semibold"
              value={name}
              maxLength={NAME_MAX}
              autoComplete="given-name"
              placeholder={t.ask.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {destination ? (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] text-ink">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-[var(--ink)]"
                checked={includeTo}
                onChange={(e) => setIncludeTo(e.target.checked)}
              />
              <span>{t.ask.includeTo(destination.label?.trim() || t.endLabel)}</span>
            </label>
          ) : null}
          <figure className="flex flex-col gap-1.5">
            <figcaption className="text-sm font-semibold text-ink-2">{t.ask.linkLabel}</figcaption>
            <p className="rounded-[14px] rounded-tl-[4px] bg-surface-2 p-3 text-[14px] leading-snug text-ink break-words">{text}</p>
          </figure>
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <a
            className="btn btn-primary btn-lg w-full"
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsappLogoIcon size={22} weight="bold" aria-hidden />
            {t.send.whatsapp}
          </a>
          <div className={`grid gap-2 ${canShare ? "grid-cols-2" : "grid-cols-1"}`}>
            <button type="button" className="btn min-w-0" onClick={copy} aria-live="polite">
              {copied ? <CheckIcon size={18} weight="bold" aria-hidden /> : <CopyIcon size={18} weight="bold" aria-hidden />}
              {copied ? t.copied : t.copy}
            </button>
            {canShare ? (
              <button type="button" className="btn min-w-0" onClick={share}>
                <ExportIcon size={18} weight="bold" aria-hidden />
                {t.more}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
