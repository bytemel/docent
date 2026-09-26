"use client";

import { t } from "@/strings/editor";
import PlaceSearch from "./PlaceSearch";
import type { Pending } from "./types";

interface Props {
  pending: Pending;
  naming: string[];
  getCenter(): [number, number];
  onPick(which: "start" | "end", p: { lng: number; lat: number; label: string }): void;
  onReset(which: "start" | "end"): void;
  onLabel(which: "start" | "end", label: string): void;
}

export default function SetupPanel({ pending, naming, getCenter, onPick, onReset, onLabel }: Props) {
  const start = pending.start;
  const busy = start ? naming.includes(`${start.lng},${start.lat}`) : false;
  return (
    <div className="flex flex-col gap-5">
      {start ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="setup-start" className="text-sm font-medium text-ink-2">
            {t.startLabel}
          </label>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-bg"
            >
              A
            </span>
            <input
              id="setup-start"
              className="field min-w-0 flex-1"
              value={start.label ?? ""}
              placeholder={busy ? t.naming : t.unnamed}
              onChange={(e) => onLabel("start", e.target.value)}
            />
            <button type="button" className="btn btn-ghost shrink-0" onClick={() => onReset("start")}>
              {t.change}
            </button>
          </div>
        </div>
      ) : null}
      {start ? (
        <PlaceSearch
          key="end"
          heading={t.endHeading}
          label={t.searchLabelEnd}
          getCenter={getCenter}
          onPick={(p) => onPick("end", p)}
        />
      ) : (
        <PlaceSearch
          key="start"
          heading={t.startHeading}
          label={t.searchLabelStart}
          getCenter={getCenter}
          onPick={(p) => onPick("start", p)}
        />
      )}
    </div>
  );
}
