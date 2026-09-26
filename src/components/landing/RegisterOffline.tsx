"use client";

import { useEffect } from "react";
import { registerOffline } from "@/lib/offline";

export default function RegisterOffline() {
  useEffect(() => {
    void registerOffline();
  }, []);
  return null;
}
