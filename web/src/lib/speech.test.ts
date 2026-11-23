import { describe, expect, it } from "vitest";
import { splitForSpeech, voiceScore } from "./speech";

describe("natural reading", () => {
  it("splits into sentences with pauses, longer between paragraphs", () => {
    const c = splitForSpeech("Kip lived in a tree. He ate leaves!\n\nA storm came. Was he safe?");
    expect(c.map((x) => x.text)).toEqual(["Kip lived in a tree.", "He ate leaves!", "A storm came.", "Was he safe?"]);
    expect(c[0]!.pause).toBeGreaterThan(200);
    expect(c[1]!.pause).toBeGreaterThan(c[0]!.pause);
    expect(c.at(-1)!.pause).toBe(0);
  });
  it("treats ... as a deliberate pause", () => {
    const c = splitForSpeech("Listen carefully. The parrots sang. ... How many parrots?");
    expect(c.map((x) => x.text)).toEqual(["Listen carefully.", "The parrots sang.", "How many parrots?"]);
    expect(c[1]!.pause).toBeGreaterThanOrEqual(700);
  });
  it("keeps quotes with their sentence", () => {
    const c = splitForSpeech("“This isn’t my lunch,” she said. Then she looked.");
    expect(c[0]!.text).toContain("she said.");
  });
  it("prefers enhanced Australian voices and never picks novelty voices", () => {
    expect(voiceScore({ name: "Karen (Enhanced)", lang: "en-AU" })).toBeGreaterThan(voiceScore({ name: "Karen", lang: "en-AU" }));
    expect(voiceScore({ name: "Karen", lang: "en-AU" })).toBeGreaterThan(voiceScore({ name: "Samantha", lang: "en-US" }));
    expect(voiceScore({ name: "Microsoft Natasha Online (Natural) - English (Australia)", lang: "en-AU" })).toBeGreaterThan(20);
    expect(voiceScore({ name: "Zarvox", lang: "en-US" })).toBe(-1);
    expect(voiceScore({ name: "Thomas", lang: "fr-FR" })).toBe(-1);
  });
});
