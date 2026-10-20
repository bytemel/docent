"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { t } from "@/strings/editor";

interface Props {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  sheetRef?: Ref<HTMLElement>;
  label: string;
  snap: number;
  lowered?: boolean;
  scrollKey?: string;
}

function points(snap: number) {
  const vh = window.innerHeight;
  return { min: Math.min(168, vh * 0.3), snap: vh * snap, full: vh * 0.9 };
}

const desktop = () => window.matchMedia("(min-width: 1024px)").matches;

export default function Sheet({ header, footer, children, sheetRef, label, snap, lowered, scrollKey }: Props) {
  const [height, setHeight] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; h: number; moved: boolean; el: HTMLElement } | null>(null);
  const firstSnap = useRef(true);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [scrollKey]);

  useEffect(() => {
    if (firstSnap.current) {
      firstSnap.current = false;
      return;
    }
    const id = requestAnimationFrame(() => setHeight(null));
    return () => cancelAnimationFrame(id);
  }, [snap]);

  const autoLowered = useRef(false);
  useEffect(() => {
    if (desktop()) return;
    if (!lowered && !autoLowered.current) return;
    const id = requestAnimationFrame(() => {
      autoLowered.current = !!lowered;
      setHeight(lowered ? points(snap).min : null);
    });
    return () => cancelAnimationFrame(id);
  }, [lowered, snap]);

  const expanded = height !== null && height > points(snap).snap + 10;

  function onDown(e: React.PointerEvent<HTMLButtonElement>) {
    const el = e.currentTarget.closest("aside") as HTMLElement;
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
    const p = points(snap);
    setHeight(Math.max(p.min, Math.min(p.full, d.h + dy)));
  }

  function onUp() {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    const p = points(snap);
    if (!d) return;
    if (!d.moved) {
      setHeight(expanded ? null : p.full);
      return;
    }
    const h = d.el.getBoundingClientRect().height;
    const best = [p.min, p.snap, p.full].reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a));
    setHeight(best === p.snap ? null : best);
  }

  return (
    <aside
      ref={sheetRef}
      aria-label={label}
      style={{ ["--sheet-h" as string]: height ? `${height}px` : `${Math.round(snap * 100)}dvh` }}
      className={`panel fixed inset-x-0 bottom-0 z-20 flex max-lg:pl-[env(safe-area-inset-left)] max-lg:pr-[env(safe-area-inset-right)] h-[var(--sheet-h)] flex-col overflow-hidden rounded-b-none lg:absolute lg:inset-x-auto lg:bottom-auto lg:left-3 lg:top-[72px] lg:h-auto lg:max-h-[calc(100dvh-84px)] lg:w-[400px] lg:rounded-b-[18px] ${
        dragging ? "" : "transition-[height] duration-200 ease-out"
      }`}
    >
      <button
        type="button"
        className="-mb-4 flex h-11 w-full shrink-0 touch-none items-center justify-center lg:hidden"
        aria-label={expanded ? t.sheetCollapse : t.sheetExpand}
        aria-expanded={expanded}
        title={t.sheetHandle}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <span aria-hidden className="h-1 w-10 rounded-[2px] bg-line" />
      </button>
      {header}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-1 lg:px-5">
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:px-5">
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
