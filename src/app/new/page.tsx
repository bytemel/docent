import type { Metadata } from "next";
import EditorLoader from "@/components/editor/EditorLoader";
import { searchFromParams } from "@/components/editor/init";
import { t } from "@/strings/editor";

export const metadata: Metadata = {
  title: t.pageTitle,
  description: t.pageDescription,
  robots: { index: false, follow: false },
};

export default async function NewRoutePage({ searchParams }: PageProps<"/new">) {
  return <EditorLoader search={searchFromParams(await searchParams)} />;
}
