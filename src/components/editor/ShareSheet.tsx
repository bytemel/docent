"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, ExportIcon, WhatsappLogoIcon, XIcon } from "@phosphor-icons/react";
import { t } from "@/strings/editor";

interface Props {
  url: string;
  title: string;
  onClose(): void;
}

export default function ShareSheet({ url, title, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      inputRef.current?.select();
      try {
        setCopied(document.execCommand("copy"));
      } catch {
        setCopied(false);
      }
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: title, url });
    } catch {
      // The person closed the share menu; nothing to do.
    }
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgb(0 0 0 / 0.5)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-h"
        className="panel m-0 flex w-full max-w-md flex-col gap-4 rounded-b-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:m-4 sm:rounded-b-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id="share-h" className="text-lg font-semibold text-ink">
              {t.shareHeading}
            </h2>
            <p className="text-sm text-ink-2">{t.shareBody}</p>
          </div>
          <button ref={closeRef} type="button" className="btn btn-icon btn-ghost shrink-0" aria-label={t.close} onClick={onClose}>
            <XIcon size={20} aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="share-link" className="text-sm font-medium text-ink-2">
            {t.linkLabel}
          </label>
          <input
            ref={inputRef}
            id="share-link"
            className="field font-mono text-sm"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
          />
          {url.length > 6000 ? <p className="text-sm text-ink-3">{t.longLink}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={copy} aria-live="polite">
            {copied ? <CheckIcon size={18} aria-hidden /> : <CopyIcon size={18} aria-hidden />}
            {copied ? t.copied : t.copy}
          </button>
          <a className="btn" href={wa} target="_blank" rel="noopener noreferrer">
            <WhatsappLogoIcon size={18} aria-hidden />
            {t.whatsapp}
          </a>
          {canShare ? (
            <button type="button" className="btn" onClick={nativeShare}>
              <ExportIcon size={18} aria-hidden />
              {t.more}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
