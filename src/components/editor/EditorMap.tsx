"use client";

import { useEffect, useRef } from "react";
import { MapController, type MapHandlers, type MapView } from "./mapController";
import type { Padding } from "./types";

export interface MapApi {
  getCenter(): [number, number];
  fit(padding: Padding): void;
  snapshot(padding: Padding): Promise<string | null>;
  flyTo(p: [number, number], padding: Padding): void;
  setBase(padding: Padding): void;
}

interface Props extends MapView {
  handlers: MapHandlers;
  onReady(api: MapApi | null): void;
}

export default function EditorMap({ handlers, onReady, ...view }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const ctl = useRef<MapController | null>(null);
  const first = useRef({ view, handlers, onReady });

  useEffect(() => {
    if (!box.current) return;
    const init = first.current;
    const c = new MapController(box.current, init.view, init.handlers);
    ctl.current = c;
    init.onReady({ getCenter: () => c.getCenter(), fit: (p) => c.fit(p), flyTo: (p, pad) => c.flyTo(p, pad), setBase: (p) => c.setBase(p), snapshot: (p) => c.snapshot(p) });
    return () => {
      init.onReady(null);
      ctl.current = null;
      c.destroy();
    };
  }, []);

  useEffect(() => {
    ctl.current?.setHandlers(handlers);
  }, [handlers]);

  const { segments, pending, landmarks, draftLandmark, tool, selectedVia } = view;
  useEffect(() => {
    ctl.current?.setView({ segments, pending, landmarks, draftLandmark, tool, selectedVia });
  }, [segments, pending, landmarks, draftLandmark, tool, selectedVia]);

  return (
    <div className="absolute inset-0">
      <div ref={box} className="h-full w-full" />
    </div>
  );
}
