import type { Landmark, Segment } from "./types";

export interface FindLandmarksOptions {
  bufferM?: number;
  max?: number;
  signal?: AbortSignal;
}

export async function findLandmarks(segments: Segment[], opts: FindLandmarksOptions = {}): Promise<Landmark[]> {
  void segments;
  void opts;
  return [];
}
