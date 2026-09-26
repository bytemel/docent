"use client";

import dynamic from "next/dynamic";
import type { PlayerProps } from "./Player";
import PlayerBoundary from "./PlayerBoundary";

const Player = dynamic(() => import("./Player"), { ssr: false });

export default function PlayerClient(props: PlayerProps) {
  return (
    <PlayerBoundary doc={props.doc} variant={props.variant ?? "page"} onClose={props.onClose}>
      <Player {...props} />
    </PlayerBoundary>
  );
}
