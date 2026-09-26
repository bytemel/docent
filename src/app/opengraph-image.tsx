import { ImageResponse } from "next/og";
import { ogQuery, parseOg } from "@/app/r/og-params";
import { OG, OgMark, OgRoute, ogFonts } from "@/components/landing/og";
import { EXAMPLE_DOC } from "@/lib/example";
import { brand, landing } from "@/strings/common";

export const alt = landing.headline;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BOX = { x: 760, y: 120, w: 350, h: 390 };

export default async function Image() {
  const [, ride, walk] = EXAMPLE_DOC.segments;
  const tail = { ...EXAMPLE_DOC, segments: [{ ...ride, geometry: ride.geometry.slice(-5) }, walk] };
  const { runs } = parseOg(new URLSearchParams(ogQuery(tail)));
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ width: size.width, height: size.height, display: "flex", position: "relative", background: OG.bg, color: OG.ink, fontFamily: "Overpass" }}>
        <div style={{ position: "absolute", left: BOX.x - 60, top: BOX.y - 60, width: BOX.w + 120, height: BOX.h + 120, borderRadius: 32, background: OG.surface, border: `2px solid ${OG.line}` }} />
        {runs.length ? <OgRoute runs={runs} box={BOX} stroke={14} /> : null}
        <div style={{ position: "absolute", left: 72, top: 64, bottom: 64, width: 600, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <OgMark size={56} />
            <div style={{ marginLeft: 16, fontSize: 38, fontWeight: 800, letterSpacing: -0.5 }}>{brand.name}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 66, fontWeight: 900, lineHeight: 1.02, letterSpacing: -2 }}>{landing.headline}</div>
            <div style={{ marginTop: 26, fontSize: 30, fontWeight: 500, lineHeight: 1.3, color: OG.ink2 }}>{landing.subtext}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
