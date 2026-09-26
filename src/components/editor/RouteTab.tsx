"use client";

import { useEffect, useRef } from "react";
import { ArrowsSplitIcon, PaperPlaneTiltIcon, PathIcon, PlusIcon, ScribbleIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import type { Mode, Segment } from "@/lib/types";
import { MODES, MODE_ORDER } from "@/lib/modes";
import { formatDistance, formatDuration } from "@/lib/geo";
import { t } from "@/strings/editor";
import { waypoints } from "./ops";
import { Progress } from "./SetupPanel";
import type { Tool } from "./types";

export type LegStatus = "loading" | "error" | "ok";

interface Props {
  segments: Segment[];
  status(seg: Segment): LegStatus;
  tool: Tool;
  focusStop: number | null;
  onMode(id: string, mode: Mode): void;
  onTool(tool: Tool): void;
  onRevert(id: string): void;
  onRetry(id: string): void;
  onLabel(index: number, label: string): void;
  onRemoveStop(index: number): void;
  onAsk(): void;
}

function WaypointField({
  index,
  label,
  value,
  onLabel,
  focus,
  onRemove,
}: {
  index: number;
  label: string;
  value: string;
  onLabel(index: number, label: string): void;
  focus?: boolean;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus) {
      ref.current?.focus();
      ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focus]);
  const id = `wp-${index}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          id={id}
          className="field min-w-0 flex-1"
          value={value}
          onChange={(e) => onLabel(index, e.target.value)}
          autoComplete="off"
        />
        {onRemove ? (
          <button type="button" className="btn btn-icon btn-ghost shrink-0" onClick={onRemove} aria-label={t.removeStop} title={t.removeStop}>
            <TrashIcon size={18} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function RouteTab(p: Props) {
  const wps = waypoints(p.segments);
  const last = wps.length - 1;
  const name = (i: number) =>
    wps[i]?.label?.trim() || (i === 0 ? t.startLabel : i === last ? t.endLabel : t.stopName(i));
  const total = p.segments.reduce((a, s) => a + s.distanceM, 0);
  const time = p.segments.reduce((a, s) => a + s.durationS, 0);
  const busy = p.segments.some((s) => p.status(s) === "loading");

  return (
    <div className="flex flex-col gap-4">
      <Progress step={2} />
      <p className="text-sm text-ink-2" aria-live="polite">
        <span className="font-semibold text-ink">{t.total}: </span>
        {busy ? t.routing : t.distTime(formatDistance(total), formatDuration(time))}
      </p>
      <WaypointField index={0} label={t.startLabel} value={wps[0]?.label ?? ""} onLabel={p.onLabel} />
      {p.segments.map((s, i) => (
        <div key={s.id} className="flex flex-col gap-4">
          <LegCard
            seg={s}
            n={i + 1}
            fromName={name(i)}
            toName={name(i + 1)}
            status={p.status(s)}
            tool={p.tool}
            onMode={p.onMode}
            onTool={p.onTool}
            onRevert={p.onRevert}
            onRetry={p.onRetry}
          />
          {i < p.segments.length - 1 ? (
            <WaypointField
              index={i + 1}
              label={t.stopLabel}
              value={wps[i + 1]?.label ?? ""}
              onLabel={p.onLabel}
              focus={p.focusStop === i + 1}
              onRemove={() => p.onRemoveStop(i + 1)}
            />
          ) : null}
        </div>
      ))}
      <WaypointField index={last} label={t.endLabel} value={wps[last]?.label ?? ""} onLabel={p.onLabel} />
      <div className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface-2 p-3">
        <p className="text-sm text-ink-2">{t.askTheirLocationHint}</p>
        <button type="button" className="btn self-start" onClick={p.onAsk}>
          <PaperPlaneTiltIcon size={18} aria-hidden />
          {t.askTheirLocation}
        </button>
      </div>
    </div>
  );
}

function LegCard({
  seg,
  n,
  fromName,
  toName,
  status,
  tool,
  onMode,
  onTool,
  onRevert,
  onRetry,
}: {
  seg: Segment;
  n: number;
  fromName: string;
  toName: string;
  status: LegStatus;
  tool: Tool;
  onMode(id: string, mode: Mode): void;
  onTool(tool: Tool): void;
  onRevert(id: string): void;
  onRetry(id: string): void;
}) {
  const active = (kind: Tool["kind"]) => tool.kind === kind && "segId" in tool && tool.segId === seg.id;
  return (
    <article className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface p-3">
      <header className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-1.5 size-3 shrink-0 rounded-full"
          style={{ background: MODES[seg.mode].color }}
        />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{t.legHeading(n)}</p>
          <h3 className="break-words font-semibold text-ink">{t.legFromTo(fromName, toName)}</h3>
        </div>
      </header>
      <div role="group" aria-label={t.modesLabel} className="flex flex-wrap gap-1.5">
        {MODE_ORDER.map((m) => (
          <button
            key={m}
            type="button"
            className="chip min-h-11"
            aria-pressed={seg.mode === m}
            onClick={() => onMode(seg.id, m)}
          >
            {MODES[m].label}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="min-h-6 text-sm text-ink-2">
        {status === "loading" ? (
          <span className="flex items-center gap-2" aria-label={t.routing}>
            <span className="h-3 w-16 animate-pulse rounded-full bg-surface-2" />
            <span className="h-3 w-12 animate-pulse rounded-full bg-surface-2" />
          </span>
        ) : status === "error" ? (
          <span className="flex flex-col items-start gap-2 text-danger">
            <span className="flex items-start gap-1.5">
              <WarningIcon size={18} aria-hidden className="mt-0.5 shrink-0" />
              {t.routeError}
            </span>
            <button type="button" className="btn" onClick={() => onRetry(seg.id)}>
              {t.retry}
            </button>
          </span>
        ) : (
          <span>
            {t.distTime(formatDistance(seg.distanceM), formatDuration(seg.durationS))}
            {seg.drawn ? <span className="text-ink-3"> ({t.drawnNote})</span> : null}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {!seg.drawn ? (
          <button
            type="button"
            className="btn aria-pressed:border-accent aria-pressed:bg-accent-soft"
            aria-pressed={active("via")}
            onClick={() => onTool(active("via") ? { kind: "none" } : { kind: "via", segId: seg.id })}
          >
            <PlusIcon size={18} aria-hidden />
            {t.addTurn}
          </button>
        ) : null}
        {seg.drawn ? (
          <button type="button" className="btn" onClick={() => onRevert(seg.id)}>
            <PathIcon size={18} aria-hidden />
            {t.useRoad}
          </button>
        ) : (
          <button
            type="button"
            className="btn aria-pressed:border-accent aria-pressed:bg-accent-soft"
            aria-pressed={active("draw")}
            onClick={() => onTool(active("draw") ? { kind: "none" } : { kind: "draw", segId: seg.id })}
          >
            <ScribbleIcon size={18} aria-hidden />
            {t.drawIt}
          </button>
        )}
        <button
          type="button"
          className="btn aria-pressed:border-accent aria-pressed:bg-accent-soft"
          aria-pressed={active("split")}
          onClick={() => onTool(active("split") ? { kind: "none" } : { kind: "split", segId: seg.id })}
        >
          <ArrowsSplitIcon size={18} aria-hidden />
          {t.changeHere}
        </button>
      </div>
    </article>
  );
}
