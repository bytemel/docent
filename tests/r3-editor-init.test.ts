import { describe, expect, it } from "vitest";
import { editorKey, hasLinkParams, initialState, searchFromParams, wantsAsk } from "@/components/editor/init";
import { emptyDoc, newSegment, withRoute } from "@/components/editor/ops";
import type { RouteDoc } from "@/lib/types";

const A = { lng: 36.8, lat: -1.26, label: "Westlands" };
const B = { lng: 36.76, lat: -1.26, label: "Kangemi" };
const doc = (title: string): RouteDoc => ({
  ...emptyDoc(),
  title,
  segments: [withRoute(newSegment(A, B, "walk", "s1"), [[36.8, -1.26], [36.78, -1.26], [36.76, -1.26]])],
});

describe("editor init from the page's search params", () => {
  it("keeps only the link params, first value wins", () => {
    expect(searchFromParams({ ask: "1", utm: "x" })).toBe("?ask=1");
    expect(searchFromParams({ d: ["abc", "def"], from: "36.75,-1.267" })).toBe("?d=abc&from=36.75%2C-1.267");
    expect(searchFromParams({})).toBe("");
  });

  it("opens the ask sheet from props", () => {
    const s = initialState(searchFromParams({ ask: "1" }), () => null, () => null);
    expect(s.ask).toBe(true);
    expect(s.phase).toBe("setup");
    expect(wantsAsk("?ask=1")).toBe(true);
    expect(wantsAsk("")).toBe(false);
  });

  it("loads a shared route from props without saving over a draft", () => {
    const s = initialState(searchFromParams({ d: "x" }), () => doc("Draft"), () => doc("Shared"));
    expect(s.phase).toBe("edit");
    expect(s.doc.title).toBe("Shared");
    expect(s.saveArmed).toBe(false);
  });

  it("starts from a reply link in props", () => {
    const s = initialState(searchFromParams({ from: "36.75,-1.267,12", fl: "At the gate", to: "36.8,-1.26,Sarit" }), () => null, () => null);
    expect(s.phase).toBe("edit");
    expect(s.doc.segments[0].from.label).toBe("At the gate");
  });

  it("remounts only when the route params change, not for ask", () => {
    expect(editorKey("?ask=1")).toBe(editorKey(""));
    expect(editorKey("?d=abc")).not.toBe(editorKey(""));
    expect(editorKey("?from=1,2")).not.toBe(editorKey("?from=1,3"));
    expect(hasLinkParams("?ask=1")).toBe(true);
    expect(hasLinkParams("?x=1")).toBe(false);
  });
});
