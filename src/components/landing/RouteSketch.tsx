import { cumulative, nearestOnLine } from "@/lib/geo";
import { MODES } from "@/lib/modes";
import { segmentOffsets } from "@/lib/steps";
import type { LngLat, Mode, RouteDoc } from "@/lib/types";

interface Props {
  doc: RouteDoc;
  fromM?: number;
  toM?: number;
  width?: number;
  height?: number;
  stroke?: number;
  landmarks?: boolean;
  className?: string;
}

export default function RouteSketch({
  doc,
  fromM = 0,
  toM = Infinity,
  width = 640,
  height = 360,
  stroke = 6,
  landmarks = false,
  className,
}: Props) {
  const offsets = segmentOffsets(doc.segments);
  const runs: { mode: Mode; pts: LngLat[] }[] = [];
  doc.segments.forEach((s, i) => {
    const cum = cumulative(s.geometry);
    const pts = s.geometry.filter((_, j) => offsets[i] + cum[j] >= fromM && offsets[i] + cum[j] <= toM);
    if (pts.length >= 2) runs.push({ mode: s.mode, pts });
  });
  if (!runs.length) return null;
  const all = runs.flatMap((r) => r.pts);
  const lat0 = all.reduce((a, p) => a + p[1], 0) / all.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = all.map((p) => p[0] * k);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = stroke * 4;
  const scale = Math.min((width - pad * 2) / Math.max(maxX - minX, 1e-9), (height - pad * 2) / Math.max(maxY - minY, 1e-9));
  const ox = (width - (maxX - minX) * scale) / 2;
  const oy = (height - (maxY - minY) * scale) / 2;
  const to = (p: LngLat) => [ox + (p[0] * k - minX) * scale, oy + (maxY - p[1]) * scale] as const;
  const inView = (p: LngLat) => {
    const [x, y] = to(p);
    return x > pad / 2 && x < width - pad / 2 && y > pad / 2 && y < height - pad / 2;
  };
  const stops = runs.slice(1).map((r) => to(r.pts[0]));
  const a = to(runs[0].pts[0]);
  const lastPts = runs[runs.length - 1].pts;
  const b = to(lastPts[lastPts.length - 1]);
  const pins = landmarks
    ? doc.landmarks.filter((l) => !l.hidden && inView([l.lng, l.lat]) && runs.some((r) => nearestOnLine([l.lng, l.lat], r.pts).d < 70))
    : [];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {runs.map((r, i) => (
        <path
          key={i}
          d={r.pts.map((p, j) => `${j ? "L" : "M"}${to(p)[0].toFixed(1)} ${to(p)[1].toFixed(1)}`).join(" ")}
          fill="none"
          stroke={MODES[r.mode].color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={MODES[r.mode].dashed ? `0.1 ${stroke * 1.9}` : undefined}
        />
      ))}
      {pins.map((l) => {
        const [x, y] = to([l.lng, l.lat]);
        return <circle key={l.id} cx={x} cy={y} r={stroke * 0.75} style={{ fill: "var(--surface)", stroke: "var(--ink-3)" }} strokeWidth={stroke * 0.35} />;
      })}
      {stops.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={stroke * 1.1} style={{ fill: "var(--surface)", stroke: "var(--ink)" }} strokeWidth={stroke * 0.45} />
      ))}
      {fromM <= 0 ? (
        <circle cx={a[0]} cy={a[1]} r={stroke * 1.4} style={{ fill: "var(--surface)", stroke: "var(--ink)" }} strokeWidth={stroke * 0.55} />
      ) : null}
      <circle cx={b[0]} cy={b[1]} r={stroke * 1.6} style={{ fill: "var(--ink)", stroke: "var(--surface)" }} strokeWidth={stroke * 0.55} />
    </svg>
  );
}
