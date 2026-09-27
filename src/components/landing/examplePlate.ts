import { totalMeters } from "@/app/r/og-params";
import { EXAMPLE_DOC } from "@/lib/example";
import { formatDistance, lineLength } from "@/lib/geo";
import { landing } from "@/strings/common";
import type { PlateStep } from "./DirectionPlate";
import { plainStep, stepIcon } from "./stepIcon";

export function examplePlate() {
  const lastLeg = EXAMPLE_DOC.segments[EXAMPLE_DOC.segments.length - 1];
  const lastLegMeters = lineLength(lastLeg.geometry);
  const total = totalMeters(EXAMPLE_DOC);
  const walkSteps = EXAMPLE_DOC.steps.filter((s) => s.atM > total - lastLegMeters && (s.kind === "turn" || s.kind === "arrive"));
  const plate: PlateStep[] = walkSteps.slice(0, 3).map((s) => {
    const prev = EXAMPLE_DOC.steps[EXAMPLE_DOC.steps.indexOf(s) - 1];
    return { Icon: stepIcon(s, EXAMPLE_DOC), distance: formatDistance(s.atM - (prev?.atM ?? 0)), text: plainStep(s.text) };
  });
  const spoken = plate.map((p) => landing.voice.spoken(p.distance, p.text.charAt(0).toLowerCase() + p.text.slice(1)));
  return { plate, spoken, lastLeg, lastLegMeters, total };
}
