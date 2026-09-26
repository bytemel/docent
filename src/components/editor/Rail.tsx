"use client";

import { t } from "@/strings/editor";
import { STAGES, type Stage } from "./types";

interface Props {
  stage: Stage;
  reachable(s: Stage): boolean;
  onGo(s: Stage): void;
}

export default function Rail({ stage, reachable, onGo }: Props) {
  const current = STAGES.indexOf(stage);
  return (
    <nav aria-label={t.progressLabel}>
      <ol className="grid grid-cols-4 gap-1.5">
        {STAGES.map((s, i) => {
          const done = i < current;
          const here = i === current;
          const can = reachable(s) && !here;
          return (
            <li key={s} className="min-w-0">
              <button
                type="button"
                disabled={!can}
                aria-current={here ? "step" : undefined}
                onClick={() => onGo(s)}
                className="group flex min-h-11 w-full min-w-0 flex-col justify-center gap-1.5 text-left disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className={`h-1 w-full rounded-[2px] ${here || done ? "bg-accent" : "bg-line"} ${here ? "" : done ? "opacity-70" : ""}`}
                />
                <span
                  className={`truncate text-[12px] leading-none min-[360px]:text-[13px] ${
                    here ? "font-bold text-ink" : done ? "font-semibold text-ink-2 group-enabled:underline-offset-2 group-enabled:group-hover:underline" : "font-semibold text-ink-3"
                  }`}
                >
                  <span className="num mr-1 text-[11px] max-[359px]:hidden">{i + 1}</span>
                  {t.stages[s].rail}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
