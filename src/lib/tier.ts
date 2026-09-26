export type Tier = "3d" | "2d" | "basic";

export interface TierEnv {
  reducedMotion: boolean;
  webgl2: boolean;
  deviceMemory?: number;
  cores?: number;
}

export const TIER_ORDER: Tier[] = ["3d", "2d", "basic"];

export const MIN_FPS = 30;

export function pickTier(env: TierEnv): Tier {
  if (env.reducedMotion) return "basic";
  if (!env.webgl2) return "basic";
  if (env.deviceMemory !== undefined && env.deviceMemory <= 2) return "2d";
  if (env.cores !== undefined && env.cores <= 4) return "2d";
  return "3d";
}

export function shouldDowngrade(fpsSamples: number[]): boolean {
  let n = 0;
  let sum = 0;
  for (const f of fpsSamples) {
    if (!Number.isFinite(f) || f < 0) continue;
    sum += f;
    n++;
  }
  if (n < 3) return false;
  return sum / n < MIN_FPS;
}

export function lowerTier(tier: Tier): Tier {
  if (tier === "3d") return "2d";
  return "basic";
}
