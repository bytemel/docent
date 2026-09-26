"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import {
  CheckIcon,
  CopyIcon,
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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8">
      <p className="text-sm font-semibold tracking-wide text-accent">Docent</p>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-tight text-ink text-balance">{t.here.headline(name)}</h1>
        <p className="text-[15px] leading-snug text-ink-2">{t.here.lead(name)}</p>
        {to?.label ? (
          <p className="flex items-center gap-1.5 text-sm text-ink-2">
            <FlagIcon size={16} aria-hidden className="text-accent" />
            {t.here.goingTo(to.label)}
          </p>
        ) : null}
      </header>
      <p className="flex items-start gap-2 rounded-[12px] bg-surface-2 p-3 text-sm text-ink-2">
        <ShieldCheckIcon size={18} aria-hidden className="mt-0.5 shrink-0 text-ok" />
        {t.here.privacy}
      </p>
      {status === "idle" || status === "locating" ? (
        <button type="button" className="btn btn-primary min-h-14 w-full text-lg" onClick={locate} disabled={status === "locating"}>
          <NavigationArrowIcon size={22} aria-hidden />
          {status === "locating" ? t.here.locating : t.here.shareButton}
        </button>
      ) : null}
      {fallback ? (
        <section role="alert" className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface p-3">
          <h2 className="font-semibold text-ink">{t.here.deniedTitle}</h2>
          {status === "unsupported" ? (
            <p className="text-sm text-ink-2">{t.here.unsupported}</p>
          ) : (
            <>
              <p className="text-sm text-ink-2">{t.here.denied}</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2">
                <li>{t.here.android}</li>
                <li>{t.here.iphone}</li>
              </ul>
              <button type="button" className="btn self-start" onClick={locate}>
                {t.here.tryAgain}
              </button>
            </>
          )}
          <p className="pt-1 text-sm text-ink-2">{t.here.orSearch}</p>
          <PlaceSearch label={t.here.searchLabel} getCenter={center} onPick={drop} showLocate={false} />
        </section>
      ) : null}
      {showMap ? (
        <div className="panel h-64 overflow-hidden p-0">
          <HereMap point={point} target={to} onTap={drop} />
        </div>
      ) : null}
      {point ? (
        <section className="flex flex-col gap-4" aria-live="polite">
          <p className="text-sm text-ink-2">
            {point.acc !== undefined ? t.here.accuracy(Math.max(1, Math.round(point.acc))) : t.here.pinned}{" "}
            <span className="text-ink-3">{t.here.tapToMove}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="here-note" className="text-sm font-medium text-ink-2">
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
          {status === "located" ? (
            <div className="flex flex-col gap-2">
              <a
                className="btn btn-primary min-h-14 w-full text-lg"
                href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsappLogoIcon size={22} aria-hidden />
                {t.here.sendTo(name)}
              </a>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn flex-1" onClick={copy} aria-live="polite">
                  {copied ? <CheckIcon size={18} aria-hidden /> : <CopyIcon size={18} aria-hidden />}
                  {copied ? t.here.copied : t.here.copy}
                </button>
                {canShare ? (
                  <button type="button" className="btn flex-1" onClick={share}>
                    <ExportIcon size={18} aria-hidden />
                    {t.here.more}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
