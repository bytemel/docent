import type { Metadata } from "next";
import EditorLoader from "@/components/editor/EditorLoader";
import { t } from "@/strings/editor";

export const metadata: Metadata = {
  title: t.pageTitle,
  description: t.pageDescription,
  robots: { index: false, follow: false },
};

export default function NewRoutePage() {
  return <EditorLoader />;
}
