import { MODES } from "@/lib/modes";
import type { OgRun } from "./og-params";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_COLORS = {
  bg: "#f6f6f4",
  surface: "#ffffff",
  ink: "#18181b",
  ink2: "#52525b",
  ink3: "#71717a",
  line: "#e2e2de",
  accent: "#d9480f",
  accentSoft: "#fbe6dc",
};

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function projectRuns(runs: OgRun[], box: Box) {
  const all = runs.flatMap((r) => r.points);
  const lat0 = all.reduce((s, p) => s + p[1], 0) / all.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = all.map((p) => p[0] * k);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const scale = Math.min(box.w / Math.max(maxX - minX, span * 0.2), box.h / Math.max(maxY - minY, span * 0.2));
  const ox = box.x + (box.w - (maxX - minX) * scale) / 2;
  const oy = box.y + (box.h - (maxY - minY) * scale) / 2;
  const to = (p: [number, number]) => [ox + (p[0] * k - minX) * scale, oy + (maxY - p[1]) * scale] as const;
  return runs.map((r) => ({ mode: r.mode, xy: r.points.map(to) }));
}

export function RouteSvg({ runs, box, stroke = 10 }: { runs: OgRun[]; box: Box; stroke?: number }) {
  const drawn = projectRuns(runs, box);
  const first = drawn[0].xy[0];
  const lastRun = drawn[drawn.length - 1].xy;
  const last = lastRun[lastRun.length - 1];
  const { width: W, height: H } = OG_SIZE;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
      {drawn.map((r, i) => (
        <path
          key={i}
          d={r.xy.map(([x, y], j) => `${j ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={MODES[r.mode].color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={MODES[r.mode].dashed ? `2 ${stroke * 1.8}` : undefined}
        />
      ))}
      <circle cx={first[0]} cy={first[1]} r={stroke * 1.5} fill={OG_COLORS.surface} stroke={OG_COLORS.ink} strokeWidth={stroke * 0.6} />
      <circle cx={last[0]} cy={last[1]} r={stroke * 1.7} fill={OG_COLORS.ink} stroke={OG_COLORS.surface} strokeWidth={stroke * 0.6} />
    </svg>
  );
}
