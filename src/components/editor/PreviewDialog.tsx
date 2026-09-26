"use client";

import { useEffect, useRef } from "react";
import PlayerClient from "@/components/player/PlayerClient";
import type { RouteDoc } from "@/lib/types";
import { t } from "@/strings/editor";

interface Props {
  doc: RouteDoc;
  onClose(): void;
}

export default function PreviewDialog({ doc, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label={t.previewLabel}
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-bg outline-none"
    >
      <PlayerClient doc={doc} variant="preview" autoplay onClose={onClose} />
    </div>
  );
}
