"use client";

import { useEffect } from "react";
import { cacheRouteForOffline } from "@/lib/offline";
import { saveRoute } from "@/lib/saved";

export default function RouteExtras({ title, d, distance, line }: { title: string; d: string; distance: string; line: string }) {
  useEffect(() => {
    saveRoute({ title, d, distance });
    void cacheRouteForOffline(d, line);
  }, [title, d, distance, line]);
  return null;
}
