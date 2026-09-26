"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, ExportIcon, WhatsappLogoIcon, XIcon } from "@phosphor-icons/react";
import type { Waypoint } from "@/lib/types";
import { hereUrl, NAME_MAX } from "@/app/here/params";
import { t } from "@/strings/editor";

const NAME_KEY = "docent:name";

const ROW_BTN = "min-w-0 flex-col gap-0.5 px-1 py-1.5 text-[13px] sm:flex-row sm:gap-2 sm:px-3 sm:text-[15px]";

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
      style={{ background: "rgb(0 0 0 / 0.5)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-h"
        className="panel flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-b-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:m-4 sm:rounded-b-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id="ask-h" className="text-lg font-semibold text-ink">
              {t.ask.heading}
            </h2>
            <p className="text-sm text-ink-2">{t.ask.body}</p>
          </div>
          <button ref={closeRef} type="button" className="btn btn-icon btn-ghost shrink-0" aria-label={t.close} onClick={onClose}>
            <XIcon size={20} aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ask-name" className="text-sm font-medium text-ink-2">
            {t.ask.nameLabel}
          </label>
          <input
            id="ask-name"
            className="field"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="given-name"
            placeholder={t.ask.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {destination ? (
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-accent"
              checked={includeTo}
              onChange={(e) => setIncludeTo(e.target.checked)}
            />
            <span>{t.ask.includeTo(destination.label?.trim() || t.endLabel)}</span>
          </label>
        ) : null}
        <p className="rounded-[12px] bg-surface-2 p-3 text-sm text-ink-2 break-words">{text}</p>
        <div className={`grid gap-2 ${canShare ? "grid-cols-3" : "grid-cols-2"}`}>
          <a
            className={`btn btn-primary ${ROW_BTN}`}
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsappLogoIcon size={18} aria-hidden />
            {t.whatsapp}
          </a>
          <button type="button" className={`btn ${ROW_BTN}`} onClick={copy} aria-live="polite">
            {copied ? <CheckIcon size={18} aria-hidden /> : <CopyIcon size={18} aria-hidden />}
            {copied ? t.copied : t.copy}
          </button>
          {canShare ? (
            <button type="button" className={`btn ${ROW_BTN}`} onClick={share}>
              <ExportIcon size={18} aria-hidden />
              {t.more}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
