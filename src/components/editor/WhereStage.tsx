"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { PaperPlaneTiltIcon, TrashIcon } from "@phosphor-icons/react";
import type { Segment } from "@/lib/types";
import { t } from "@/strings/editor";
import PlaceSearch, { type Picked } from "./PlaceSearch";
import { waypoints } from "./ops";
import type { Pending } from "./types";

export function Badge({ kind, n }: { kind: "a" | "b" | "stop"; n?: number }) {
  const cls =
    kind === "a"
      ? "bg-ink text-bg"
      : kind === "b"
        ? "bg-accent text-accent-ink"
        : "border-[3px] border-ink bg-surface text-ink";
  return (
    <span aria-hidden className={`num grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${cls}`}>
      {kind === "a" ? "A" : kind === "b" ? "B" : (n ?? "")}
    </span>
  );
}

function Row({ badge, last, children }: { badge: ReactNode; last?: boolean; children: ReactNode }) {
  return (
    <li className="relative flex gap-3">
      <div className="flex w-8 shrink-0 flex-col items-center pt-7">
        {badge}
        {!last ? <span aria-hidden className="mt-1 w-[3px] flex-1 rounded-[2px] bg-line" /> : null}
      </div>
      <div className="min-w-0 flex-1 pb-4">{children}</div>
    </li>
  );
}

function LabelField({
  id,
  label,
  value,
  placeholder,
  onChange,
  action,
  focus,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange(v: string): void;
  action?: ReactNode;
  focus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focus) return;
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus]);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          id={id}
          className="field min-w-0 flex-1 font-semibold"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
        {action}
      </div>
    </div>
  );
}

export function AskCard({ onAsk }: { onAsk(): void }) {
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface-2 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-accent text-accent-ink">
          <PaperPlaneTiltIcon size={22} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight text-ink">{t.askCardTitle}</p>
          <p className="text-sm leading-snug text-ink-2 text-pretty">{t.askTheirLocationHint}</p>
        </div>
      </div>
      <button type="button" className="btn btn-sign w-full" onClick={onAsk}>
        {t.askTheirLocation}
      </button>
    </div>
  );
}

interface SetupProps {
  pending: Pending;
  naming: string[];
  getCenter(): [number, number];
  onPick(which: "start" | "end", p: Picked): void;
  onPreview(p: [number, number]): void;
  onReset(which: "start" | "end"): void;
  onLabel(which: "start" | "end", label: string): void;
  onAsk(): void;
}

export function WhereSetup({ pending, naming, getCenter, onPick, onPreview, onReset, onLabel, onAsk }: SetupProps) {
  const start = pending.start;
  const busy = start ? naming.includes(`${start.lng},${start.lat}`) : false;
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col">
        <Row badge={<Badge kind="a" />}>
          {start ? (
            <LabelField
              id="setup-start"
              label={t.startLabel}
              value={start.label ?? ""}
              placeholder={busy ? t.naming : t.unnamed}
              onChange={(v) => onLabel("start", v)}
              action={
                <button type="button" className="btn btn-ghost shrink-0 px-3" onClick={() => onReset("start")}>
                  {t.change}
                </button>
              }
            />
          ) : (
            <PlaceSearch
              key="start"
              label={t.startHeading}
              getCenter={getCenter}
              onPick={(p) => onPick("start", p)}
              onPreview={onPreview}
            />
          )}
        </Row>
        <Row badge={<Badge kind="b" />} last>
          {start ? (
            <PlaceSearch
              key="end"
              label={t.endHeading}
              getCenter={getCenter}
              onPick={(p) => onPick("end", p)}
              onPreview={onPreview}
              autoFocus
            />
          ) : (
            <div className="flex flex-col gap-1.5 pt-0.5">
              <p className="text-sm font-semibold text-ink-3 text-pretty">{t.endHeading}</p>
              <p className="flex min-h-12 items-center rounded-[14px] border-[1.5px] border-dashed border-line px-3.5 text-ink-3 text-pretty">
                {t.endLabel}
              </p>
            </div>
          )}
        </Row>
      </ol>
      {!start ? <AskCard onAsk={onAsk} /> : null}
    </div>
  );
}

interface EditProps {
  segments: Segment[];
  focusStop: number | null;
  onLabel(index: number, label: string): void;
  onRemoveStop(index: number): void;
}

export function WhereEdit({ segments, focusStop, onLabel, onRemoveStop }: EditProps) {
  const wps = waypoints(segments);
  const last = wps.length - 1;
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col">
        {wps.map((w, i) => (
          <Row
            key={i}
            last={i === last}
            badge={<Badge kind={i === 0 ? "a" : i === last ? "b" : "stop"} n={i} />}
          >
            <LabelField
              id={`wp-${i}`}
              label={i === 0 ? t.startLabel : i === last ? t.endLabel : t.stopLabel}
              value={w.label ?? ""}
              placeholder={t.unnamed}
              focus={focusStop === i}
              onChange={(v) => onLabel(i, v)}
              action={
                i > 0 && i < last ? (
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost shrink-0"
                    onClick={() => onRemoveStop(i)}
                    aria-label={t.removeStop}
                    title={t.removeStop}
                  >
                    <TrashIcon size={18} aria-hidden />
                  </button>
                ) : null
              }
            />
          </Row>
        ))}
      </ol>
      <p className="text-sm text-ink-3 text-pretty">{t.whereEditTip}</p>
    </div>
  );
}
