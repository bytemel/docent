"use client";

import { useSyncExternalStore } from "react";
import PlayerClient from "@/components/player/PlayerClient";
import { EXAMPLE_DOC } from "@/lib/example";

const QUERY = "(min-width: 1024px)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export default function ResponsivePlayer({ when }: { when: "wide" | "narrow" }) {
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => null);
  if (wide === null || wide !== (when === "wide")) return null;
  return <PlayerClient doc={EXAMPLE_DOC} variant="embed" autoplay />;
}
