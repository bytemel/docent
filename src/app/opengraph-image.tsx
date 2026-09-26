import { ImageResponse } from "next/og";
import { OG_COLORS as C, OG_SIZE, RouteSvg } from "@/app/r/og-draw";
import { ogQuery, parseOg } from "@/app/r/og-params";
import { EXAMPLE_DOC } from "@/lib/example";
import { brand, landing } from "@/strings/common";

export const alt = landing.headline;
export const size = OG_SIZE;
export const contentType = "image/png";

const BOX = { x: 700, y: 110, w: 420, h: 410 };

export default function Image() {
  const [, ride, walk] = EXAMPLE_DOC.segments;
  const tail = { ...EXAMPLE_DOC, segments: [{ ...ride, geometry: ride.geometry.slice(-5) }, walk] };
  const { runs } = parseOg(new URLSearchParams(ogQuery(tail)));
  return new ImageResponse(
    (
      <div style={{ width: size.width, height: size.height, display: "flex", position: "relative", background: C.bg, color: C.ink }}>
        <div
          style={{
            position: "absolute",
            left: BOX.x - 50,
            top: BOX.y - 50,
            width: BOX.w + 100,
            height: BOX.h + 100,
            borderRadius: 32,
            background: C.accentSoft,
          }}
        />
        {runs.length ? <RouteSvg runs={runs} box={BOX} stroke={12} /> : null}
        <div
          style={{
            position: "absolute",
            left: 80,
            top: 80,
            bottom: 80,
            width: 560,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 700 }}>
            <div style={{ width: 22, height: 22, borderRadius: 999, background: C.accent, marginRight: 14 }} />
            {brand.name}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.06, letterSpacing: -1.5 }}>{landing.headline}</div>
            <div style={{ marginTop: 28, fontSize: 30, lineHeight: 1.35, color: C.ink2 }}>{landing.subtext}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
