import { describe, expect, it } from "vitest";
import { checkKeywords, checkMaths, checkShortAnswer, evaluateArithmetic } from "../src/engine/answers.js";

describe("checkShortAnswer", () => {
  it("accepts exact and case/punctuation variants", () => {
    expect(checkShortAnswer("Lamps!", ["lamps"])).toBe(true);
    expect(checkShortAnswer("  bright   lamps ", ["bright lamps"])).toBe(true);
  });
  it("forgives small spelling slips on longer words", () => {
    expect(checkShortAnswer("telescop", ["telescope"])).toBe(true);
    expect(checkShortAnswer("volcanoe", ["volcano"])).toBe(true);
  });
  it("stays strict on short words", () => {
    expect(checkShortAnswer("cat", ["car"])).toBe(false);
  });
  it("rejects empty answers", () => {
    expect(checkShortAnswer("   ", ["lamps"])).toBe(false);
  });
});

describe("arithmetic", () => {
  it("respects precedence and brackets", () => {
    expect(evaluateArithmetic("3 * 5 - 4")).toBe(11);
    expect(evaluateArithmetic("(3 + 5) * 2")).toBe(16);
    expect(evaluateArithmetic("20 / 4 + 1")).toBe(6);
  });
  it("rejects anything that is not arithmetic", () => {
    expect(() => evaluateArithmetic("process.exit()")).toThrow();
  });
  it("checks a typed answer", () => {
    expect(checkMaths("24", "6 * 4")).toBe(true);
    expect(checkMaths(" 1,000 ", "10 * 100")).toBe(true);
    expect(checkMaths("23", "6 * 4")).toBe(false);
  });
});

describe("keyword marking (from the workbook)", () => {
  it("finds the key word inside a sentence", () => {
    expect(checkKeywords("it was behind the door", ["door", "behind"])).toBe(true);
    expect(checkKeywords("on the shelf", ["door", "behind"])).toBe(false);
  });
  it("needs one word from each group", () => {
    const groups = [["sun", "sunlight", "light"], ["water"], ["air"]];
    expect(checkKeywords("sunlight, watr and air", [], groups)).toBe(true);
    expect(checkKeywords("water and air", [], groups)).toBe(false);
  });
  it("accepts 'about' answers within the tolerance", () => {
    expect(checkMaths("25", "5 + 21", 1)).toBe(true);
    expect(checkMaths("24", "5 + 21", 1)).toBe(false);
  });
});
