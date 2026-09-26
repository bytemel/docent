"use client";

import type { Walker } from "@/lib/types";
import { t } from "@/strings/editor";

interface Props {
  title: string;
  titlePlaceholder: string;
  arrival: string;
  walker: Walker;
  onTitle(v: string): void;
  onArrival(v: string): void;
  onWalker(w: Walker): void;
}

const WALKERS: Walker[] = ["neutral", "man", "woman"];

export default function DetailsTab(p: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="details-title" className="text-sm font-medium text-ink-2">
          {t.detailsTitle}
        </label>
        <input
          id="details-title"
          className="field"
          value={p.title}
          placeholder={p.titlePlaceholder}
          onChange={(e) => p.onTitle(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="details-arrival" className="text-sm font-medium text-ink-2">
          {t.arrivalLabel}
        </label>
        <textarea
          id="details-arrival"
          className="field resize-none py-2.5 leading-snug"
          rows={3}
          value={p.arrival}
          placeholder={t.arrivalPlaceholder}
          onChange={(e) => p.onArrival(e.target.value)}
        />
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-ink-2">{t.walkerLabel}</legend>
        <div className="flex flex-wrap gap-1.5">
          {WALKERS.map((w) => (
            <button
              key={w}
              type="button"
              className="chip min-h-11"
              aria-pressed={p.walker === w}
              onClick={() => p.onWalker(w)}
            >
              {t.walkers[w]}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
