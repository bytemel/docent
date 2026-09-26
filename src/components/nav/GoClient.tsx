"use client";

import dynamic from "next/dynamic";
import { NAV } from "@/strings/nav";
import type { GoAppProps } from "./GoApp";

const GoApp = dynamic(() => import("./GoApp"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-ink-3" role="status">
      {NAV.loadingMap}
    </div>
  ),
});

export default function GoClient(props: GoAppProps) {
  return <GoApp {...props} />;
}
