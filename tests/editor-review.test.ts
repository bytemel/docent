import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Landmark, RouteDoc, Step } from "@/lib/types";
import { isRouteDoc, mergeLandmarks, mergeSteps, newSegment, storedSteps, withRoute, emptyDoc } from "@/components/editor/ops";
import { initialState } from "@/components/editor/init";
import { resetRateLimits } from "@/lib/server/rateLimit";

const A = { lng: 36.8, lat: -1.26, label: "Westlands" };
const B = { lng: 36.76, lat: -1.26, label: "Kangemi" };

function doc(title = "Directions to Kangemi"): RouteDoc {
  const seg = withRoute(newSegment(A, B, "walk", "s1"), [
    [36.8, -1.26],
    [36.78, -1.26],
    [36.76, -1.26],
  ]);
  return { ...emptyDoc(), title, segments: [seg] };
}

describe("step edits survive route changes", () => {
  const edited: Step = { id: "turn-50", kind: "turn", text: "Turn left at the green gate", atM: 500, edited: true };

  it("matches the nearest step of the same kind within 50 m", () => {
    const fresh: Step[] = [
      { id: "turn-20", kind: "turn", text: "Turn right", atM: 200 },
      { id: "turn-52", kind: "turn", text: "Turn left", atM: 520 },
    ];
    const out = mergeSteps([edited], fresh);
    expect(out[1]).toMatchObject({ id: "turn-52", text: "Turn left at the green gate", edited: true });
    expect(out[0].text).toBe("Turn right");
  });

  it("keeps an edit that no longer matches instead of dropping it", () => {
    const far: Step[] = [{ id: "turn-90", kind: "turn", text: "Turn left", atM: 900 }];
    expect(mergeSteps([edited], far)[0].text).toBe("Turn left");
    const stored = storedSteps([edited], far, mergeSteps([edited], far));
    expect(stored).toContainEqual(edited);
    const back: Step[] = [{ id: "turn-51", kind: "turn", text: "Turn left", atM: 510 }];
    expect(mergeSteps(stored, back)[0].text).toBe("Turn left at the green gate");
  });

  it("does not match a different kind or landmark", () => {
    const lm: Step = { id: "landmark-50", kind: "landmark", text: "Pass the kiosk", atM: 500, landmarkId: "a", edited: true };
    const fresh: Step[] = [
      { id: "turn-50", kind: "turn", text: "Turn left", atM: 500 },
      { id: "landmark-50", kind: "landmark", text: "Pass Total", atM: 500, landmarkId: "b" },
    ];
    const out = mergeSteps([lm], fresh);
    expect(out.map((s) => s.text)).toEqual(["Turn left", "Pass Total"]);
  });

  it("keeps the arrival edit when the route length changes a lot", () => {
    const arr: Step = { id: "arrive-400", kind: "arrive", text: "Ring the bell", atM: 4000, edited: true };
    const out = mergeSteps([arr], [{ id: "arrive-520", kind: "arrive", text: "Arrive", atM: 5200 }]);
    expect(out[0].text).toBe("Ring the bell");
  });
});

describe("hidden landmarks stay hidden", () => {
  it("keeps a hidden map landmark after it leaves and comes back", () => {
    const bar: Landmark = { id: "osm-1", lng: 36.8, lat: -1.28, label: "Bar", kind: "food", source: "map" };
    let cur: Landmark[] = mergeLandmarks([], [bar]).map((l) => ({ ...l, hidden: true }));
    cur = mergeLandmarks(cur, []);
    expect(cur).toHaveLength(1);
    expect(cur[0].hidden).toBe(true);
    cur = mergeLandmarks(cur, [bar]);
    expect(cur).toHaveLength(1);
    expect(cur[0].hidden).toBe(true);
  });
});

describe("isRouteDoc", () => {
  it("rejects crafted docs", () => {
    const seg = { id: "a", mode: "constructor", from: {}, to: {}, vias: [], geometry: [], drawn: false, distanceM: 0, durationS: 0 };
    expect(isRouteDoc({ v: 1, segments: [seg], landmarks: [], steps: [] })).toBe(false);
    const good = doc();
    expect(isRouteDoc(good)).toBe(true);
    expect(isRouteDoc({ ...good, steps: [null] })).toBe(false);
    expect(isRouteDoc({ ...good, landmarks: [null] })).toBe(false);
    expect(isRouteDoc({ ...good, segments: [{ ...good.segments[0], from: { lng: NaN, lat: 0 } }] })).toBe(false);
    expect(isRouteDoc({ ...good, segments: [{ ...good.segments[0], geometry: [[1]] }] })).toBe(false);
  });
});

describe("opening a link does not wipe a draft", () => {
  const draft = doc("My unfinished route");
  const linked = doc("Shared route");
  it("does not arm draft saving when a draft exists", () => {
    const s = initialState("?d=x", () => draft, () => linked);
    expect(s.phase).toBe("edit");
    expect(s.doc.title).toBe("Shared route");
    expect(s.saveArmed).toBe(false);
  });
  it("arms saving when there is no draft", () => {
    expect(initialState("?d=x", () => null, () => linked).saveArmed).toBe(true);
  });
  it("falls back to the draft on a broken link", () => {
    const s = initialState("?d=x", () => draft, () => null);
    expect(s.phase).toBe("resume");
    expect(s.badLink).toBe(true);
  });
});

describe("route fallback", () => {
  beforeEach(() => resetRateLimits());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses OSRM when ORS fails, and sends radiuses to ORS", async () => {
    vi.stubEnv("ORS_API_KEY", "test-key");
    const calls: { url: string; body?: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body as string | undefined });
        if (url.includes("openrouteservice")) return new Response("{}", { status: 500 });
        return Response.json({ code: "Ok", routes: [{ distance: 100, geometry: { coordinates: [[36.8, -1.26], [36.81, -1.26]] } }] });
      }),
    );
    const { GET } = await import("@/app/api/route/route");
    const res = await GET(new Request("http://x/api/route?profile=foot&points=36.8,-1.26;36.81,-1.26"));
    expect(res.status).toBe(200);
    expect(calls[0].url).toContain("openrouteservice");
    expect(JSON.parse(calls[0].body!).radiuses).toEqual([-1, -1]);
    expect(calls[1].url).toContain("routing.openstreetmap.de");
  });
});
