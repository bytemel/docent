import type { Metadata } from "next";
import GoClient from "@/components/nav/GoClient";
import { parseTo } from "@/lib/nav";
import { decodeDoc } from "@/lib/share";
import { NAV } from "@/strings/nav";

type Props = PageProps<"/go">;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const personal = Boolean(first(sp.d) || first(sp.to));
  return {
    title: NAV.pageTitle,
    description: NAV.pageDescription,
    robots: personal ? { index: false, follow: false } : undefined,
  };
}

export default async function GoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const d = first(sp.d);
  const doc = d ? decodeDoc(d) : null;
  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <GoClient to={parseTo(first(sp.to))} doc={doc} badDoc={Boolean(d) && !doc} />
    </main>
  );
}
