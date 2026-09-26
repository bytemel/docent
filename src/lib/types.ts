export type LngLat = [number, number];

export type Mode = "walk" | "boda" | "car" | "matatu" | "bike";

export type Walker = "neutral" | "man" | "woman";

export interface Waypoint {
  lng: number;
  lat: number;
  label?: string;
}

export interface Segment {
  id: string;
  mode: Mode;
  from: Waypoint;
  to: Waypoint;
  vias: LngLat[];
  drawn: boolean;
  geometry: LngLat[];
  distanceM: number;
  durationS: number;
}

export type LandmarkKind =
  | "fuel"
  | "school"
  | "worship"
  | "hospital"
  | "pharmacy"
  | "bank"
  | "bus"
  | "shop"
  | "food"
  | "other"
  | "host";

export interface Landmark {
  id: string;
  lng: number;
  lat: number;
  label: string;
  kind: LandmarkKind;
  source: "map" | "host";
  note?: string;
  hidden?: boolean;
}

export type StepKind = "start" | "turn" | "mode" | "landmark" | "arrive";

export interface Step {
  id: string;
  kind: StepKind;
  text: string;
  atM: number;
  landmarkId?: string;
  edited?: boolean;
}

export interface RouteDoc {
  v: 1;
  title: string;
  segments: Segment[];
  landmarks: Landmark[];
  steps: Step[];
  arrival: { note: string };
  walker: Walker;
  createdAt: string;
}
