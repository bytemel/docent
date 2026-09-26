"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import {
  CheckIcon,
  CopyIcon,
  CrosshairIcon,
  ExportIcon,
  FlagIcon,
  NavigationArrowIcon,
  ShieldCheckIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react";
import type { Waypoint } from "@/lib/types";
import { NAIROBI } from "@/lib/map";
import { t } from "@/strings/editor";
import PlaceSearch from "@/components/editor/PlaceSearch";
import { Wordmark } from "@/app/r/mark";
import { NOTE_MAX, replyUrl, type FromPoint } from "./params";

const HereMap = dynamic(() => import("./HereMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

type Status = "idle" | "locating" | "located" | "denied" | "unsupported";

const WATCH_MS = 10000;
const noop = () => () => undefined;
const GOOD_ENOUGH_M = 15;

export default function HereClient({ name, to }: { name: string; to: Waypoint | null }) {
  const [status, setStatus] = useState<Status>("idle");
  const [point, setPoint] = useState<FromPoint | null>(null);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  );
  const watch = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const best = useRef<FromPoint | null>(null);

  const stop = useCallback(() => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    if (timer.current) clearTimeout(timer.current);
    watch.current = null;
    timer.current = null;
  }, []);

  useEffect(() => {
    return stop;
  }, [stop]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  function finish() {
    stop();
    setStatus(best.current ? "located" : "denied");
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    stop();
    best.current = null;
    setStatus("locating");
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy;
        if (!best.current || (best.current.acc ?? Infinity) > acc) {
          best.current = { lng: pos.coords.longitude, lat: pos.coords.latitude, acc };
          setPoint(best.current);
        }
        if (acc <= GOOD_ENOUGH_M) finish();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED || !best.current) {
          stop();
          setStatus(best.current ? "located" : "denied");
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: WATCH_MS },
    );
    timer.current = setTimeout(finish, WATCH_MS);
  }

  const drop = useCallback(
    (p: { lng: number; lat: number }) => {
      stop();
      best.current = { lng: p.lng, lat: p.lat };
      setPoint(best.current);
      setStatus("located");
    },
    [stop],
  );

  const center = useCallback((): [number, number] => (point ? [point.lng, point.lat] : to ? [to.lng, to.lat] : NAIROBI), [point, to]);

  const reply = point && typeof window !== "undefined" ? replyUrl(window.location.origin, { from: point, note, to }) : "";
  const text = reply ? t.here.message(reply) : "";
  const showMap = status !== "idle";
  const fallback = status === "denied" || status === "unsupported";

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
      await navigator.share({ text });
    } catch {
      return;
    }
  }

  const located = status === "located" && point;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
      <Wordmark />
      <header className="mt-6 flex flex-col gap-3">
        <h1 className="text-[34px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink text-balance sm:text-[44px]">
          {t.here.headline(name)}
        </h1>
        <p className="max-w-[40ch] text-[16px] leading-snug text-ink-2">{t.here.lead(name)}</p>
      </header>
      {to?.label ? (
        <p className="sign mt-5 flex items-center gap-3 p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-accent text-accent-ink">
            <FlagIcon size={22} weight="bold" aria-hidden />
          </span>
          <span className="min-w-0 text-[16px] font-bold leading-tight">{t.here.goingTo(to.label)}</span>
        </p>
      ) : null}

      {status === "idle" || status === "locating" ? (
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className="btn btn-primary btn-lg min-h-16 w-full text-[18px]"
            onClick={locate}
            disabled={status === "locating"}
            aria-busy={status === "locating"}
          >
            <NavigationArrowIcon size={24} weight="bold" aria-hidden className={status === "locating" ? "animate-pulse" : ""} />
            {status === "locating" ? t.here.locating : t.here.shareButton}
          </button>
          <p className="flex items-start gap-2 text-sm leading-snug text-ink-2">
            <ShieldCheckIcon size={18} weight="bold" aria-hidden className="mt-px shrink-0 text-ok" />
            {t.here.privacy}
          </p>
          <section className="mt-6 border-t border-line pt-5" aria-labelledby="how-h">
            <h2 id="how-h" className="text-[15px] font-bold text-ink">
              {t.here.howTitle}
            </h2>
            <ol className="mt-3 flex flex-col gap-2.5">
              {t.here.how.map((step, i) => (
                <li key={step} className="flex items-center gap-3 text-[15px] font-semibold text-ink-2">
                  <span className="num grid size-7 shrink-0 place-items-center rounded-[9px] bg-sign text-[13px] font-bold text-sign-ink">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}

      {fallback ? (
        <section role="alert" className="mt-6 flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4">
          <h2 className="text-[20px] font-extrabold leading-tight text-ink">{t.here.deniedTitle}</h2>
          {status === "unsupported" ? (
            <p className="text-[15px] text-ink-2">{t.here.unsupported}</p>
          ) : (
            <>
              <p className="text-[15px] text-ink-2">{t.here.denied}</p>
              <ul className="flex flex-col gap-2 text-[14px] leading-snug text-ink-2">
                <li className="rounded-[14px] bg-surface-2 p-3">{t.here.android}</li>
                <li className="rounded-[14px] bg-surface-2 p-3">{t.here.iphone}</li>
              </ul>
              <button type="button" className="btn btn-sign self-start" onClick={locate}>
                {t.here.tryAgain}
              </button>
            </>
          )}
          <p className="pt-1 text-[15px] font-semibold text-ink">{t.here.orSearch}</p>
          <PlaceSearch label={t.here.searchLabel} getCenter={center} onPick={drop} showLocate={false} />
        </section>
      ) : null}

      {showMap ? (
        <div className="relative mt-5 h-64 overflow-hidden rounded-[18px] border border-line bg-surface-2 shadow-float sm:h-80">
          <HereMap point={point} target={to} onTap={drop} />
          {point ? (
            <p className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-[12px] bg-surface/95 px-3 py-2 text-sm font-semibold text-ink shadow-float">
              {point.acc !== undefined ? (
                <>
                  <CrosshairIcon size={18} weight="bold" aria-hidden className="shrink-0" />
                  {t.here.accuracy(Math.max(1, Math.round(point.acc)))}
                </>
              ) : (
                t.here.pinned
              )}
            </p>
          ) : null}
        </div>
      ) : null}

      {point ? (
        <section className="mt-3 flex flex-col gap-5" aria-live="polite">
          <p className="text-sm text-ink-3">{t.here.tapToMove}</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="here-note" className="text-sm font-semibold text-ink-2">
              {t.here.noteLabel}
            </label>
            <textarea
              id="here-note"
              className="field resize-none py-2.5 leading-snug"
              rows={2}
              maxLength={NOTE_MAX}
              value={note}
              placeholder={t.here.notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {located ? (
            <div className="flex flex-col gap-2">
              <a
                className="btn btn-primary btn-lg min-h-16 w-full text-[18px]"
                href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsappLogoIcon size={24} weight="bold" aria-hidden />
                {t.here.sendTo(name)}
              </a>
              <div className={`grid gap-2 ${canShare ? "grid-cols-2" : "grid-cols-1"}`}>
                <button type="button" className="btn min-w-0" onClick={copy} aria-live="polite">
                  {copied ? <CheckIcon size={18} weight="bold" aria-hidden /> : <CopyIcon size={18} weight="bold" aria-hidden />}
                  {copied ? t.here.copied : t.here.copy}
                </button>
                {canShare ? (
                  <button type="button" className="btn min-w-0" onClick={share}>
                    <ExportIcon size={18} weight="bold" aria-hidden />
                    {t.here.more}
                  </button>
                ) : null}
              </div>
              <p className="mt-2 flex items-start gap-2 text-sm leading-snug text-ink-2">
                <ShieldCheckIcon size={18} weight="bold" aria-hidden className="mt-px shrink-0 text-ok" />
                {t.here.privacy}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
