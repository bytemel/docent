import type { TimelineSample } from "@/lib/timeline";
import type { Mode } from "@/lib/types";

export interface PropPose {
  vehicle: Mode | null;
  vehicleOffset: number;
  vehicleAlpha: number;
  walker: boolean;
  walkerOffset: number;
  walkerAlpha: number;
  walkerScale: number;
  walkerMoving: boolean;
  walkerTurn: number;
}

export function createPose(): PropPose {
  return {
    vehicle: null,
    vehicleOffset: 0,
    vehicleAlpha: 1,
    walker: true,
    walkerOffset: 0,
    walkerAlpha: 1,
    walkerScale: 1,
    walkerMoving: false,
    walkerTurn: 0,
  };
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

function enter(out: PropPose, vehicle: Mode, p: number) {
  out.vehicle = vehicle;
  out.vehicleAlpha = smooth(p / 0.2);
  out.vehicleOffset = p < 0.7 ? 1 : 1 - smooth((p - 0.7) / 0.3);
  if (p < 0.55) {
    out.walker = true;
    out.walkerOffset = smooth(p / 0.55);
    out.walkerAlpha = 1;
    out.walkerScale = 1;
    out.walkerMoving = true;
    out.walkerTurn = -90;
  } else if (p < 0.7) {
    const f = (p - 0.55) / 0.15;
    out.walker = true;
    out.walkerOffset = 1;
    out.walkerAlpha = 1 - f;
    out.walkerScale = 1 - 0.4 * f;
    out.walkerMoving = false;
    out.walkerTurn = -90;
  } else {
    out.walker = false;
  }
}

function exit(out: PropPose, vehicle: Mode, p: number, keepVehicle: boolean) {
  out.vehicle = vehicle;
  out.vehicleOffset = p < 0.3 ? smooth(p / 0.3) : 1;
  out.vehicleAlpha = keepVehicle || p < 0.8 ? 1 : 1 - smooth((p - 0.8) / 0.2);
  if (p < 0.3) {
    out.walker = false;
  } else if (p < 0.45) {
    const f = (p - 0.3) / 0.15;
    out.walker = true;
    out.walkerOffset = 1;
    out.walkerAlpha = f;
    out.walkerScale = 0.6 + 0.4 * f;
    out.walkerMoving = false;
    out.walkerTurn = 90;
  } else {
    out.walker = true;
    out.walkerOffset = 1 - smooth((p - 0.45) / 0.55);
    out.walkerAlpha = 1;
    out.walkerScale = 1;
    out.walkerMoving = true;
    out.walkerTurn = 90;
  }
}

export function poseFor(s: TimelineSample, playing: boolean, out: PropPose): PropPose {
  out.vehicleOffset = 0;
  out.vehicleAlpha = 1;
  out.walkerOffset = 0;
  out.walkerAlpha = 1;
  out.walkerScale = 1;
  out.walkerTurn = 0;
  if (s.phase === "move") {
    if (s.mode === "walk") {
      out.vehicle = null;
      out.walker = true;
      out.walkerMoving = playing && s.progress < 1;
    } else {
      out.vehicle = s.mode;
      out.walker = false;
      out.walkerMoving = false;
    }
    return out;
  }
  const p = s.progress;
  if (s.fromMode === "walk") enter(out, s.mode, p);
  else if (s.mode === "walk") exit(out, s.fromMode, p, false);
  else if (p < 0.5) {
    exit(out, s.fromMode, p * 2, true);
    if (p > 0.4) out.vehicleAlpha = 1 - smooth((p - 0.4) / 0.1);
  } else enter(out, s.mode, (p - 0.5) * 2);
  if (!playing) out.walkerMoving = false;
  return out;
}
