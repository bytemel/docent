"use client";

import { useEffect, type RefObject } from "react";

interface CreditTarget {
  setCreditOffset(px: number): void;
}

export function useCreditOffset(
  target: CreditTarget | null,
  a: RefObject<HTMLElement | null>,
  b?: RefObject<HTMLElement | null>,
  version: unknown = 0,
) {
  useEffect(() => {
    if (!target) return;
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      let off = 0;
      for (const el of [a.current, b?.current]) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.right > w - 180 && r.bottom > h - 40) off = Math.max(off, h - r.top);
      }
      target.setCreditOffset(off);
    };
    update();
    const ro = new ResizeObserver(update);
    for (const el of [a.current, b?.current]) if (el) ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [target, a, b, version]);
}
