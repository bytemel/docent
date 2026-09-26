import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import PlayerClient from "@/components/player/PlayerClient";
import { formatDistance, routeCoords, simplify } from "@/lib/geo";
import { encodePolyline } from "@/lib/polyline";
import { decodeDoc } from "@/lib/share";
import type { RouteDoc } from "@/lib/types";
import { viewer } from "@/strings/common";
import LostRoute from "@/components/landing/LostRoute";
import { MessagePage } from "./mark";
import RouteExtras from "./RouteExtras";
import { modeList, ogQuery, totalMeters } from "./og-params";

type Props = PageProps<"/r">;

const decodeOnce = cache((raw: string) => decodeDoc(raw));

async function readRaw(searchParams: Props["searchParams"]): Promise<string | null> {
  const { d } = await searchParams;
  const raw = Array.isArray(d) ? d[0] : d;
  return raw ? raw.trim() : null;
}

async function readDoc(searchParams: Props["searchParams"]): Promise<RouteDoc | null> {
  const raw = await readRaw(searchParams);
  return raw ? decodeOnce(raw) : null;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const robots = { index: false, follow: false };
  const doc = await readDoc(searchParams);
  if (!doc) return { title: viewer.brokenTitle, robots };
  const title = doc.title.trim() || "Directions";
  const description = viewer.summary(formatDistance(totalMeters(doc)), modeList(doc));
  const image = { url: `/api/og?${ogQuery(doc)}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    robots,
    openGraph: { title, description, type: "website", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function RoutePage({ searchParams }: Props) {
  const raw = await readRaw(searchParams);
  const doc = raw ? decodeOnce(raw) : null;
  if (!doc) {
    return (
      <MessagePage
        title={viewer.brokenTitle}
        body={viewer.broken}
        hint={viewer.brokenHint}
        art={<LostRoute kind="broken" className="h-auto w-full" />}
      >
        <Link href="/new" className="btn btn-primary">
          {viewer.makeOwn}
        </Link>
        <Link href="/" className="btn">
          {viewer.home}
        </Link>
      </MessagePage>
    );
  }
  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <PlayerClient doc={doc} variant="page" />
      <RouteExtras
        title={doc.title}
        d={raw!}
        distance={formatDistance(totalMeters(doc))}
        line={encodePolyline(simplify(routeCoords(doc.segments), 20))}
      />
    </main>
  );
}
