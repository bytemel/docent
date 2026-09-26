"use client";

import {
  ArrowsSplitIcon,
  BicycleIcon,
  CarIcon,
  MotorcycleIcon,
  PathIcon,
  PersonSimpleWalkIcon,
  PlusIcon,
  ScribbleIcon,
  VanIcon,
  WarningIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { Mode, Segment } from "@/lib/types";
import { MODES, MODE_ORDER } from "@/lib/modes";
import { formatDistance, formatDuration } from "@/lib/geo";
import { t } from "@/strings/editor";
import { waypoints } from "./ops";
import type { Tool } from "./types";
import { StopField } from "./StopField";

export type LegStatus = "loading" | "error" | "ok";

export const MODE_ICON: Record<Mode, Icon> = {
  walk: PersonSimpleWalkIcon,
  boda: MotorcycleIcon,
  matatu: VanIcon,
  car: CarIcon,
  bike: BicycleIcon,
};

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
}

export function Totals({ segments, busy }: { segments: Segment[]; busy: boolean }) {
  const total = segments.reduce((a, s) => a + s.distanceM, 0);
  const time = segments.reduce((a, s) => a + s.durationS, 0);
  const modes = segments.map((s) => s.mode).filter((m, i, all) => all.indexOf(m) === i);
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="min-w-0 flex-1">
        {busy ? (
          <span className="block h-6 w-40 animate-pulse rounded-[6px] bg-surface-2" aria-label={t.routing} />
        ) : (
          <p className="flex items-baseline gap-2">
            <span className="num text-[22px] font-bold leading-none text-ink">{formatDistance(total)}</span>
            <span className="num text-sm text-ink-2">about {formatDuration(time)}</span>
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1" aria-hidden>
        {modes.map((m) => {
          const I = MODE_ICON[m];
          return (
            <span key={m} className="grid size-8 place-items-center rounded-[10px] bg-surface-2 text-ink">
              <I size={18} weight="bold" />
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function RouteStage(p: Props) {
  const wps = waypoints(p.segments);
  const last = wps.length - 1;
  const name = (i: number) =>
    wps[i]?.label?.trim() || (i === 0 ? t.startLabel : i === last ? t.endLabel : t.stopName(i));
  return (
    <div className="flex flex-col gap-3">
      {p.segments.map((s, i) => (
        <div key={s.id} className="flex flex-col gap-3">
          <LegCard
            seg={s}
            n={i + 1}
            count={p.segments.length}
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
            <StopField
              index={i + 1}
              value={wps[i + 1]?.label ?? ""}
              focus={p.focusStop === i + 1}
              onLabel={p.onLabel}
              onRemove={() => p.onRemoveStop(i + 1)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ToolRow({
  icon: I,
  label,
  pressed,
  onClick,
}: {
  icon: Icon;
  label: string;
  pressed?: boolean;
  onClick(): void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={pressed}
        onClick={onClick}
        className="flex min-h-12 w-full items-center gap-3 px-3 text-left text-[15px] font-semibold text-ink hover:bg-surface-2 aria-pressed:bg-accent-soft"
      >
        <I size={20} weight="bold" aria-hidden className="shrink-0 text-ink-2" />
        {label}
      </button>
    </li>
  );
}

function LegCard({
  seg,
  n,
  count,
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
  count: number;
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
  const toggle = (kind: "via" | "draw" | "split") =>
    onTool(active(kind) ? { kind: "none" } : { kind, segId: seg.id });
  return (
    <article className="overflow-hidden rounded-[18px] border border-line bg-surface">
      <header className="flex items-center gap-3 px-3 pb-2.5 pt-3">
        <span aria-hidden className="h-8 w-1.5 shrink-0 self-stretch rounded-[2px]" style={{ background: MODES[seg.mode].color }} />
        <div className="min-w-0 flex-1">
          {count > 1 ? <p className="text-xs font-semibold text-ink-3">{t.legHeading(n)}</p> : null}
          <h3 className="text-[17px] font-bold leading-tight text-ink break-words">
            {fromName} <span className="font-semibold text-ink-3">to</span> {toName}
          </h3>
        </div>
        <div className="shrink-0 text-right" aria-live="polite">
          {status === "loading" ? (
            <span className="flex flex-col items-end gap-1.5" aria-label={t.routing}>
              <span className="h-4 w-14 animate-pulse rounded-[6px] bg-surface-2" />
              <span className="h-3 w-20 animate-pulse rounded-[6px] bg-surface-2" />
            </span>
          ) : status === "ok" && count > 1 ? (
            <>
              <p className="num text-[17px] font-bold leading-tight text-ink">{formatDistance(seg.distanceM)}</p>
              <p className="num text-xs text-ink-3">{formatDuration(seg.durationS)}</p>
            </>
          ) : null}
        </div>
      </header>
      <div role="group" aria-label={t.modesLabel} className="grid grid-cols-5 gap-1.5 px-3 pb-3">
        {MODE_ORDER.map((m) => {
          const I = MODE_ICON[m];
          const on = seg.mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => onMode(seg.id, m)}
              className="relative flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[12px] border-[1.5px] border-line bg-surface px-0.5 text-ink-2 transition-colors hover:border-ink-3 aria-pressed:border-sign aria-pressed:bg-sign aria-pressed:text-sign-ink"
            >
              <I size={24} weight={on ? "fill" : "bold"} aria-hidden />
              <span className="max-w-full truncate text-[11.5px] font-bold leading-none">{MODES[m].label}</span>
              {on ? (
                <span aria-hidden className="absolute inset-x-2 bottom-1 h-[3px] rounded-[2px]" style={{ background: MODES[m].color }} />
              ) : null}
            </button>
          );
        })}
      </div>
      {status === "error" ? (
        <div role="alert" className="mx-3 mb-3 flex flex-col items-start gap-2 rounded-[14px] bg-surface-2 p-3 text-sm text-danger">
          <span className="flex items-start gap-1.5">
            <WarningIcon size={18} weight="bold" aria-hidden className="mt-0.5 shrink-0" />
            {t.routeError}
          </span>
          <button type="button" className="btn" onClick={() => onRetry(seg.id)}>
            {t.retry}
          </button>
        </div>
      ) : null}
      {seg.drawn ? (
        <p className="px-3 pb-2 text-sm text-ink-3">{t.drawnNote}</p>
      ) : null}
      <ul aria-label={t.toolsLabel} className="divide-y divide-line border-t border-line">
        {!seg.drawn ? <ToolRow icon={PlusIcon} label={t.turnShort} pressed={active("via")} onClick={() => toggle("via")} /> : null}
        {seg.drawn ? (
          <ToolRow icon={PathIcon} label={t.useRoad} onClick={() => onRevert(seg.id)} />
        ) : (
          <ToolRow icon={ScribbleIcon} label={t.drawShort} pressed={active("draw")} onClick={() => toggle("draw")} />
        )}
        <ToolRow icon={ArrowsSplitIcon} label={t.changeShort} pressed={active("split")} onClick={() => toggle("split")} />
      </ul>
    </article>
  );
}
