import { describe, expect, it } from "vitest";
import { applyAttempt, decay, type SkillState } from "../src/engine/mastery.js";
import { scheduleReview, firstReview, isDue } from "../src/engine/spaced.js";
import { planNextUnit, nextTheme } from "../src/engine/picker.js";

const start: SkillState = { mastery: 0.5, difficulty: 2, streakCorrect: 0, streakMissed: 0, lastPractised: null };
const now = new Date("2026-12-01T16:00:00Z");

describe("mastery", () => {
  it("steps difficulty up after three wins in a row", () => {
    let s = start;
    for (let i = 0; i < 3; i++) s = applyAttempt(s, { correct: true, usedHint: false }, now);
    expect(s.difficulty).toBe(3);
    expect(s.mastery).toBeGreaterThan(0.5);
  });
  it("steps difficulty down after two misses", () => {
    let s = applyAttempt(start, { correct: false, usedHint: false }, now);
    s = applyAttempt(s, { correct: false, usedHint: false }, now);
    expect(s.difficulty).toBe(1);
  });
  it("fades slowly without practice", () => {
    const s = decay({ ...start, lastPractised: new Date("2026-11-03T16:00:00Z") }, now);
    expect(s.mastery).toBeLessThan(0.5);
    expect(s.mastery).toBeGreaterThan(0.4);
  });
});

describe("spaced repetition", () => {
  it("follows 1, 3, 7, 14 days and resets on a miss", () => {
    let r = firstReview(now);
    expect(isDue(r, new Date(now.getTime() + 86400000))).toBe(true);
    r = scheduleReview(r, true, now);
    expect(r.step).toBe(1);
    expect((r.dueAt!.getTime() - now.getTime()) / 86400000).toBe(3);
    r = scheduleReview(r, false, now);
    expect(r.step).toBe(0);
  });
  it("retires an item after the last interval", () => {
    expect(scheduleReview({ step: 3, dueAt: now }, true, now).dueAt).toBeNull();
  });
});

describe("picker", () => {
  it("focuses the weakest strand and challenges the strongest", () => {
    const plan = planNextUnit({
      strands: [
        { strand: "maths", mastery: 0.8 },
        { strand: "reading", mastery: 0.3 },
        { strand: "writing", mastery: 0.4 },
        { strand: "inquiry", mastery: 0.5 },
      ],
      dueReviewSkills: [], pinnedSkills: [], lastFormat: "maths", recentThemes: [],
    });
    expect(plan.focusStrand).toBe("reading");
    expect(plan.challengeStrand).toBe("maths");
    expect(plan.avoidFormat).toBe("maths");
  });
  it("rotates to an unused theme", () => {
    expect(nextTheme(["minecraft", "astro-bot"])).toBe("space");
  });
});
