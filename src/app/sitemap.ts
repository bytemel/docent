import type { MetadataRoute } from "next";
import { INDEXED_PATHS, siteUrl } from "@/lib/app";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return INDEXED_PATHS.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
