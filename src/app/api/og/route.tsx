import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { parseOg, type OgRun } from "@/app/r/og-params";
import { OG, OgMark, OgRoute, ogFonts } from "@/components/landing/og";
import { formatDistance } from "@/lib/geo";
import { MODES } from "@/lib/modes";
import { brand, og } from "@/strings/common";

const BOX = { x: 700, y: 95, w: 410, h: 440 };
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
  const titleSize = title.length > 70 ? 50 : title.length > 36 ? 60 : 72;
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ width: OG.width, height: OG.height, display: "flex", position: "relative", background: OG.bg, color: OG.ink, fontFamily: "Overpass" }}>
        <div
          style={{
            position: "absolute",
            left: BOX.x - 45,
            top: BOX.y - 45,
            width: BOX.w + 90,
            height: BOX.h + 90,
            borderRadius: 28,
            background: hasRoute ? OG.surface : OG.accent,
            border: `2px solid ${hasRoute ? OG.line : OG.accent}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {hasRoute ? null : <OgMark size={260} />}
        </div>
        {hasRoute ? <OgRoute runs={data.runs} box={BOX} /> : null}
        <div style={{ position: "absolute", left: 72, top: 64, bottom: 64, width: 540, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <OgMark size={52} />
            <div style={{ marginLeft: 16, fontSize: 36, fontWeight: 800, letterSpacing: -0.5 }}>{brand.name}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: titleSize, fontWeight: 900, lineHeight: 1.04, letterSpacing: -2 }}>{title}</div>
            {hasRoute ? (
              <div style={{ display: "flex", marginTop: 30 }}>
                <div style={{ display: "flex", alignItems: "center", background: OG.ink, color: OG.bg, borderRadius: 16, padding: "14px 22px", fontSize: 30, fontWeight: 800 }}>
                  {data.meters ? <span style={{ marginRight: 18, color: OG.accent }}>{formatDistance(data.meters)}</span> : null}
                  <span>{modesLine(data.runs)}</span>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 24, fontSize: 32, fontWeight: 500, color: OG.ink2 }}>{og.fallbackBody}</div>
            )}
          </div>
        </div>
      </div>
    ),
    { width: OG.width, height: OG.height, fonts: fonts.length ? fonts : undefined, headers: { "Cache-Control": CACHE } },
  );
}
