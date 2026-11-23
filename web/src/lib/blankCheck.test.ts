import { describe, expect, it } from "vitest";
import { analysePixels } from "./blankCheck";

function page(w: number, h: number, inkFraction: number, bg = 235): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  const inkPixels = Math.round(w * h * inkFraction);
  for (let i = 0; i < w * h; i++) {
    const v = i < inkPixels ? 30 : bg;
    px.set([v, v, v, 255], i * 4);
  }
  return px;
}

describe("blank-page check", () => {
  it("rejects a blank page", () => expect(analysePixels(page(100, 100, 0.002)).reason).toBe("looks-blank"));
  it("rejects a dark photo", () => expect(analysePixels(page(100, 100, 0, 20)).reason).toBe("too-dark"));
  it("accepts a written page", () => expect(analysePixels(page(100, 100, 0.06)).ok).toBe(true));
});
