import type { Metadata } from "next";
import { t } from "@/strings/editor";
import HereClient from "./HereClient";
import { readHereParams } from "./params";

type Props = PageProps<"/here">;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { name } = readHereParams(await searchParams);
  return {
    title: t.here.title,
    description: t.here.headline(name),
    robots: { index: false, follow: false },
  };
}

export default async function HerePage({ searchParams }: Props) {
  const { name, to } = readHereParams(await searchParams);
  return <HereClient name={name} to={to} />;
}
