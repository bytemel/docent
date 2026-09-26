"use client";

import type { Step } from "@/lib/types";
import { t } from "@/strings/editor";

interface Props {
  steps: Step[];
  onEdit(id: string, text: string): void;
  onReset(id: string): void;
}

export default function StepsTab({ steps, onEdit, onReset }: Props) {
  if (!steps.length) return <p className="text-sm text-ink-3">{t.stepsEmpty}</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">{t.stepsIntro}</p>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.id} className="flex flex-col gap-1.5">
            <label htmlFor={`step-${s.id}`} className="text-sm font-medium text-ink-2">
              {t.stepText(i + 1)}
            </label>
            <textarea
              id={`step-${s.id}`}
              className="field resize-none py-2.5 leading-snug"
              rows={2}
              value={s.text}
              onChange={(e) => onEdit(s.id, e.target.value)}
            />
            {s.edited ? (
              <button
                type="button"
                className="min-h-11 self-start text-sm font-medium text-accent underline underline-offset-2"
                onClick={() => onReset(s.id)}
              >
                {t.resetStep}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
