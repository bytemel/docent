import { describe, expect, it } from "vitest";
import { amendHistory, createHistory, pushHistory, redo, undo } from "@/lib/history";

describe("history", () => {
  it("undoes and redoes", () => {
    let h = createHistory(1);
    h = pushHistory(h, 2, { now: 0 });
    h = pushHistory(h, 3, { now: 5000 });
    h = undo(h);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(undo(h)).toBe(h);
    h = redo(h);
    expect(h.present).toBe(2);
    h = pushHistory(h, 9, { now: 9000 });
    expect(h.future).toHaveLength(0);
  });

  it("keeps at most 50 steps", () => {
    let h = createHistory(0);
    for (let i = 1; i <= 70; i++) h = pushHistory(h, i, { now: i * 5000 });
    expect(h.past).toHaveLength(50);
    expect(h.past[0]).toBe(20);
  });

  it("coalesces typing with the same key", () => {
    let h = createHistory("a");
    h = pushHistory(h, "ab", { key: "title", now: 0 });
    h = pushHistory(h, "abc", { key: "title", now: 300 });
    expect(h.past).toEqual(["a"]);
    h = pushHistory(h, "abcd", { key: "title", now: 5000 });
    expect(h.past).toEqual(["a", "abc"]);
  });

  it("amends without a new step", () => {
    let h = createHistory(1);
    h = amendHistory(h, 5);
    expect(h.present).toBe(5);
    expect(h.past).toHaveLength(0);
  });
});
