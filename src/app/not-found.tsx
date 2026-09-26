import Link from "next/link";
import LostRoute from "@/components/landing/LostRoute";
import { landing, notFound as copy } from "@/strings/common";
import { MessagePage } from "./r/mark";

export default function NotFound() {
  return (
    <MessagePage title={copy.title} body={copy.body} art={<LostRoute kind="lost" className="h-auto w-full" />}>
      <Link href="/" className="btn btn-primary">
        {copy.home}
      </Link>
      <Link href={landing.go.href} className="btn">
        {landing.go.title}
      </Link>
    </MessagePage>
  );
}
