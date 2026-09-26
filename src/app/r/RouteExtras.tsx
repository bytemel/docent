"use client";

import { CloudCheck } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cacheRouteForOffline, isRouteCachedOffline } from "@/lib/offline";
import { saveRoute } from "@/lib/saved";
import { viewer } from "@/strings/common";

export default function RouteExtras({ title, d, distance, line }: { title: string; d: string; distance: string; line: string }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    let hide: ReturnType<typeof setTimeout> | undefined;
    saveRoute({ title, d, distance });
    cacheRouteForOffline(d, line)
      .then(() => isRouteCachedOffline(d))
      .then((cached) => {
        if (!alive || !cached) return;
        setOffline(true);
        hide = setTimeout(() => setOffline(false), 5000);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (hide) clearTimeout(hide);
    };
  }, [title, d, distance, line]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      {offline ? (
        <p className="panel inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-ink">
          <CloudCheck size={18} weight="bold" className="text-ok" aria-hidden />
          {viewer.offline}
        </p>
      ) : null}
    </div>
  );
}
