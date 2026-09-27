"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { appPath, isNativeApp, minimizeApp, onAppUrlOpen, onBackButton } from "@/lib/native";

export default function NativeShell() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    const offs: (() => void)[] = [];
    const keep = (off: () => void) => {
      if (cancelled) off();
      else offs.push(off);
    };
    void onBackButton((canGoBack) => {
      if (canGoBack) window.history.back();
      else if (window.location.pathname !== "/") router.replace("/");
      else void minimizeApp();
    }).then(keep);
    void onAppUrlOpen((url) => {
      const path = appPath(url);
      if (path) router.push(path);
    }).then(keep);
    return () => {
      cancelled = true;
      offs.forEach((off) => off());
    };
  }, [router]);

  return null;
}
