import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { OG_COLORS as C, RouteSvg } from "@/app/r/og-draw";
import { parseOg, type OgRun } from "@/app/r/og-params";
import { formatDistance } from "@/lib/geo";
import { MODES } from "@/lib/modes";
import { brand, og } from "@/strings/common";

const W = 1200;
const H = 630;
const BOX = { x: 660, y: 70, w: 470, h: 490 };
const CACHE = "public, max-age=86400, s-maxage=31536000, immutable";

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
        {hasRoute ? <RouteSvg runs={data.runs} box={BOX} /> : null}
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
