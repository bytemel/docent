"use client";

import { useState, type Ref } from "react";
import { Copy, WhatsappLogo, X } from "@phosphor-icons/react";
import { startLiveShare, type LiveShare } from "@/lib/live";
import { encodeDoc } from "@/lib/share";
import type { RouteDoc } from "@/lib/types";
import { NAV } from "@/strings/nav";

interface Props {
  share: LiveShare | null;
  getDoc: () => RouteDoc;
  onShare: (s: LiveShare | null) => void;
  onClose: () => void;
  ref?: Ref<HTMLElement>;
}

export default function ShareSheet({ share, getDoc, onShare, onClose, ref }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setMsg(null);
    try {
      onShare(await startLiveShare({ encodedDoc: encodeDoc(getDoc()), origin: window.location.origin }));
    } catch {
      setMsg(NAV.shareFailed);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    await share?.stop().catch(() => {});
    onShare(null);
  };

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.watchUrl);
      setMsg(NAV.copied);
    } catch {
      setMsg(null);
    }
  };

  return (
    <section
      ref={ref}
      role="dialog"
      aria-label={NAV.shareLive}
      className="panel absolute inset-x-3 bottom-3 z-20 p-5 md:inset-x-auto md:left-4 md:bottom-4 md:w-[400px]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
          {share ? NAV.sharing : NAV.shareLive}
        </h2>
        <button type="button" className="btn btn-ghost btn-icon -mt-2 -mr-2" onClick={onClose} aria-label={NAV.close}>
          <X size={20} weight="bold" aria-hidden />
        </button>
      </div>
      <p className="mt-2 text-[15px] text-pretty text-ink-2">{NAV.shareHint}</p>
      {share ? (
        <>
          <input className="field num mt-4 text-sm" readOnly value={share.watchUrl} aria-label={NAV.copy} onFocus={(e) => e.currentTarget.select()} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-primary" onClick={copy}>
              <Copy size={18} weight="bold" aria-hidden />
              {NAV.copy}
            </button>
            <a
              className="btn"
              href={`https://wa.me/?text=${encodeURIComponent(share.watchUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsappLogo size={18} weight="bold" aria-hidden />
              {NAV.sendWhatsApp}
            </a>
          </div>
          <button type="button" className="btn btn-ghost mt-2 w-full text-danger" onClick={stop}>
            {NAV.shareStop}
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-primary btn-lg mt-4 w-full" onClick={start} disabled={busy}>
          {NAV.shareLive}
        </button>
      )}
      {msg ? (
        <p role="status" className="mt-3 text-sm font-medium text-ink-2">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
