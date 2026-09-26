import type { Mode } from "./types";

export type RoutingProfile = "foot" | "car" | "bike";

export interface ModeInfo {
  label: string;
  verb: string;
  color: string;
  speedKmh: number;
  profile: RoutingProfile;
  dashed: boolean;
}

export const MODE_ORDER: Mode[] = ["walk", "boda", "matatu", "car", "bike"];

export const MODES: Record<Mode, ModeInfo> = {
  walk: { label: "Walk", verb: "Walk", color: "#D9480F", speedKmh: 4.8, profile: "foot", dashed: true },
  boda: { label: "Boda", verb: "Take a boda", color: "#0B7A75", speedKmh: 25, profile: "car", dashed: false },
  matatu: { label: "Matatu", verb: "Take a matatu", color: "#B7791F", speedKmh: 18, profile: "car", dashed: false },
  car: { label: "Car", verb: "Drive", color: "#2F5BD3", speedKmh: 28, profile: "car", dashed: false },
  bike: { label: "Bicycle", verb: "Cycle", color: "#4D7C0F", speedKmh: 14, profile: "bike", dashed: false },
};

export function estimateSeconds(mode: Mode, distanceM: number): number {
  return Math.round((distanceM / 1000 / MODES[mode].speedKmh) * 3600);
}
