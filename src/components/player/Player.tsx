"use client";

import type { RouteDoc } from "@/lib/types";

export interface PlayerProps {
  doc: RouteDoc;
  variant?: "page" | "preview" | "embed";
  autoplay?: boolean;
  onClose?: () => void;
}

export default function Player({ doc }: PlayerProps) {
  return <div className="p-4">{doc.title}</div>;
}
