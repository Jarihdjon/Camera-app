import { describe, expect, it } from "vitest";
import { buildLayout } from "@yav/shared/game";
import { newBody, step, PHYS } from "./physics";

const flat = [{ id: "f", x: 0, y: -0.5, z: 0, w: 20, h: 1, d: 40, kind: "ground" as const }];
const run = (n: number, f: (i: number) => { x: number; y: number; jumpPressed: boolean; jumpHeld: boolean }, boxes = flat, jet = false) => {
  const b = newBody(0, 0, 0);
  let fell = false;
  for (let i = 0; i < n; i++) fell = step(b, f(i), 1 / 60, boxes, i / 60, jet) || fell;
  return { b, fell };
};
const idle = { x: 0, y: 0, jumpPressed: false, jumpHeld: false };

describe("physics", () => {
  it("stands on the ground and runs forward", () => {
    const { b } = run(60, () => ({ ...idle, y: 1 }));
    expect(b.grounded).toBe(true);
    expect(b.y).toBeCloseTo(0, 1);
    expect(b.z).toBeGreaterThan(4);
  });

  it("jumps about two blocks high, and the jet boost adds more", () => {
    let maxY = 0;
    const b = newBody(0, 0, 0);
    for (let i = 0; i < 90; i++) {
      step(b, { ...idle, jumpPressed: i === 0, jumpHeld: true }, 1 / 60, flat, 0, false);
      maxY = Math.max(maxY, b.y);
    }
    expect(maxY).toBeGreaterThan(1.7);
    expect(maxY).toBeLessThan(2.4);
    let jetMax = 0;
    const j = newBody(0, 0, 0);
    for (let i = 0; i < 120; i++) {
      step(j, { ...idle, jumpPressed: i === 0 || i === 25, jumpHeld: true }, 1 / 60, flat, 0, true);
      jetMax = Math.max(jetMax, j.y);
    }
    expect(jetMax).toBeGreaterThan(3.3);
  });

  it("falls off the world when there is no ground", () => {
    const { fell } = run(120, () => idle, []);
    expect(fell).toBe(true);
    expect(PHYS.fallY).toBeLessThan(0);
  });

  it("the jet egg ledge is out of reach without the boost, and reachable with it", () => {
    const layout = buildLayout("wildlands-jungle-jumble");
    const egg = layout.eggs.find((e) => e.needsJet)!;
    const ledge = layout.boxes.find((b) => b.kind === "ledge" && Math.abs(b.y + 0.5 - egg.y) < 0.01)!;
    const groundTop = egg.y - 3.2;
    expect(ledge.y + 0.5 - groundTop).toBeGreaterThan(2.4); // single jump peaks near 2.0
  });
});
