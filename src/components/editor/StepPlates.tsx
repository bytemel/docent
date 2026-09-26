"use client";

import { useEffect, useState } from "react";
import {
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
  ArrowUpIcon,
  ArrowUpLeftIcon,
  ArrowUpRightIcon,
  ArrowUUpLeftIcon,
  CheckIcon,
  FlagCheckeredIcon,
  MapPinIcon,
  NavigationArrowIcon,
  PencilSimpleIcon,
  SpeakerHighIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { Segment, Step } from "@/lib/types";
import { formatDistance } from "@/lib/geo";
import { segmentOffsets } from "@/lib/steps";
import { getVoice } from "@/lib/voice";
import { t } from "@/strings/editor";
import { MODE_ICON } from "./RouteStage";

export function stepGlyph(step: Step, segments: Segment[]): Icon {
  if (step.kind === "start") return NavigationArrowIcon;
  if (step.kind === "arrive") return FlagCheckeredIcon;
  if (step.kind === "landmark") return MapPinIcon;
  if (step.kind === "turn") {
    if (/u-turn/i.test(step.text)) return ArrowUUpLeftIcon;
    const right = /\bright\b/i.test(step.text);
    const left = /\bleft\b/i.test(step.text);
    if (/slightly|keep/i.test(step.text)) return right ? ArrowUpRightIcon : left ? ArrowUpLeftIcon : ArrowUpIcon;
    return right ? ArrowBendUpRightIcon : left ? ArrowBendUpLeftIcon : ArrowUpIcon;
  }
  const offsets = segmentOffsets(segments);
  let i = 0;
  while (i + 1 < offsets.length && offsets[i + 1] <= step.atM + 1) i++;
  return MODE_ICON[segments[i]?.mode ?? "walk"];
}

export function hear(text: string, interrupt = true) {
  const voice = getVoice();
  if (!voice.supported) return;
  if (!voice.enabled()) {
    voice.unlock();
    voice.setEnabled(true);
  }
  voice.speak(text, { interrupt });
}

export function hearAll(steps: Step[]) {
  const voice = getVoice();
  if (!voice.supported) return;
  if (!voice.enabled()) {
    voice.unlock();
    voice.setEnabled(true);
  }
  voice.cancel();
  steps.forEach((s, i) => voice.speak(s.text, { interrupt: i === 0 }));
}

interface Props {
  steps: Step[];
  segments: Segment[];
  onEdit(id: string, text: string): void;
  onReset(id: string): void;
}

export default function StepPlates({ steps, segments, onEdit, onReset }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => () => getVoice().cancel(), []);
  if (!steps.length) return <p className="text-sm text-ink-3 text-pretty">{t.stepsEmpty}</p>;
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const Glyph = stepGlyph(s, segments);
        const open = editing === s.id;
        return (
          <li key={s.id} className="sign flex gap-3 p-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-accent text-accent-ink">
              <Glyph size={30} weight="bold" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="num flex items-center gap-2 text-[12px] leading-none opacity-75">
                <span>{String(i + 1).padStart(2, "0")}</span>
                {s.atM > 0 ? (
                  <>
                    <span aria-hidden className="size-1 rounded-full bg-current opacity-60" />
                    <span>{t.stepAt(formatDistance(s.atM))}</span>
                  </>
                ) : null}
              </p>
              {open ? (
                <>
                  <label htmlFor={`step-${s.id}`} className="sr-only">
                    {t.stepText(i + 1)}
                  </label>
                  <textarea
                    id={`step-${s.id}`}
                    className="field resize-none py-2 text-[16px] font-semibold leading-snug"
                    rows={3}
                    autoFocus
                    value={s.text}
                    onChange={(e) => onEdit(s.id, e.target.value)}
                  />
                </>
              ) : (
                <p className="text-[17px] font-bold leading-snug text-pretty">{s.text}</p>
              )}
              {s.edited ? (
                <button
                  type="button"
                  className="-ml-1 min-h-9 self-start px-1 text-sm font-semibold underline underline-offset-2 opacity-80 hover:opacity-100"
                  onClick={() => onReset(s.id)}
                >
                  {t.resetStep}
                </button>
              ) : null}
            </div>
            <div className="-my-1 -mr-1 flex shrink-0 gap-0.5 self-start">
              <button
                type="button"
                className="grid size-11 place-items-center rounded-[12px] hover:bg-[color-mix(in_srgb,var(--sign-ink)_14%,transparent)]"
                aria-label={`${t.hearIt}: ${s.text}`}
                title={t.hearIt}
                onClick={() => hear(s.text)}
              >
                <SpeakerHighIcon size={20} weight="bold" aria-hidden />
              </button>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-[12px] hover:bg-[color-mix(in_srgb,var(--sign-ink)_14%,transparent)] aria-pressed:bg-[color-mix(in_srgb,var(--sign-ink)_18%,transparent)]"
                aria-label={open ? t.doneEditing : t.editStep}
                aria-pressed={open}
                title={open ? t.doneEditing : t.editStep}
                onClick={() => setEditing(open ? null : s.id)}
              >
                {open ? <CheckIcon size={20} weight="bold" aria-hidden /> : <PencilSimpleIcon size={20} weight="bold" aria-hidden />}
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
