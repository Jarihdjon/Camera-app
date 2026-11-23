import { describe, expect, it } from "vitest";
import { mouthTimeline, syllables, wordAt, SYLLABLE_MS } from "./lipsync";

describe("lip-sync", () => {
  it("counts syllables roughly", () => {
    expect(syllables("hi")).toBe(1);
    expect(syllables("robot")).toBe(2);
    expect(syllables("fragile")).toBe(2);
    expect(syllables("astronaut")).toBe(3);
    expect(syllables("!!")).toBe(1);
  });
  it("opens once per syllable and ends closed", () => {
    const t = mouthTimeline("astronaut");
    expect(t.filter((f) => f.open > 0.5)).toHaveLength(3);
    expect(t.at(-1)).toEqual({ at: 3 * SYLLABLE_MS, open: 0 });
    // Keyframes are in time order.
    expect(t.map((f) => f.at)).toEqual([...t.map((f) => f.at)].sort((a, b) => a - b));
  });
  it("finds the word at a boundary", () => {
    expect(wordAt("Hi Yav, ready?", 3)).toBe("Yav");
    expect(wordAt("Hi Yav, ready?", 8, 5)).toBe("ready");
  });
});
