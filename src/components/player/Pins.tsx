"use client";

import {
  Bank,
  Bus,
  ForkKnife,
  GasPump,
  GraduationCap,
  HandsPraying,
  Hospital,
  MapPin,
  Pill,
  Star,
  Storefront,
  type Icon,
} from "@phosphor-icons/react";
import type { LandmarkKind } from "@/lib/types";

export const KIND_ICON: Record<LandmarkKind, Icon> = {
  fuel: GasPump,
  school: GraduationCap,
  worship: HandsPraying,
  hospital: Hospital,
  pharmacy: Pill,
  bank: Bank,
  bus: Bus,
  shop: Storefront,
  food: ForkKnife,
  other: MapPin,
  host: Star,
};

export function PinContent({ kind, label }: { kind: LandmarkKind; label: string }) {
  const I = KIND_ICON[kind] ?? MapPin;
  return (
    <div className="relative flex flex-col items-center">
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-float transition-transform duration-300 group-data-[near=true]:scale-125 group-data-[near=true]:border-accent group-data-[near=true]:bg-accent group-data-[near=true]:text-accent-ink">
        <I size={16} weight="bold" aria-hidden="true" />
      </span>
      <span className="pointer-events-none absolute top-8 max-w-[140px] truncate rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-medium text-ink-2 shadow-float transition-colors duration-300 group-data-[near=true]:text-ink group-data-[label=hide]:hidden">
        {label}
      </span>
    </div>
  );
}

export function EndpointContent({ which, label }: { which: "a" | "b"; label: string }) {
  return (
    <span
      title={label}
      className={
        which === "a"
          ? "flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-ink text-sm font-bold text-bg shadow-float"
          : "flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-accent text-sm font-bold text-accent-ink shadow-float"
      }
    >
      {which === "a" ? "A" : "B"}
    </span>
  );
}
