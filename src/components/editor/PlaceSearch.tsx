"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CrosshairIcon, MagnifyingGlassIcon, MapPinIcon } from "@phosphor-icons/react";
import { t } from "@/strings/editor";
import { searchPlaces, type Place } from "./api";

interface Props {
  heading: string;
  label: string;
  getCenter(): [number, number];
  onPick(p: { lng: number; lat: number; label: string }): void;
  autoFocus?: boolean;
}

type Status = "idle" | "loading" | "done" | "error";

export default function PlaceSearch({ heading, label, getCenter, onPick, autoFocus }: Props) {
  const id = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [resultsFor, setResultsFor] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const centerRef = useRef(getCenter);

  useEffect(() => {
    centerRef.current = getCenter;
  }, [getCenter]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setStatus("loading");
      searchPlaces(query, centerRef.current(), ctrl.signal)
        .then((r) => {
          setResults(r);
          setResultsFor(query);
          setStatus("done");
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setStatus("error");
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  function onChange(v: string) {
    setQ(v);
    if (v.trim().length < 3) {
      setResults([]);
      setStatus("idle");
    }
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

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-lg font-semibold text-ink">
        {heading}
      </h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-q`} className="text-sm font-medium text-ink-2">
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
              if (status === "done" && resultsFor === q.trim() && results[0]) onPick(results[0]);
            }}
            aria-controls={`${id}-list`}
          />
        </div>
      </div>
      <div aria-live="polite" className="text-sm text-ink-3 empty:hidden">
        {status === "loading" ? t.searching : null}
        {status === "done" && results.length === 0 ? t.noResults : null}
        {status === "error" ? <span className="text-danger">{t.searchError}</span> : null}
      </div>
      {results.length > 0 && status !== "idle" ? (
        <ul id={`${id}-list`} className="flex flex-col overflow-hidden rounded-[12px] border border-line">
          {results.map((r, i) => (
            <li key={`${r.lng},${r.lat},${i}`} className="border-line [&+&]:border-t">
              <button
                type="button"
                className="flex min-h-11 w-full items-start gap-2 bg-surface px-3 py-2 text-left hover:bg-surface-2"
                onClick={() => onPick(r)}
              >
                <MapPinIcon size={18} aria-hidden className="mt-0.5 shrink-0 text-ink-3" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{r.label}</span>
                  {r.sub ? <span className="block truncate text-sm text-ink-3">{r.sub}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={locate} disabled={locating}>
          <CrosshairIcon size={18} aria-hidden />
          {locating ? t.locating : t.useLocation}
        </button>
        <span className="text-sm text-ink-3">{t.orTapMap}</span>
      </div>
      {locError ? (
        <p role="alert" className="text-sm text-danger">
          {locError}
        </p>
      ) : null}
    </section>
  );
}
