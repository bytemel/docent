import type { Timeline } from "@/lib/timeline";
import type { Step } from "@/lib/types";

export function stepMeters(tl: Timeline, steps: Step[]): number[] {
  return steps.map((s) =>
    s.kind === "start" ? 0 : s.kind === "arrive" ? tl.totalM : Number.isFinite(s.atM) ? s.atM : Infinity,
  );
}

export function stepAtMeters(stepsM: number[], atM: number, aheadM = 15): number {
  let idx = 0;
  for (let i = 0; i < stepsM.length; i++) if (stepsM[i] <= atM + aheadM) idx = i;
  return idx;
}
