"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CrosshairIcon, MagnifyingGlassIcon, MapPinIcon, PushPinIcon } from "@phosphor-icons/react";
import { parsePlaceInput, recoverOlc } from "@/lib/placeInput";
import { t } from "@/strings/editor";
import { resolveShortLink, searchPlaces, type Place } from "./api";

export interface Picked {
  lng: number;
  lat: number;
  label: string;
}

interface Props {
  heading?: string;
  label: string;
  getCenter(): [number, number];
  onPick(p: Picked): void;
  onPreview?(p: [number, number]): void;
  autoFocus?: boolean;
  showLocate?: boolean;
}

interface Row extends Place {
  pinned?: boolean;
  name?: string;
}

type Status = "idle" | "loading" | "done" | "error";

class LookupError extends Error {}

const fmt = (lng: number, lat: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

function pin(lng: number, lat: number, title: string, name?: string): Row {
  return { label: title, sub: name ? `${name}, ${fmt(lng, lat)}` : fmt(lng, lat), lng, lat, pinned: true, name };
}

async function lookup(query: string, center: [number, number], deep: boolean, signal: AbortSignal): Promise<Row[]> {
  const parsed = parsePlaceInput(query, center);
  if (parsed?.kind === "point") {
    const title =
      parsed.source === "pluscode" ? t.pinnedFromCode : parsed.source === "coords" ? t.pinnedFromCoords : t.pinnedFromLink;
    return [pin(parsed.lng, parsed.lat, title, parsed.label)];
  }
  if (parsed?.kind === "shortlink") {
    const r = await resolveShortLink(parsed.url, signal);
    if (!r) throw new LookupError(t.resolveError);
    if ("query" in r) return searchPlaces(r.query, center, signal, deep);
    return [pin(r.lng, r.lat, t.pinnedFromLink, r.label)];
  }
  if (parsed?.kind === "linkquery") return searchPlaces(parsed.query, center, signal, deep);
  if (parsed?.kind === "pluscode-locality") {
    const area = (await searchPlaces(parsed.locality, center, signal))[0];
    const p = area ? recoverOlc(parsed.code, area.lat, area.lng) : null;
    if (!p) throw new LookupError(t.codeAreaMissing);
    return [pin(p.lng, p.lat, t.pinnedFromCode)];
  }
  return searchPlaces(query, center, signal, deep);
}

export default function PlaceSearch({ heading, label, getCenter, onPick, onPreview, autoFocus, showLocate = true }: Props) {
  const id = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [resultsFor, setResultsFor] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [deepFor, setDeepFor] = useState("");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const centerRef = useRef(getCenter);
  const previewRef = useRef(onPreview);
  const deepCtrl = useRef<AbortController | null>(null);

  useEffect(() => {
    centerRef.current = getCenter;
    previewRef.current = onPreview;
  }, [getCenter, onPreview]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3 && !parsePlaceInput(query, centerRef.current())) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setStatus("loading");
      setMessage(null);
      lookup(query, centerRef.current(), false, ctrl.signal)
        .then((rows) => {
          if (ctrl.signal.aborted) return;
          setResults(rows);
          setResultsFor(query);
          setStatus("done");
          if (rows.length === 1 && rows[0].pinned) previewRef.current?.([rows[0].lng, rows[0].lat]);
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
          setStatus("error");
          setMessage(err instanceof LookupError ? err.message : t.searchError);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  function searchDeep() {
    const query = q.trim();
    if (query.length < 2 || deepFor === query) return;
    deepCtrl.current?.abort();
    const ctrl = new AbortController();
    deepCtrl.current = ctrl;
    setDeepFor(query);
    setStatus("loading");
    lookup(query, centerRef.current(), true, ctrl.signal)
      .then((rows) => {
        if (ctrl.signal.aborted) return;
        setResults(rows);
        setResultsFor(query);
        setStatus("done");
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setStatus("error");
        setMessage(err instanceof LookupError ? err.message : t.searchError);
      });
  }

  function onChange(v: string) {
    setQ(v);
    setMessage(null);
    deepCtrl.current?.abort();
    if (v.trim().length < 3 && !parsePlaceInput(v, centerRef.current())) {
      setResults([]);
      setStatus("idle");
    }
  }

  function pick(r: Row) {
    onPick({ lng: r.lng, lat: r.lat, label: r.pinned ? (r.name ?? "") : r.label });
  }

  function locate() {
    setLocError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError(t.locationUnsupported);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onPick({ lng: pos.coords.longitude, lat: pos.coords.latitude, label: "" });
      },
      () => {
        setLocating(false);
        setLocError(t.locationDenied);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  const fresh = resultsFor === q.trim() && status === "done";
  const empty = fresh && results.length === 0;
  const onlyPin = fresh && results.length === 1 && !!results[0].pinned;

  return (
    <section className="flex flex-col gap-3" aria-labelledby={heading ? `${id}-h` : undefined}>
      {heading ? (
        <h2 id={`${id}-h`} className="text-lg font-semibold text-ink">
          {heading}
        </h2>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-q`} className="text-sm font-semibold text-ink-2">
          {label}
        </label>
        <div className="relative">
          <MagnifyingGlassIcon
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            id={`${id}-q`}
            className="field pl-9"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoFocus={autoFocus}
            placeholder={t.searchPlaceholder}
            value={q}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (onlyPin) pick(results[0]);
              else searchDeep();
            }}
            aria-controls={`${id}-list`}
            aria-describedby={`${id}-tip`}
          />
        </div>
      </div>
      <div aria-live="polite" className="text-sm text-ink-3 empty:hidden">
        {status === "loading" ? t.searching : null}
        {status === "error" && message ? <span className="text-danger">{message}</span> : null}
      </div>
      {results.length > 0 && status !== "idle" ? (
        <ul id={`${id}-list`} className="flex flex-col overflow-hidden rounded-[14px] border-[1.5px] border-line">
          {results.map((r, i) => (
            <li key={`${r.lng},${r.lat},${i}`} className="border-line [&+&]:border-t">
              <button
                type="button"
                className="flex min-h-11 w-full items-start gap-2 bg-surface px-3 py-2 text-left hover:bg-surface-2"
                onClick={() => pick(r)}
              >
                {r.pinned ? (
                  <PushPinIcon size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent-text" />
                ) : (
                  <MapPinIcon size={18} aria-hidden className="mt-0.5 shrink-0 text-ink-3" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-bold text-ink">{r.label}</span>
                  {r.sub ? <span className="block truncate text-sm text-ink-3">{r.sub}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {fresh && !onlyPin && deepFor !== q.trim() ? (
        <button type="button" className="btn btn-ghost self-start px-2 text-sm" onClick={searchDeep}>
          <MagnifyingGlassIcon size={16} aria-hidden />
          {t.searchMore}
        </button>
      ) : null}
      <p id={`${id}-tip`} className={`text-sm ${empty ? "text-ink-2" : "text-ink-3"}`}>
        {empty ? `${t.noResults} ` : null}
        {status === "idle" || empty ? t.searchTip : null}
      </p>
      {showLocate ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" onClick={locate} disabled={locating}>
            <CrosshairIcon size={18} weight="bold" aria-hidden />
            {locating ? t.locating : t.useLocation}
          </button>
          <span className="text-sm text-ink-3">{t.orTapMap}</span>
        </div>
      ) : null}
      {locError ? (
        <p role="alert" className="text-sm text-danger">
          {locError}
        </p>
      ) : null}
    </section>
  );
}
