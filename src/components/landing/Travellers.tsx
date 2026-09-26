"use client";

import { useEffect, useRef, useState } from "react";
import { PROP_CSS, vehicleSvg, walkerSvg } from "@/components/player/props2d";
import { MODE_ORDER, MODES } from "@/lib/modes";
import type { Mode } from "@/lib/types";
import { landing } from "@/strings/common";

const CSS = `
.dl-track{container-type:inline-size}
.dl-rider{position:absolute;left:0;top:50%;width:60px;height:60px;margin-top:-30px;display:flex;align-items:center;justify-content:center;animation:dl-ride var(--dur) linear infinite;animation-delay:var(--delay);animation-play-state:paused;will-change:transform}
.dl-lanes[data-run="true"] .dl-rider{animation-play-state:running}
.dl-lanes[data-run="false"] .dp-walking *{animation-play-state:paused}
.dl-turn{transform:rotate(90deg) scale(1.45);display:flex;filter:drop-shadow(0 1px 1.5px rgb(0 0 0 / .3))}
.dl-walker{display:flex;margin-top:-30px;transform:scale(1.1);transform-origin:50% 100%}
@keyframes dl-ride{0%{transform:translateX(0);opacity:0}7%{opacity:1}90%{opacity:1}100%{transform:translateX(calc(100cqw - 60px));opacity:0}}
@media (prefers-reduced-motion: reduce){
.dl-rider{animation:none;transform:translateX(calc(50cqw - 30px))}
.dp-walking *{animation:none!important}
}
`;

function propHtml(mode: Mode): string {
  return mode === "walk" ? walkerSvg("woman") : vehicleSvg(mode);
}

function Line({ mode }: { mode: Mode }) {
  const c = MODES[mode].color;
  const style = MODES[mode].dashed
    ? { background: `radial-gradient(circle, ${c} 2.6px, transparent 3.2px) 0 50% / 14px 8px repeat-x`, height: 8 }
    : { background: c, height: 6, borderRadius: 999 };
  return <div className="absolute inset-x-0 top-1/2 -translate-y-1/2" style={style} />;
}

export default function Travellers() {
  const ref = useRef<HTMLUListElement>(null);
  const [run, setRun] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setRun(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <style href="docent-player-props" precedence="default">
        {PROP_CSS}
      </style>
      <style href="docent-landing-travellers" precedence="default">
        {CSS}
      </style>
      <ul ref={ref} className="dl-lanes divide-y divide-line" data-run={run ? "true" : "false"}>
        {MODE_ORDER.map((mode, i) => {
          const info = MODES[mode];
          const dur = (22 / Math.sqrt(info.speedKmh)).toFixed(2);
          return (
            <li key={mode} className="grid gap-3 py-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-center md:gap-10">
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-lg font-semibold">{info.label}</span>
                  <span className="font-mono text-xs text-ink-3">{landing.travellers.pace(info.speedKmh)}</span>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{landing.travellers.modes[mode]}</p>
              </div>
              <div className="dl-track relative h-20 min-w-0">
                <Line mode={mode} />
                <div
                  className="dl-rider"
                  style={{ ["--dur" as string]: `${dur}s`, ["--delay" as string]: `${(-i * 0.9).toFixed(1)}s` }}
                >
                  <div
                    className={mode === "walk" ? "dp-walking dl-walker" : "dl-turn"}
                    dangerouslySetInnerHTML={{ __html: propHtml(mode) }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
