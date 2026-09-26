import { MODES } from "@/lib/modes";
import type { Mode, Walker } from "@/lib/types";

export const PROP = {
  glass: "#1f2937",
  stripe: "#7c5214",
  tyre: "#27272a",
  lamp: "#fef3c7",
  rider: "#3f3f46",
  helmet: "#18181b",
};

const INK = "style=\"stroke:var(--ink)\"";

export function walkerSvg(kind: Walker): string {
  const shirt = MODES.walk.color;
  const hip = kind === "woman" ? 31 : 28;
  const torso =
    kind === "man"
      ? `<rect x="12" y="12" width="6" height="16" rx="2.5" fill="${shirt}"/>`
      : kind === "woman"
        ? `<line x1="15" y1="12" x2="15" y2="22" stroke-width="3.5" ${INK}/><polygon points="15,19 8.5,32 21.5,32" fill="${shirt}"/>`
        : `<line x1="15" y1="12" x2="15" y2="${hip}" stroke-width="3.5" ${INK}/>`;
  return `<svg class="dp-walker-svg" viewBox="0 0 30 48" width="30" height="48" aria-hidden="true" fill="none" stroke-linecap="round">
<g class="dp-arm-b"><line x1="15" y1="15" x2="15" y2="25" stroke-width="3" ${INK}/></g>
<g class="dp-leg-b" style="transform-origin:15px ${hip}px"><line x1="15" y1="${hip}" x2="15" y2="44" stroke-width="3.5" ${INK}/></g>
${torso}
<g class="dp-leg-a" style="transform-origin:15px ${hip}px"><line x1="15" y1="${hip}" x2="15" y2="44" stroke-width="3.5" ${INK}/></g>
<g class="dp-arm-a"><line x1="15" y1="15" x2="15" y2="25" stroke-width="3" ${INK}/></g>
<circle cx="15" cy="7" r="5" style="fill:var(--ink)"/>
</svg>`;
}

function car(): string {
  const c = MODES.car.color;
  return `<svg viewBox="0 0 24 44" width="24" height="44" aria-hidden="true">
<rect x="2" y="2" width="20" height="40" rx="7" fill="${c}"/>
<rect x="3" y="3" width="4" height="2" rx="1" fill="${PROP.lamp}"/><rect x="17" y="3" width="4" height="2" rx="1" fill="${PROP.lamp}"/>
<path d="M5 14 Q12 10 19 14 L18 19 H6 Z" fill="${PROP.glass}"/>
<rect x="6" y="19" width="12" height="13" rx="2" fill="#000" fill-opacity="0.12"/>
<path d="M6 32 H18 L19 36 Q12 38.5 5 36 Z" fill="${PROP.glass}"/>
</svg>`;
}

function matatu(): string {
  const c = MODES.matatu.color;
  return `<svg viewBox="0 0 26 56" width="26" height="56" aria-hidden="true">
<rect x="2" y="2" width="22" height="52" rx="5" fill="${c}"/>
<rect x="3" y="3" width="4" height="2" rx="1" fill="${PROP.lamp}"/><rect x="19" y="3" width="4" height="2" rx="1" fill="${PROP.lamp}"/>
<path d="M4.5 8 H21.5 L20.5 13 H5.5 Z" fill="${PROP.glass}"/>
<rect x="3.5" y="15" width="2.5" height="32" rx="1" fill="${PROP.glass}"/>
<rect x="20" y="15" width="2.5" height="32" rx="1" fill="${PROP.glass}"/>
<rect x="10" y="14" width="6" height="36" rx="1.5" fill="${PROP.stripe}"/>
<rect x="6" y="49" width="14" height="3" rx="1" fill="${PROP.glass}"/>
</svg>`;
}

function boda(): string {
  const c = MODES.boda.color;
  return `<svg viewBox="0 0 22 42" width="22" height="42" aria-hidden="true">
<rect x="9.5" y="1" width="3" height="10" rx="1.5" fill="${PROP.tyre}"/>
<rect x="9.5" y="31" width="3" height="10" rx="1.5" fill="${PROP.tyre}"/>
<rect x="7" y="8" width="8" height="25" rx="4" fill="${c}"/>
<line x1="3" y1="11" x2="19" y2="11" stroke="${PROP.tyre}" stroke-width="2" stroke-linecap="round"/>
<ellipse cx="11" cy="22" rx="7" ry="4.5" fill="${PROP.rider}"/>
<circle cx="11" cy="19.5" r="3.8" fill="${PROP.helmet}"/>
</svg>`;
}

function bike(): string {
  const c = MODES.bike.color;
  return `<svg viewBox="0 0 20 42" width="20" height="42" aria-hidden="true">
<rect x="9" y="1" width="2" height="11" rx="1" fill="${PROP.tyre}"/>
<rect x="9" y="30" width="2" height="11" rx="1" fill="${PROP.tyre}"/>
<rect x="8.5" y="7" width="3" height="28" rx="1.5" fill="${c}"/>
<line x1="4" y1="10" x2="16" y2="10" stroke="${PROP.tyre}" stroke-width="1.8" stroke-linecap="round"/>
<ellipse cx="10" cy="22" rx="6.5" ry="4" fill="${c}"/>
<circle cx="10" cy="19.5" r="3.4" fill="${PROP.helmet}"/>
</svg>`;
}

export function vehicleSvg(mode: Exclude<Mode, "walk">): string {
  if (mode === "car") return car();
  if (mode === "matatu") return matatu();
  if (mode === "boda") return boda();
  return bike();
}

export const PROP_CSS = `
.dp-prop{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none}
.dp-veh,.dp-walk{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform;filter:drop-shadow(0 0 1px var(--surface)) drop-shadow(0 1px 2px rgb(0 0 0 / .35))}
.dp-veh>svg{display:none}
.dp-veh>svg.dp-on{display:block}
.dp-walker-svg{display:block}
.dp-arm-a,.dp-arm-b{transform-box:view-box;transform-origin:15px 15px}
.dp-leg-a,.dp-leg-b{transform-box:view-box}
.dp-walking .dp-leg-a{animation:dp-swing .42s ease-in-out infinite alternate}
.dp-walking .dp-leg-b{animation:dp-swing .42s ease-in-out infinite alternate-reverse}
.dp-walking .dp-arm-a{animation:dp-arm .42s ease-in-out infinite alternate-reverse}
.dp-walking .dp-arm-b{animation:dp-arm .42s ease-in-out infinite alternate}
@keyframes dp-swing{from{transform:rotate(-26deg)}to{transform:rotate(26deg)}}
@keyframes dp-arm{from{transform:rotate(-32deg)}to{transform:rotate(32deg)}}
`;
