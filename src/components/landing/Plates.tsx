import { ArrowRight, Crosshair, NavigationArrow, ShareFat } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { landing } from "@/strings/common";

export default function Plates({ ask = true, size = "lg" }: { ask?: boolean; size?: "lg" | "md" }) {
  const tall = size === "lg" ? "sm:min-h-[11.5rem]" : "sm:min-h-[8.5rem]";
  const title = size === "lg" ? "text-[1.45rem] sm:text-[1.9rem]" : "text-[1.45rem] sm:text-[1.6rem]";
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={landing.go.href}
          className={`group grid ${tall} grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-[18px] bg-accent p-4 text-accent-ink sm:flex sm:flex-col sm:items-stretch sm:justify-between shadow-float transition-transform active:scale-[0.99] focus-visible:outline-[var(--ink)] sm:p-6`}
        >
          <span className="contents sm:flex sm:items-start sm:justify-between">
            <span className="order-1 grid size-14 place-items-center rounded-[14px] bg-accent-ink text-accent sm:order-none">
              <NavigationArrow size={30} weight="fill" aria-hidden />
            </span>
            <ArrowRight size={28} weight="bold" className="order-3 transition-transform group-hover:translate-x-1 sm:order-none" aria-hidden />
          </span>
          <span className="order-2 min-w-0 sm:order-none">
            <span className={`block ${title} font-black leading-[1.05] tracking-[-0.02em]`}>{landing.go.title}</span>
            <span className="mt-1.5 block text-[0.9375rem] font-semibold opacity-80">{landing.go.body}</span>
          </span>
        </Link>
        <Link
          href={landing.share.href}
          className={`sign group grid ${tall} grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 shadow-float sm:flex sm:flex-col sm:items-stretch sm:justify-between transition-transform active:scale-[0.99] sm:p-6`}
        >
          <span className="contents sm:flex sm:items-start sm:justify-between">
            <span className="order-1 grid size-14 place-items-center rounded-[14px] bg-sign-ink text-sign sm:order-none">
              <ShareFat size={28} weight="fill" aria-hidden />
            </span>
            <ArrowRight size={28} weight="bold" className="order-3 transition-transform group-hover:translate-x-1 sm:order-none" aria-hidden />
          </span>
          <span className="order-2 min-w-0 sm:order-none">
            <span className={`block ${title} font-black leading-[1.05] tracking-[-0.02em]`}>{landing.share.title}</span>
            <span className="mt-1.5 block text-[0.9375rem] font-semibold opacity-75">{landing.share.body}</span>
          </span>
        </Link>
      </div>
      {ask ? (
        <Link
          href={landing.ask.href}
          className="group flex min-h-16 items-center gap-4 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-3 sm:px-5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-surface-2 text-ink">
            <Crosshair size={22} weight="bold" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{landing.ask.title}</span>
            <span className="block text-sm text-ink-3">{landing.ask.body}</span>
          </span>
          <ArrowRight size={22} weight="bold" className="shrink-0 text-ink-2 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
