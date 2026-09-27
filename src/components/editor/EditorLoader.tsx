"use client";

import dynamic from "next/dynamic";
import { t } from "@/strings/editor";
import EditorBoundary from "./EditorBoundary";
import { editorKey } from "./init";

const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-bg">
      <p className="text-sm text-ink-3 text-pretty" role="status">
        {t.loadingMap}
      </p>
    </div>
  ),
});

export default function EditorLoader({ search = "" }: { search?: string }) {
  return (
    <EditorBoundary>
      <Editor key={editorKey(search)} search={search} />
    </EditorBoundary>
  );
}
