"use client";

import dynamic from "next/dynamic";
import { LIVE_COPY } from "@/strings/live";
import type { LiveWatchProps } from "./LiveWatch";

const LiveWatch = dynamic(() => import("./LiveWatch"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-ink-3" role="status">
      {LIVE_COPY.loadingMap}
    </div>
  ),
});

export default function LiveWatchClient(props: LiveWatchProps) {
  return <LiveWatch {...props} />;
}
