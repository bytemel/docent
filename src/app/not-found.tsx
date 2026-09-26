import Link from "next/link";
import { notFound as copy } from "@/strings/common";
import LostRoute from "@/components/landing/LostRoute";
import { MessagePage } from "./r/mark";

export default function NotFound() {
  return (
    <MessagePage title={copy.title} body={copy.body} art={<LostRoute kind="lost" className="h-auto w-full" />}>
      <Link href="/" className="btn btn-primary">
        {copy.home}
      </Link>
      <Link href="/new" className="btn">
        {copy.make}
      </Link>
    </MessagePage>
  );
}
