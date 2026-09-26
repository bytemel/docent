import type { Landmark, Segment, Step } from "./types";

export interface Turn {
  atM: number;
  angle: number;
  pos: [number, number];
  segmentIndex: number;
}

export function detectTurns(segments: Segment[]): Turn[] {
  void segments;
  return [];
}

export function buildSteps(segments: Segment[], landmarks: Landmark[]): Step[] {
  void segments;
  void landmarks;
  return [];
}
