import { projectRuns, type Box } from "@/app/r/og-draw";
import type { OgRun } from "@/app/r/og-params";
import { MODES } from "@/lib/modes";
import { MARK_HEAD, MARK_PATH } from "./markPaths";

export const OG = {
  width: 1200,
  height: 630,
  bg: "#f3f4f1",
  surface: "#ffffff",
  surface2: "#e9ebe6",
  ink: "#101214",
  ink2: "#3f444b",
  ink3: "#5e646c",
  line: "#d9dcd5",
  accent: "#ffc61a",
};

const cache = new Map<number, Promise<ArrayBuffer | null>>();

async function fetchFont(weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Overpass:wght@${weight}`, {
      signal: AbortSignal.timeout(4000),
    }).then((r) => r.text());
    const url = css.match(/src: url\((https:[^)]+\.ttf)\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function ogFonts() {
  const out: { name: string; data: ArrayBuffer; weight: 500 | 800 | 900; style: "normal" }[] = [];
  for (const weight of [500, 800, 900] as const) {
    if (!cache.has(weight)) cache.set(weight, fetchFont(weight));
    const data = await cache.get(weight)!;
    if (data) out.push({ name: "Overpass", data, weight, style: "normal" });
    else cache.delete(weight);
  }
  return out;
}

export function OgMark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" fill={OG.accent} />
      <path d={MARK_PATH} fill="none" stroke={OG.ink} strokeWidth="3.4" strokeLinecap="round" />
      <path d={MARK_HEAD} fill={OG.ink} stroke={OG.ink} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function OgRoute({ runs, box, stroke = 12 }: { runs: OgRun[]; box: Box; stroke?: number }) {
  const drawn = projectRuns(runs, box);
  const a = drawn[0].xy[0];
  const lastRun = drawn[drawn.length - 1].xy;
  const b = lastRun[lastRun.length - 1];
  return (
    <svg width={OG.width} height={OG.height} viewBox={`0 0 ${OG.width} ${OG.height}`} style={{ position: "absolute", left: 0, top: 0 }}>
      {drawn.map((r, i) => (
        <path
          key={i}
          d={r.xy.map(([x, y], j) => `${j ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={MODES[r.mode].color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={MODES[r.mode].dashed ? `1 ${stroke * 1.8}` : undefined}
        />
      ))}
      <circle cx={a[0]} cy={a[1]} r={stroke * 1.3} fill={OG.surface} stroke={OG.ink} strokeWidth={stroke * 0.6} />
      <rect x={b[0] - stroke * 2} y={b[1] - stroke * 2} width={stroke * 4} height={stroke * 4} rx={stroke * 0.8} fill={OG.accent} stroke={OG.ink} strokeWidth={stroke * 0.5} />
    </svg>
  );
}
