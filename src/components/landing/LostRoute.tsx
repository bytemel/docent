import { MODES } from "@/lib/modes";

export default function LostRoute({ kind, className }: { kind: "broken" | "lost"; className?: string }) {
  const walk = MODES.walk.color;
  const ride = MODES.matatu.color;
  return (
    <svg viewBox="0 0 400 320" className={className} aria-hidden="true">
      <rect x="0" y="0" width="400" height="320" rx="18" style={{ fill: "var(--surface-2)" }} />
      <path d="M-10 250 L150 250 Q200 250 200 200 L200 -10" fill="none" style={{ stroke: "var(--line)" }} strokeWidth="26" />
      <path d="M200 120 Q200 90 240 90 L410 90" fill="none" style={{ stroke: "var(--line)" }} strokeWidth="26" />
      <path d="M52 250 L150 250 Q200 250 200 200 L200 160" fill="none" stroke={walk} strokeWidth="9" strokeLinecap="round" strokeDasharray="0.1 17" />
      {kind === "broken" ? (
        <>
          <path d="M240 90 L330 90" fill="none" stroke={ride} strokeWidth="9" strokeLinecap="round" />
          <path d="M206 132 l18 -12 M 214 144 l18 -12" style={{ stroke: "var(--ink-3)" }} strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <path d="M200 160 L200 40" fill="none" stroke={walk} strokeWidth="9" strokeLinecap="round" strokeDasharray="0.1 17" opacity="0.35" />
      )}
      <circle cx="52" cy="250" r="14" style={{ fill: "var(--surface)", stroke: "var(--ink)" }} strokeWidth="6" />
      <circle cx="356" cy="90" r="15" fill="none" style={{ stroke: "var(--ink-3)" }} strokeWidth="5" strokeDasharray="6 7" />
      <g transform="translate(268 176)">
        <rect width="84" height="84" rx="14" style={{ fill: "var(--accent)" }} />
        <path d="M42 70 V32 M20 30 H64" style={{ stroke: "var(--accent-ink)" }} strokeWidth="10" strokeLinecap="square" fill="none" />
      </g>
    </svg>
  );
}
