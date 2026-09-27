import type { MetadataRoute } from "next";
import { DISALLOWED_PATHS, siteUrl } from "@/lib/app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/api/og"], disallow: [...DISALLOWED_PATHS] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
