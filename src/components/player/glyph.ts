import type { Timeline } from "@/lib/timeline";
import type { Mode, Step } from "@/lib/types";

export type Glyph =
  | "start"
  | "arrive"
  | "left"
  | "right"
  | "slightLeft"
  | "slightRight"
  | "uturn"
  | "straight"
  | "landmark"
  | Mode;

export function turnGlyph(text: string): Glyph {
  const t = text.toLowerCase();
  if (/u-?turn|turn around/.test(t)) return "uturn";
  if (/slight(ly)? left|bear left|keep left/.test(t)) return "slightLeft";
  if (/slight(ly)? right|bear right|keep right/.test(t)) return "slightRight";
  if (/\bleft\b/.test(t)) return "left";
  if (/\bright\b/.test(t)) return "right";
  return "straight";
}

export function modeAt(tl: Timeline, atM: number): Mode {
  let mode: Mode = tl.legModes[0] ?? "walk";
  for (let i = 0; i < tl.legModes.length; i++) if (tl.legStartM[i] <= atM + 1) mode = tl.legModes[i];
  return mode;
}

export function glyphFor(step: Step, tl: Timeline): Glyph {
  if (step.kind === "start") return "start";
  if (step.kind === "arrive") return "arrive";
  if (step.kind === "landmark") return "landmark";
  if (step.kind === "mode") return modeAt(tl, Number.isFinite(step.atM) ? step.atM : 0);
  return turnGlyph(step.text);
}

export function plateText(text: string): string {
  const rest = text.replace(/^after [^,]+,\s*/i, "").trim();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : text;
}

export function stepGapMeters(steps: Step[], i: number, totalM: number): number | null {
  const s = steps[i];
  if (!s || s.kind === "start" || i === 0) return null;
  const at = s.kind === "arrive" ? totalM : s.atM;
  let prev = 0;
  for (let j = i - 1; j >= 0; j--) {
    const p = steps[j];
    const m = p.kind === "start" ? 0 : p.atM;
    if (Number.isFinite(m)) {
      prev = m;
      break;
    }
  }
  const d = at - prev;
  return Number.isFinite(d) && d >= 10 ? d : null;
}

export function stepLegMeters(steps: Step[], i: number, totalM: number): number | null {
  const s = steps[i];
  if (!s || s.kind === "arrive") return null;
  const from = s.kind === "start" ? 0 : s.atM;
  const next = steps.slice(i + 1).find((n) => Number.isFinite(n.atM) && n.atM > from + 1);
  const to = next ? (next.kind === "arrive" ? totalM : next.atM) : totalM;
  const d = to - from;
  return Number.isFinite(d) && d > 0 ? d : null;
}
