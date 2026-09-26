import type { Metadata } from "next";
import Link from "next/link";
import { cleanName, isLiveConfigured, isValidLiveId } from "@/lib/live";
import { decodeDoc } from "@/lib/share";
import { LIVE_COPY } from "@/strings/live";
import { MessagePage } from "../../r/mark";
import { FAKE_MODES } from "./fake";
import LiveWatchClient from "./LiveWatchClient";

export const metadata: Metadata = {
  title: LIVE_COPY.pageTitle,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LivePage({ params, searchParams }: PageProps<"/live/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const d = first(sp.d);
  const fakeRaw = process.env.NODE_ENV !== "production" ? first(sp.fake) : undefined;
  const fake = FAKE_MODES.find((m) => m === fakeRaw) ?? null;

  if (!isValidLiveId(id)) {
    return (
      <MessagePage title={LIVE_COPY.badIdTitle} body={LIVE_COPY.badId}>
        <Link href="/" className="btn btn-primary">
          {LIVE_COPY.home}
        </Link>
      </MessagePage>
    );
  }

  const doc = d ? decodeDoc(d) : null;
  if (!doc || !d) {
    return (
      <MessagePage title={LIVE_COPY.badDocTitle} body={LIVE_COPY.badDoc}>
        <Link href="/" className="btn btn-primary">
          {LIVE_COPY.home}
        </Link>
      </MessagePage>
    );
  }

  if (!isLiveConfigured() && !fake) {
    return (
      <MessagePage title={LIVE_COPY.offTitle} body={LIVE_COPY.off}>
        <Link href={`/r?d=${d}`} className="btn btn-primary">
          {LIVE_COPY.watchRoute}
        </Link>
        <Link href="/" className="btn">
          {LIVE_COPY.home}
        </Link>
      </MessagePage>
    );
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <LiveWatchClient id={id} doc={doc} name={cleanName(first(sp.n))} fake={fake} />
    </main>
  );
}
