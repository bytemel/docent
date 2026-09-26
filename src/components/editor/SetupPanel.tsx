"use client";

import { CheckIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { t } from "@/strings/editor";
import PlaceSearch, { type Picked } from "./PlaceSearch";
import type { Pending } from "./types";

interface Props {
  pending: Pending;
  naming: string[];
  getCenter(): [number, number];
  onPick(which: "start" | "end", p: Picked): void;
  onPreview(p: [number, number]): void;
  onReset(which: "start" | "end"): void;
  onLabel(which: "start" | "end", label: string): void;
  onAsk(): void;
}

export function Progress({ step }: { step: 0 | 1 | 2 }) {
  const items = [t.progress.start, t.progress.end, t.progress.route];
  return (
    <ol aria-label={t.progressLabel} className="flex items-center gap-1.5">
      {items.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={label} className="flex min-w-0 items-center gap-1.5" aria-current={current ? "step" : undefined}>
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                done ? "bg-ink text-bg" : current ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-3"
              }`}
            >
              {done ? <CheckIcon size={14} weight="bold" aria-hidden /> : i + 1}
            </span>
            <span className={`truncate text-sm ${current ? "font-semibold text-ink" : "text-ink-3"}`}>{label}</span>
            {i < items.length - 1 ? <span aria-hidden className="mx-0.5 h-px w-4 shrink-0 bg-line" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export default function SetupPanel({ pending, naming, getCenter, onPick, onPreview, onReset, onLabel, onAsk }: Props) {
  const start = pending.start;
  const busy = start ? naming.includes(`${start.lng},${start.lat}`) : false;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Progress step={start ? 1 : 0} />
        {!start ? <p className="text-[15px] leading-snug text-ink-2">{t.intro}</p> : null}
      </div>
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
          onPreview={onPreview}
        />
      ) : (
        <>
          <PlaceSearch
            key="start"
            heading={t.startHeading}
            label={t.searchLabelStart}
            getCenter={getCenter}
            onPick={(p) => onPick("start", p)}
            onPreview={onPreview}
          />
          <div className="flex items-center gap-3 text-sm text-ink-3" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            {t.orDivider}
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface-2 p-3">
            <p className="text-sm text-ink-2">{t.askTheirLocationHint}</p>
            <button type="button" className="btn self-start" onClick={onAsk}>
              <PaperPlaneTiltIcon size={18} aria-hidden />
              {t.askTheirLocation}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
