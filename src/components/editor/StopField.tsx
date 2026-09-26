"use client";

import { useEffect, useRef } from "react";
import { TrashIcon } from "@phosphor-icons/react";
import { t } from "@/strings/editor";

interface Props {
  index: number;
  value: string;
  focus?: boolean;
  onLabel(index: number, label: string): void;
  onRemove(): void;
}

export function StopField({ index, value, focus, onLabel, onRemove }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focus) return;
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus]);
  const id = `stop-${index}`;
  return (
    <div className="flex gap-3 px-1">
      <span aria-hidden className="mt-9 grid size-7 shrink-0 place-items-center rounded-full border-[3px] border-ink bg-surface" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-semibold text-ink-2">
          {t.stopLabel}
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={ref}
            id={id}
            className="field min-w-0 flex-1 font-semibold"
            value={value}
            autoComplete="off"
            onChange={(e) => onLabel(index, e.target.value)}
          />
          <button
            type="button"
            className="btn btn-icon btn-ghost shrink-0"
            onClick={onRemove}
            aria-label={t.removeStop}
            title={t.removeStop}
          >
            <TrashIcon size={18} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
