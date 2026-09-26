"use client";

import dynamic from "next/dynamic";
import { t } from "@/strings/editor";
import EditorBoundary from "./EditorBoundary";

const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-bg">
      <p className="text-sm text-ink-3" role="status">
        {t.loadingMap}
      </p>
    </div>
  ),
});

export default function EditorLoader() {
  return (
    <EditorBoundary>
      <Editor />
    </EditorBoundary>
  );
}
