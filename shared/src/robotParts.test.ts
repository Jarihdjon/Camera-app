import { describe, expect, it } from "vitest";
import { equip, resolveLook, unlockedParts } from "./robotParts";

describe("robot parts", () => {
  it("starts with the default part in every slot", () => {
    expect(resolveLook([])).toEqual({ cape: "cape-orange", visor: "visor-teal", boots: "boots-hover" });
    expect(unlockedParts(0)).toEqual(["cape-orange", "visor-teal", "boots-hover"]);
  });
  it("equipping replaces only the same slot", () => {
    const a = equip(["visor-galaxy"], "cape-stars");
    expect(resolveLook(a)).toEqual({ cape: "cape-stars", visor: "visor-galaxy", boots: "boots-hover" });
    expect(resolveLook(equip(a, "cape-lightning")).cape).toBe("cape-lightning");
  });
});
