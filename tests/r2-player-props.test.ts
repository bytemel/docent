import { describe, expect, it } from "vitest";
import { buildProps, countTriangles, createPersonModel } from "@/components/player/props3d";
import type { Walker } from "@/lib/types";

describe("3D props", () => {
  for (const kind of ["neutral", "man", "woman"] as Walker[]) {
    it(`keeps every ${kind} prop under the triangle budget`, () => {
      const props = buildProps(kind, false);
      for (const [name, n] of Object.entries(props.triangles)) {
        expect(n, name).toBeGreaterThan(200);
        expect(n, name).toBeLessThan(3000);
      }
      props.dispose();
    });
  }

  it("gives the woman a skirt and a bun, so she has more parts", () => {
    const woman = createPersonModel({ kind: "woman", shirt: "#c2410c", dark: false });
    const man = createPersonModel({ kind: "man", shirt: "#c2410c", dark: false });
    expect(countTriangles(woman.person.root)).toBeGreaterThan(countTriangles(man.person.root));
    woman.dispose();
    man.dispose();
  });
});

describe("gait", () => {
  function sample(speed: number, moving: boolean) {
    const { person, dispose } = createPersonModel({ kind: "neutral", shirt: "#c2410c", dark: false });
    const pelvis = person.root.children[0];
    const hipL = pelvis.children.find((c, i) => i > 0 && c.position.x < 0 && c.children.length === 2)!;
    const knee = hipL.children[1];
    const hips: number[] = [];
    const knees: number[] = [];
    for (let i = 0; i < 240; i++) {
      person.update(1 / 60, speed, moving);
      hips.push(hipL.rotation.x);
      knees.push(knee.rotation.x);
    }
    dispose();
    return { hips: hips.slice(60), knees: knees.slice(60) };
  }

  it("swings the legs about 25 degrees when walking", () => {
    const { hips } = sample(1.4, true);
    const range = (Math.max(...hips) - Math.min(...hips)) * (180 / Math.PI);
    expect(range).toBeGreaterThan(35);
    expect(range).toBeLessThan(60);
  });

  it("runs with a longer swing and a stronger knee lift", () => {
    const walk = sample(1.4, true);
    const run = sample(5, true);
    const span = (a: number[]) => Math.max(...a) - Math.min(...a);
    expect(span(run.hips)).toBeGreaterThan(span(walk.hips));
    expect(Math.min(...run.knees)).toBeLessThan(Math.min(...walk.knees));
  });

  it("only bends knees backwards", () => {
    const { knees } = sample(3, true);
    for (const k of knees) expect(k).toBeLessThanOrEqual(0.001);
  });

  it("stands nearly still when stopped", () => {
    const { hips } = sample(0, false);
    const range = (Math.max(...hips) - Math.min(...hips)) * (180 / Math.PI);
    expect(range).toBeLessThan(2);
  });
});
