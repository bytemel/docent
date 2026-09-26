import { MODES } from "@/lib/modes";

export default function LostRoute({ kind, className }: { kind: "broken" | "lost"; className?: string }) {
  const walk = MODES.walk.color;
  const ride = MODES.matatu.color;
  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden="true">
      <path d="M40 250 C 90 250 100 200 140 190 S 190 150 200 130" fill="none" stroke={walk} strokeWidth="10" strokeLinecap="round" strokeDasharray="0.1 19" />
      {kind === "broken" ? (
        <>
          <path d="M238 104 C 270 84 300 90 330 70" fill="none" stroke={ride} strokeWidth="10" strokeLinecap="round" />
          <path d="M206 108 l 18 10 M 214 96 l 18 10" stroke="var(--ink-3)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="352" cy="58" r="16" style={{ fill: "none", stroke: "var(--ink-3)" }} strokeWidth="5" strokeDasharray="6 7" />
        </>
      ) : (
        <>
          <path d="M200 130 C 215 100 260 110 290 80 S 340 40 420 30" fill="none" stroke={ride} strokeWidth="10" strokeLinecap="round" />
          <circle cx="120" cy="80" r="16" style={{ fill: "none", stroke: "var(--ink-3)" }} strokeWidth="5" strokeDasharray="6 7" />
        </>
      )}
      <circle cx="200" cy="130" r="12" style={{ fill: "var(--surface)", stroke: "var(--ink)" }} strokeWidth="5" />
      <circle cx="40" cy="250" r="15" style={{ fill: "var(--surface)", stroke: "var(--ink)" }} strokeWidth="6" />
    </svg>
  );
}
