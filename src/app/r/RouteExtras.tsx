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
    const check = async (tries: number) => {
      if (!alive) return;
      if (await isRouteCachedOffline(d, line)) {
        if (!alive) return;
        setOffline(true);
        hide = setTimeout(() => setOffline(false), 5000);
      } else if (tries > 0) {
        hide = setTimeout(() => void check(tries - 1), 3000);
      }
    };
    cacheRouteForOffline(d, line)
      .then(() => check(10))
      .catch(() => {});
    return () => {
      alive = false;
      if (hide) clearTimeout(hide);
    };
  }, [title, d, distance, line]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-16 top-3 z-50 flex justify-center lg:left-[400px] lg:right-0"
    >
      {offline ? (
        <p className="sign inline-flex items-center gap-3 py-2 pl-2 pr-4 text-sm font-semibold shadow-float">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent text-accent-ink">
            <CloudCheck size={20} weight="bold" aria-hidden />
          </span>
          {viewer.offline}
        </p>
      ) : null}
    </div>
  );
}
