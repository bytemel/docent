import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";
export const dynamicParams = false;

const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"] as const;

export function generateStaticParams() {
  return FILES.map((file) => ({ file }));
}

export async function GET(_request: Request, ctx: RouteContext<"/maplibre/[file]">) {
  const { file } = await ctx.params;
  if (!(FILES as readonly string[]).includes(file)) return new Response("Not found", { status: 404 });
  const body = await readFile(path.join(process.cwd(), "node_modules", "maplibre-gl", "dist", file), "utf8");
  return new Response(body, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000",
    },
  });
}
