import { ArrowRight, House, NavigationArrow } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import LostRoute from "@/components/landing/LostRoute";
import { landing, notFound as copy } from "@/strings/common";
import { MessagePage } from "./r/mark";

export default function NotFound() {
  return (
    <MessagePage title={copy.title} body={copy.body} art={<LostRoute kind="lost" className="h-auto w-full" />}>
      <Link href="/" className="btn btn-primary btn-lg justify-between">
        <span className="inline-flex items-center gap-2">
          <House size={20} weight="bold" aria-hidden />
          {copy.home}
        </span>
        <ArrowRight size={20} weight="bold" aria-hidden />
      </Link>
      <Link href={landing.go.href} className="btn btn-lg justify-between">
        <span className="inline-flex items-center gap-2">
          <NavigationArrow size={20} weight="bold" aria-hidden />
          {landing.go.title}
        </span>
        <ArrowRight size={20} weight="bold" aria-hidden />
      </Link>
    </MessagePage>
  );
}
