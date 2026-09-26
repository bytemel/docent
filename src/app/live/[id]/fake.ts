import { bearing, pointAt } from "@/lib/geo";
import type { LiveFix, LiveStatus } from "@/lib/live";
import type { LngLat } from "@/lib/types";

export const FAKE_MODES = ["live", "offline", "stopped", "waiting"] as const;
export type FakeMode = (typeof FAKE_MODES)[number];

export function startFakeFeed(
  mode: FakeMode,
  coords: LngLat[],
  cum: number[],
  onFix: (fix: LiveFix) => void,
  onStatus: (status: LiveStatus) => void,
): () => void {
  onStatus("connecting");
  if (mode === "waiting") return () => {};
  const total = cum[cum.length - 1] ?? 0;
  let atM = total * 0.3;
  let t = Date.now() - 120_000;
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647) * 2 - 1;
  };
  const burst = mode === "live" ? 30 : 40;
  let sent = 0;
  const tick = () => {
    const { pos } = pointAt(coords, cum, atM);
    const ahead = pointAt(coords, cum, Math.min(total, atM + 10)).pos;
    const jitter = 6 / 111320;
    onFix({
      lng: pos[0] + rnd() * jitter,
      lat: pos[1] + rnd() * jitter,
      acc: 12,
      heading: Math.round(bearing(pos, ahead)),
      speed: 5,
      t,
    });
    atM = Math.min(total, atM + 15);
    t += 3000;
    sent++;
    if (sent === burst && mode !== "live") onStatus(mode === "stopped" ? "stopped" : "offline");
  };
  const started = setTimeout(() => onStatus("live"), 400);
  const timer = setInterval(() => {
    if (mode !== "live" && sent >= burst) return;
    tick();
  }, 150);
  return () => {
    clearTimeout(started);
    clearInterval(timer);
  };
}
