"use client";

import { AndroidLogo, AppleLogo, CheckCircle, DownloadSimple, NavigationArrow } from "@phosphor-icons/react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { APP_ANDROID_URL, isNativeApp } from "@/lib/app";
import { appPage as t, site } from "@/strings/pages";

const noop = () => () => {};

export default function AppDownload() {
  const native = useSyncExternalStore(noop, isNativeApp, () => false);

  if (native) {
    return (
      <div className="sign flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-4">
          <CheckCircle size={40} weight="fill" className="shrink-0 text-accent" aria-hidden />
          <div>
            <p className="text-2xl font-black tracking-[-0.02em]">{t.inApp.title}</p>
            <p className="mt-1 text-pretty opacity-80">{t.inApp.body}</p>
          </div>
        </div>
        <Link href={site.go.href} className="btn btn-primary btn-lg shrink-0">
          <NavigationArrow size={20} weight="fill" aria-hidden />
          {t.inAppGo}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex flex-col justify-between gap-6 rounded-[18px] bg-accent p-6 text-accent-ink sm:p-8">
        <div className="flex items-center gap-3">
          <AndroidLogo size={36} weight="fill" aria-hidden />
          <p className="text-2xl font-black tracking-[-0.02em]">{t.android.title}</p>
        </div>
        {APP_ANDROID_URL ? (
          <div>
            <a href={APP_ANDROID_URL} className="btn btn-sign btn-lg w-full sm:w-auto" download>
              <DownloadSimple size={22} weight="bold" aria-hidden />
              {t.android.download}
            </a>
            <p className="mt-3 text-sm font-semibold text-pretty opacity-80">{t.android.note}</p>
          </div>
        ) : (
          <p className="text-lg font-bold text-pretty">{t.android.pending}</p>
        )}
      </div>
      <div className="flex flex-col justify-between gap-6 rounded-[18px] border-[1.5px] border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <AppleLogo size={36} weight="fill" aria-hidden />
          <p className="text-2xl font-black tracking-[-0.02em]">{t.iphone.title}</p>
        </div>
        <p className="text-pretty text-ink-2">{t.iphone.body}</p>
      </div>
    </div>
  );
}
