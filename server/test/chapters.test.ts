import { beforeAll, describe, expect, it } from "vitest";
import { openDb } from "../src/db/db.js";
import { setSetting } from "../src/db/settings.js";
import { loadContentBank } from "../src/content.js";
import { buildApp } from "../src/app.js";
import { starsFor } from "../src/engine/chapters.js";

const bank = loadContentBank();

describe("stars", () => {
  it("gives one for finishing, one for few second tries, one for curiosity", () => {
    expect(starsFor("story", { secondTries: 5, wordsHunted: 0, asked: 0 })).toBe(1);
    expect(starsFor("story", { secondTries: 2, wordsHunted: 0, asked: 0 })).toBe(2);
    expect(starsFor("story", { secondTries: 0, wordsHunted: 3, asked: 0 })).toBe(3);
    expect(starsFor("review", { secondTries: 0, wordsHunted: 0, asked: 0 })).toBe(3);
    expect(starsFor("review", { secondTries: 1, wordsHunted: 9, asked: 2 })).toBe(2);
  });
});

describe("chapters and stages", () => {
  const db = openDb(":memory:");
  let app: Awaited<ReturnType<typeof buildApp>>;
  let started = 0;
  beforeAll(async () => {
    db.prepare("INSERT INTO child (id, first_name) VALUES (1, 'Yav')").run();
    setSetting(db, "dailyUnitCap", 10);
    app = await buildApp({ db, bank, serveWeb: false, askModel: null, onLastChapterStarted: () => void started++ });
  });
  const hub = () => app.inject({ method: "GET", url: "/api/hub" }).then((r) => r.json());
  const complete = (c: string, s: string, m = { secondTries: 0, wordsHunted: 3, asked: 0 }) =>
    app.inject({ method: "POST", url: `/api/stage/${c}/${s}/complete`, payload: m }).then((r) => r.json());

  it("starts with only the first stage of chapter 1 open", async () => {
    const h = await hub();
    expect(h.chapters.map((c: { status: string }) => c.status)).toEqual(["open", "locked", "locked"]);
    expect(h.chapters[0].stages.map((s: { status: string }) => s.status)).toEqual(["open", "locked", "locked", "locked", "locked"]);
    const locked = await app.inject({ method: "GET", url: "/api/stage/ch1-launch-pad/rocket" });
    expect(locked.statusCode).toBe(403);
  });

  it("saves progress inside a unit and offers to resume it", async () => {
    const open = (await app.inject({ method: "GET", url: "/api/stage/ch1-launch-pad/lunchbox" })).json();
    expect(open.progress).toBeNull();
    expect(open.unit.questions[0]).not.toHaveProperty("accept");
    await app.inject({ method: "PUT", url: `/api/unit/${open.unit.id}/progress`, payload: { chapterId: "ch1-launch-pad", stageId: "lunchbox", step: 7, state: { answer: "elev" }, label: "question 4 of 7" } });
    const again = (await app.inject({ method: "GET", url: "/api/stage/ch1-launch-pad/lunchbox" })).json();
    expect(again.progress).toEqual({ step: 7, state: { answer: "elev" } });
    expect((await hub()).resume).toMatchObject({ stageId: "lunchbox", label: "question 4 of 7" });
  });

  it("finishing a stage gives stars, minutes and opens the next one, and clears the resume card", async () => {
    const r = await complete("ch1-launch-pad", "lunchbox");
    expect(r).toMatchObject({ stars: 3, newStars: 3, minutesEarned: 15, unlockedStage: "rocket", unlockedChapter: null });
    const h = await hub();
    expect(h.resume).toBeNull();
    expect(h.chapters[0].stages[0]).toMatchObject({ status: "done", stars: 3 });
    expect(h.chapters[0].stages[1].status).toBe("open");
  });

  it("never takes stars away on a replay", async () => {
    const r = await complete("ch1-launch-pad", "lunchbox", { secondTries: 9, wordsHunted: 0, asked: 0 });
    expect(r).toMatchObject({ stars: 1, newStars: 0 });
    expect((await hub()).chapters[0].stages[0].stars).toBe(3);
  });

  it("builds a Word Vault review from due words, and moves them along the schedule", async () => {
    await complete("ch1-launch-pad", "rocket");
    await complete("ch1-launch-pad", "moon-garden");
    // A word he tapped two days ago is due today.
    db.prepare("INSERT INTO word (word, meaning, source, review_step, due_at) VALUES ('identical', 'Exactly the same.', 'tapped', 0, datetime('now', '-1 day'))").run();
    const review = (await app.inject({ method: "GET", url: "/api/stage/ch1-launch-pad/review" })).json();
    expect(review.kind).toBe("review");
    const item = review.unit.questions.find((q: { id: string }) => q.id === "rv-w-identical");
    expect(item).toBeTruthy();
    expect(review.unit.questions.length).toBeGreaterThanOrEqual(4);
    const options: string[] = item.options;
    await app.inject({ method: "POST", url: "/api/attempt", payload: { unitId: review.unit.id, activityId: item.id, answer: options.indexOf("Exactly the same."), tryNumber: 1 } });
    const w = db.prepare("SELECT review_step, due_at FROM word WHERE word = 'identical'").get() as { review_step: number; due_at: string };
    expect(w.review_step).toBe(1);
    expect(new Date(w.due_at).getTime()).toBeGreaterThan(Date.now() + 2 * 86400000);
  });

  it("books a question he missed twice in for review", async () => {
    const q = { unitId: "bank-002-the-lost-lunchbox", activityId: "b002-q3", answer: "the bin" };
    await app.inject({ method: "POST", url: "/api/attempt", payload: { ...q, tryNumber: 2 } });
    const r = db.prepare("SELECT review_step FROM review_item WHERE activity_id = 'b002-q3'").get();
    expect(r).toEqual({ review_step: 0 });
  });

  it("builds a challenge from the chapter, and finishing it unlocks the next chapter", async () => {
    await complete("ch1-launch-pad", "review");
    const ch = (await app.inject({ method: "GET", url: "/api/stage/ch1-launch-pad/challenge" })).json();
    expect(ch.unit.questions.some((q: { kind: string }) => q.kind === "maths")).toBe(true);
    expect(ch.unit.gapFill).toBeTruthy();
    const r = await complete("ch1-launch-pad", "challenge");
    expect(r.unlockedChapter).toEqual({ id: "ch2-bushland", title: "Bushland Planet" });
    const h = await hub();
    expect(h.chapters[0].status).toBe("done");
    expect(h.chapters[1].status).toBe("open");
    expect(h.chapters[1].stages[0].status).toBe("open");
  });

  it("asks for a new chapter when he starts the last one", async () => {
    db.prepare("INSERT INTO stage_progress (chapter_id, stage_id, status) VALUES ('ch3-ocean-garden', 'seed', 'open')").run();
    await app.inject({ method: "GET", url: "/api/stage/ch3-ocean-garden/seed" });
    expect(started).toBeGreaterThan(0);
  });
});
