"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { ensureMapWorker, mapStyleUrl, NAIROBI, prefersReducedMotion } from "@/lib/map";
import { t } from "@/strings/editor";

ensureMapWorker(maplibregl);

interface Props {
  point: { lng: number; lat: number } | null;
  target: { lng: number; lat: number } | null;
  onTap(p: { lng: number; lat: number }): void;
}

function dot(className: string) {
  const el = document.createElement("div");
  el.className = className;
  return el;
}

export default function HereMap({ point, target, onTap }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const me = useRef<maplibregl.Marker | null>(null);
  const tapRef = useRef(onTap);
  const first = useRef({ point, target });

  useEffect(() => {
    tapRef.current = onTap;
  }, [onTap]);

  useEffect(() => {
    if (!box.current) return;
    const start = first.current.point ?? first.current.target;
    const m = new maplibregl.Map({
      container: box.current,
      style: mapStyleUrl(),
      center: start ? [start.lng, start.lat] : NAIROBI,
      zoom: start ? 15 : 12,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    m.touchZoomRotate.disableRotation();
    m.getCanvas().setAttribute("aria-label", t.here.mapLabel);
    m.on("click", (e) => tapRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
    const target = first.current.target;
    if (target) {
      new maplibregl.Marker({
        element: dot("grid size-7 place-items-center rounded-full border-2 border-surface bg-accent text-xs font-bold text-accent-ink shadow-float"),
      })
        .setLngLat([target.lng, target.lat])
        .addTo(m)
        .getElement().textContent = "B";
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => m.setStyle(mapStyleUrl(mq.matches));
    mq.addEventListener("change", onScheme);
    map.current = m;
    return () => {
      mq.removeEventListener("change", onScheme);
      map.current = null;
      me.current = null;
      m.remove();
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !point) return;
    if (!me.current) {
      me.current = new maplibregl.Marker({
        element: dot("size-6 rounded-full border-[3px] border-surface bg-ink shadow-float"),
      })
        .setLngLat([point.lng, point.lat])
        .addTo(m);
    } else me.current.setLngLat([point.lng, point.lat]);
    m.easeTo({ center: [point.lng, point.lat], zoom: Math.max(m.getZoom(), 16), duration: prefersReducedMotion() ? 0 : 500 });
  }, [point]);

  return (
    <div className="relative h-full w-full">
      <div ref={box} className="h-full w-full" />
    </div>
  );
}
