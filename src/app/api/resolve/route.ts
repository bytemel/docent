import { fail, limited, ok } from "@/lib/server/http";
import { resolveLink } from "@/lib/server/resolve";

export async function GET(req: Request) {
  const blocked = limited(req, "resolve", 20);
  if (blocked) return blocked;
  const raw = new URL(req.url).searchParams.get("u") ?? "";
  if (!raw || raw.length > 2048) return fail(400, "Paste a Google Maps link.");
  const result = await resolveLink(raw);
  if (!result) return fail(404, "We could not read a place from that link. Try dropping a pin on the map instead.");
  return ok(result);
}
