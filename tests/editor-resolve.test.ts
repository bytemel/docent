import { describe, expect, it, vi } from "vitest";
import { allowedUrl, resolveLink, startUrl } from "@/lib/server/resolve";

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { location: to } });
}

describe("link resolver host allowlist", () => {
  it("allows only Google short link and maps hosts", () => {
    expect(startUrl("https://maps.app.goo.gl/abc")).not.toBeNull();
    expect(startUrl("maps.app.goo.gl/abc")?.protocol).toBe("https:");
    expect(startUrl("https://goo.gl/maps/abc")).not.toBeNull();
    expect(startUrl("https://evil.example/abc")).toBeNull();
    expect(startUrl("https://maps.app.goo.gl.evil.example/abc")).toBeNull();
    expect(startUrl("https://user@maps.app.goo.gl/abc")).toBeNull();
    expect(startUrl("https://maps.app.goo.gl:8080/abc")).toBeNull();
    expect(startUrl("http://169.254.169.254/latest")).toBeNull();
    expect(allowedUrl(new URL("https://www.google.com/maps"))).toBe(true);
  });

  it("never fetches a disallowed first host", async () => {
    const f = vi.fn();
    expect(await resolveLink("https://evil.example/x", f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});

describe("link resolver hops", () => {
  it("follows a short link to the place and parses it", async () => {
    const f = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => redirect("https://www.google.com/maps/place/Sarit+Centre/@-1.2612,36.8021,17z"));
    expect(await resolveLink("https://maps.app.goo.gl/abc", f)).toEqual({ lng: 36.8021, lat: -1.2612, label: "Sarit Centre" });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("stops when a hop leaves the allowlist", async () => {
    const f = vi.fn(async (url: string) => (url.includes("goo.gl") ? redirect("https://evil.example/@-1.2,36.8,17z") : new Response("x")));
    expect(await resolveLink("https://maps.app.goo.gl/abc", f)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("reads through the consent page without fetching it", async () => {
    const target = encodeURIComponent("https://www.google.com/maps/place/X/@-1.3,36.7,15z");
    const f = vi.fn(async () => redirect(`https://consent.google.com/m?continue=${target}`));
    expect(await resolveLink("https://maps.app.goo.gl/abc", f)).toMatchObject({ lat: -1.3, lng: 36.7 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("gives up after four hops", async () => {
    let n = 0;
    const f = vi.fn(async () => redirect(`https://maps.app.goo.gl/loop${++n}`));
    expect(await resolveLink("https://maps.app.goo.gl/start", f)).toBeNull();
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("returns a search query when the final link has only a name", async () => {
    const f = vi.fn(async () => redirect("https://www.google.com/maps?q=Kangemi+Stage&ftid=0x1"));
    expect(await resolveLink("https://maps.app.goo.gl/abc", f)).toEqual({ query: "Kangemi Stage" });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
