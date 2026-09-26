import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { parseOg, type OgRun } from "@/app/r/og-params";
import { formatDistance } from "@/lib/geo";
import { MODES } from "@/lib/modes";
import { brand, og } from "@/strings/common";

const W = 1200;
const H = 630;
const BOX = { x: 660, y: 70, w: 470, h: 490 };
const C = { bg: "#f6f6f4", surface: "#ffffff", ink: "#18181b", ink2: "#52525b", ink3: "#71717a", line: "#e2e2de" };
const CACHE = "public, max-age=86400, s-maxage=31536000, immutable";

function project(runs: OgRun[]) {
  const all = runs.flatMap((r) => r.points);
  const lat0 = all.reduce((s, p) => s + p[1], 0) / all.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = all.map((p) => p[0] * k);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const scale = Math.min(BOX.w / Math.max(maxX - minX, span * 0.2), BOX.h / Math.max(maxY - minY, span * 0.2));
  const ox = BOX.x + (BOX.w - (maxX - minX) * scale) / 2;
  const oy = BOX.y + (BOX.h - (maxY - minY) * scale) / 2;
  const to = (p: [number, number]) => [ox + (p[0] * k - minX) * scale, oy + (maxY - p[1]) * scale] as const;
  return runs.map((r) => ({ mode: r.mode, xy: r.points.map(to) }));
}

function RouteSvg({ runs }: { runs: OgRun[] }) {
  const drawn = project(runs);
  const first = drawn[0].xy[0];
  const lastRun = drawn[drawn.length - 1].xy;
  const last = lastRun[lastRun.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
      {drawn.map((r, i) => (
        <path
          key={i}
          d={r.xy.map(([x, y], j) => `${j ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={MODES[r.mode].color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={MODES[r.mode].dashed ? "2 18" : undefined}
        />
      ))}
      <circle cx={first[0]} cy={first[1]} r={15} fill={C.surface} stroke={C.ink} strokeWidth={6} />
      <circle cx={last[0]} cy={last[1]} r={17} fill={C.ink} stroke={C.surface} strokeWidth={6} />
    </svg>
  );
}

function modesLine(runs: OgRun[]): string {
  const out: string[] = [];
  for (const r of runs) {
    const label = MODES[r.mode].label.toLowerCase();
    if (out[out.length - 1] !== label) out.push(label);
  }
  return out.join(", ");
}

export async function GET(request: NextRequest) {
  const data = parseOg(request.nextUrl.searchParams);
  const hasRoute = data.runs.length > 0;
  const title = data.title || og.fallbackTitle;
  const meta = hasRoute
    ? [data.meters ? formatDistance(data.meters) : null, modesLine(data.runs)].filter(Boolean).join(": ")
    : og.fallbackBody;
  const titleSize = title.length > 70 ? 48 : title.length > 40 ? 58 : 68;
  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", background: C.bg, color: C.ink }}>
        {hasRoute ? (
          <div
            style={{
              position: "absolute",
              left: BOX.x - 30,
              top: BOX.y - 30,
              width: BOX.w + 60,
              height: BOX.h + 60,
              borderRadius: 28,
              background: C.surface,
              border: `2px solid ${C.line}`,
            }}
          />
        ) : null}
        {hasRoute ? <RouteSvg runs={data.runs} /> : null}
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 72,
            bottom: 72,
            width: hasRoute ? 520 : 1000,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>{title}</div>
            <div style={{ marginTop: 28, fontSize: 32, color: C.ink2 }}>{meta}</div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, color: C.ink3 }}>{brand.name}</div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { "Cache-Control": CACHE } },
  );
}
