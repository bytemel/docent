import type { MetadataRoute } from "next";
import { brand, landing } from "@/strings/common";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: landing.subtext,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f6f4",
    theme_color: "#f6f6f4",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
