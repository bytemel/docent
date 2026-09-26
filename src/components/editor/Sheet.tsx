"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { t } from "@/strings/editor";

interface Props {
  header?: ReactNode;
  children: ReactNode;
  sheetRef?: Ref<HTMLElement>;
  label: string;
  lowered?: boolean;
}

function snaps() {
  const vh = window.innerHeight;
  return { min: Math.min(148, vh * 0.3), peek: vh * 0.42, full: vh * 0.88 };
}

export default function Sheet({ header, children, sheetRef, label, lowered }: Props) {
  const [height, setHeight] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; h: number; moved: boolean; el: HTMLElement } | null>(null);

  const autoLowered = useRef(false);
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    if (!lowered && !autoLowered.current) return;
    const id = requestAnimationFrame(() => {
      autoLowered.current = !!lowered;
      setHeight(lowered ? snaps().min : snaps().peek);
    });
    return () => cancelAnimationFrame(id);
  }, [lowered]);

  const expanded = height !== null && height > snaps().peek + 10;

  function onDown(e: React.PointerEvent<HTMLButtonElement>) {
    const el = e.currentTarget.parentElement as HTMLElement;
    drag.current = { y: e.clientY, h: el.getBoundingClientRect().height, moved: false, el };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (!d.moved && Math.abs(dy) < 6) return;
    d.moved = true;
    setDragging(true);
    const s = snaps();
    setHeight(Math.max(s.min, Math.min(s.full, d.h + dy)));
  }

  function onUp() {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    const s = snaps();
    if (!d) return;
    if (!d.moved) {
      setHeight(expanded ? s.peek : s.full);
      return;
    }
    const h = d.el.getBoundingClientRect().height;
    const opts = [s.min, s.peek, s.full];
    setHeight(opts.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a)));
  }

  return (
    <aside
      ref={sheetRef}
      aria-label={label}
      style={{ ["--sheet-h" as string]: height ? `${height}px` : "42dvh" }}
      className={`panel fixed inset-x-0 bottom-0 z-20 flex h-[var(--sheet-h)] flex-col rounded-b-none lg:absolute lg:inset-x-auto lg:bottom-auto lg:left-3 lg:top-[68px] lg:h-auto lg:max-h-[calc(100dvh-80px)] lg:w-[400px] lg:rounded-b-[12px] ${
        dragging ? "" : "transition-[height] duration-200 ease-out"
      }`}
    >
      <button
        type="button"
        className="-mb-2 flex h-11 w-full shrink-0 touch-none items-center justify-center lg:hidden"
        aria-label={expanded ? t.sheetCollapse : t.sheetExpand}
        aria-expanded={expanded}
        title={t.sheetHandle}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <span aria-hidden className="h-1.5 w-10 rounded-full bg-line" />
      </button>
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {children}
      </div>
    </aside>
  );
}
