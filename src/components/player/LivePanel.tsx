"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Copy, Crosshair, NavigationArrow, ShareNetwork, WhatsappLogo } from "@phosphor-icons/react";
import { formatDistance } from "@/lib/geo";
import { isLiveConfigured, startLiveShare, type LiveShare, type LiveStatus } from "@/lib/live";
import { offRouteLabel, PLAYER, shareLiveLabel, toGoLabel, whatsappText } from "@/strings/player";
import { OFF_ROUTE_M, type FixOut, type LocStatus } from "./location";

interface Props {
  loc: LocStatus;
  followMe: boolean;
  arrivalNote: string;
  sinkRef: RefObject<((fix: FixOut) => void) | null>;
  onStart: () => void;
  onStop: () => void;
  onFollowMe: (on: boolean) => void;
  onGuide: () => void;
}

const LIVE_TEXT: Record<LiveStatus, string> = {
  connecting: PLAYER.liveConnecting,
  live: PLAYER.liveOn,
  stopped: PLAYER.liveStopped,
  offline: PLAYER.liveOffline,
  unavailable: PLAYER.liveUnavailable,
};

type WakeSentinel = { release(): Promise<void> };
type WakeNav = Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeSentinel> } };

function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const nav = navigator as WakeNav;
    if (!nav.wakeLock) return;
    let lock: WakeSentinel | null = null;
    let alive = true;
    const grab = () => {
      if (document.visibilityState !== "visible" || lock) return;
      nav.wakeLock
        ?.request("screen")
        .then((l) => {
          if (alive) lock = l;
          else void l.release();
        })
        .catch(() => undefined);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        lock = null;
        grab();
      }
    };
    grab();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => undefined);
    };
  }, [on]);
}

export default function LivePanel({ loc, followMe, arrivalNote, sinkRef, onStart, onStop, onFollowMe, onGuide }: Props) {
  const tracking = loc.state === "waiting" || loc.state === "weak" || loc.state === "on";
  useWakeLock(tracking);
  const [encoded] = useState(() => new URLSearchParams(window.location.search).get("d"));
  const canShare = isLiveConfigured() && !!encoded;
  const shareRef = useRef<LiveShare | null>(null);
  const [share, setShare] = useState<{ url: string; status: LiveStatus } | null>(null);
  const [shareError, setShareError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    sinkRef.current = (fix) => shareRef.current?.send({ ...fix });
    return () => {
      sinkRef.current = null;
    };
  }, [sinkRef]);

  useEffect(
    () => () => {
      const s = shareRef.current;
      shareRef.current = null;
      if (s) void s.stop().catch(() => undefined);
    },
    [],
  );

  const startShare = async () => {
    if (!encoded || shareRef.current) return;
    setShareError(false);
    try {
      const s = await startLiveShare({
        encodedDoc: encoded,
        origin: window.location.origin,
        onStatus: (status) => setShare((cur) => (cur ? { ...cur, status } : cur)),
      });
      shareRef.current = s;
      setShare({ url: s.watchUrl, status: "connecting" });
    } catch {
      setShareError(true);
    }
  };

  const stopShare = () => {
    const s = shareRef.current;
    shareRef.current = null;
    setShare(null);
    if (s) void s.stop().catch(() => undefined);
  };

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const message =
    loc.state === "waiting"
      ? PLAYER.locWaiting
      : loc.state === "weak"
        ? PLAYER.locWeak
        : loc.state === "denied"
          ? PLAYER.locDenied
          : loc.state === "unavailable"
            ? PLAYER.locUnavailable
            : null;
  const far = loc.state === "on" && loc.offRouteM !== null && loc.offRouteM > OFF_ROUTE_M && !loc.arrived;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="chip min-h-11"
          aria-pressed={tracking}
          onClick={() => {
            if (tracking) {
              stopShare();
              onStop();
            } else onStart();
          }}
        >
          <Crosshair size={16} weight="bold" aria-hidden="true" />
          {tracking ? PLAYER.stopShowingMe : PLAYER.showMe}
        </button>
        {tracking ? (
          <button type="button" className="chip min-h-11" aria-pressed={followMe} onClick={() => onFollowMe(!followMe)}>
            <NavigationArrow size={16} weight="bold" aria-hidden="true" />
            {PLAYER.followMe}
          </button>
        ) : null}
        {tracking && canShare && !share ? (
          <button type="button" className="chip min-h-11" onClick={() => void startShare()}>
            <ShareNetwork size={16} weight="bold" aria-hidden="true" />
            {shareLiveLabel(PLAYER.theSender)}
          </button>
        ) : null}
      </div>
      <div role="status" aria-live="polite" className="flex flex-col gap-1 text-sm text-ink-2">
        {message ? <p>{message}</p> : null}
        {loc.state === "on" && loc.arrived ? (
          <p className="font-semibold text-ink">
            {PLAYER.arrived}
            {arrivalNote ? <span className="block font-normal text-ink-2">{arrivalNote}</span> : null}
          </p>
        ) : null}
        {loc.state === "on" && !loc.arrived && loc.toGoM !== null ? <p>{toGoLabel(formatDistance(loc.toGoM))}</p> : null}
        {far && loc.offRouteM !== null ? <p className="font-medium text-ink">{offRouteLabel(formatDistance(loc.offRouteM))}</p> : null}
        {loc.guide === "loading" ? <p>{PLAYER.guideLoading}</p> : null}
        {loc.guide === "failed" ? <p>{PLAYER.guideFailed}</p> : null}
        {tracking ? <p className="text-xs">{PLAYER.keepOpen}</p> : null}
        {shareError ? <p>{PLAYER.liveFailed}</p> : null}
      </div>
      {far && loc.guide !== "shown" && loc.guide !== "loading" ? (
        <button type="button" className="btn btn-primary self-start" onClick={onGuide}>
          {PLAYER.guideMe}
        </button>
      ) : null}
      {share ? (
        <div className="flex flex-col gap-2 rounded-[12px] bg-surface-2 p-3">
          <p className="text-sm font-medium text-ink">{LIVE_TEXT[share.status]}</p>
          <p className="text-xs text-ink-2">{PLAYER.liveLinkNote}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="chip min-h-11" onClick={() => void copy()}>
              <Copy size={16} weight="bold" aria-hidden="true" />
              {copied ? PLAYER.copied : PLAYER.copyLink}
            </button>
            <a
              className="chip min-h-11"
              href={`https://wa.me/?text=${encodeURIComponent(whatsappText(share.url))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsappLogo size={16} weight="bold" aria-hidden="true" />
              {PLAYER.whatsapp}
            </a>
            <button type="button" className="chip min-h-11" onClick={stopShare}>
              {PLAYER.stopLive}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
