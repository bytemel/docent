import type { LngLat, Waypoint } from "@/lib/types";

export type Tool =
  | { kind: "none" }
  | { kind: "via"; segId: string }
  | { kind: "split"; segId: string }
  | { kind: "draw"; segId: string }
  | { kind: "landmark" };

export type Stage = "where" | "route" | "directions" | "send";

export const STAGES: Stage[] = ["where", "route", "directions", "send"];

export interface Pending {
  start: Waypoint | null;
  end: Waypoint | null;
}

export interface ViaRef {
  segId: string;
  i: number;
}

export interface RouteHit {
  index: number;
  pos: LngLat;
  px: number;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
