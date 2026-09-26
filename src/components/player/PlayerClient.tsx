"use client";

import dynamic from "next/dynamic";
import type { PlayerProps } from "./Player";

const Player = dynamic(() => import("./Player"), { ssr: false });

export default function PlayerClient(props: PlayerProps) {
  return <Player {...props} />;
}
