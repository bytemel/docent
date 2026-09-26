import {
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowUp,
  ArrowUUpLeft,
  Bicycle,
  Car,
  FlagCheckered,
  MapPin,
  Motorcycle,
  NavigationArrow,
  PersonSimpleWalk,
  Van,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { segmentOffsets } from "@/lib/steps";
import type { Mode, RouteDoc, Step } from "@/lib/types";

const MODE_ICON: Record<Mode, Icon> = { walk: PersonSimpleWalk, boda: Motorcycle, matatu: Van, car: Car, bike: Bicycle };

export function stepIcon(step: Step, doc: RouteDoc): Icon {
  if (step.kind === "start") return NavigationArrow;
  if (step.kind === "arrive") return FlagCheckered;
  if (step.kind === "landmark") return MapPin;
  if (step.kind === "turn") {
    if (/u-turn/i.test(step.text)) return ArrowUUpLeft;
    if (/right/i.test(step.text)) return ArrowBendUpRight;
    if (/left/i.test(step.text)) return ArrowBendUpLeft;
    return ArrowUp;
  }
  const offsets = segmentOffsets(doc.segments);
  let i = 0;
  while (i + 1 < offsets.length && offsets[i + 1] <= step.atM + 1) i++;
  return MODE_ICON[doc.segments[i]?.mode ?? "walk"];
}

export function plainStep(text: string): string {
  const t = text.replace(/^After [\d.]+ k?m, /i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
