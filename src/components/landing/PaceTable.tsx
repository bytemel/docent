import { PersonSimpleRun, PersonSimpleWalk } from "@phosphor-icons/react/dist/ssr";
import { formatDistance, formatDuration } from "@/lib/geo";
import { landing } from "@/strings/common";

function pace(kmh: number): string {
  const secs = Math.round(3600 / kmh);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

export default function PaceTable({ meters }: { meters: number }) {
  const copy = landing.move;
  return (
    <div className="rounded-[18px] border-[1.5px] border-line bg-surface">
      <p className="border-b border-line px-5 py-4 text-sm font-bold text-ink-2 sm:px-6">{copy.stretch(formatDistance(meters))}</p>
      <ul className="divide-y divide-line">
        {copy.rows.map((row, i) => {
          const Icon = i === 0 ? PersonSimpleWalk : PersonSimpleRun;
          return (
            <li key={row.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-4 sm:px-6">
              <span className="grid size-12 place-items-center rounded-[14px] bg-surface-2">
                <Icon size={28} weight="bold" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-extrabold">{row.label}</span>
                <span className="num block whitespace-nowrap text-sm text-ink-3">
                  {pace(row.kmh)} {copy.pace}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-xs font-semibold text-ink-3">{copy.about}</span>
                <span className="num block text-[1.6rem] font-bold leading-none sm:text-[2rem]">
                  {formatDuration((meters / 1000 / row.kmh) * 3600)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
