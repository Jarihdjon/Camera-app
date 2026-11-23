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
    expect(h.chapters[0].stages).toHaveLength(11);
    expect(h.chapters[0].stages.filter((s: { status: string }) => s.status === "open").map((s: { id: string }) => s.id)).toEqual(["lunchbox-read"]);
    const locked = await app.inject({ method: "GET", url: "/api/stage/ch1-launch-pad/lunchbox-think" });
    expect(locked.statusCode).toBe(403);
  });

  it("tiers climb along the chapter, and each chapter starts higher", async () => {
    const h = await hub();
    const t1 = h.chapters[0].stages.map((s: { tier: number }) => s.tier);
    expect(t1[0]).toBe(1);
    expect(t1.at(-1)).toBe(5);
    expect([...t1].sort((a: number, b: number) => a - b)).toEqual(t1);
    expect(h.chapters[1].stages[0].tier).toBe(2);
    expect(h.chapters[2].stages[0].tier).toBe(3);
  });

  it("saves progress per part and offers to resume it", async () => {
    const open = (await app.inject({ method: "GET", url: "/api/stage/ch1-launch-pad/lunchbox-read" })).json();
    expect(open).toMatchObject({ part: "read", tier: 1, progress: null, progressId: "bank-002-the-lost-lunchbox#read" });
    expect(open.unit.questions[0]).not.toHaveProperty("accept");
    await app.inject({ method: "PUT", url: `/api/unit/${encodeURIComponent(open.progressId)}/progress`, payload: { chapterId: "ch1-launch-pad", stageId: "lunchbox-read", step: 3, state: { answer: "elev" }, label: "Reading the story" } });
    const again = (await app.inject({ method: "GET", url: "/api/stage/ch1-launch-pad/lunchbox-read" })).json();
    expect(again.progress).toEqual({ step: 3, state: { answer: "elev" } });
    expect((await hub()).resume).toMatchObject({ stageId: "lunchbox-read", label: "Reading the story" });
  });

  it("read and think give stars but no minutes; create finishes the unit and earns minutes", async () => {
    const r1 = await complete("ch1-launch-pad", "lunchbox-read");
    expect(r1).toMatchObject({ stars: 3, newStars: 3, minutesEarned: 0, unlockedStage: "lunchbox-think", unlockedChapter: null });
    expect((await hub()).resume).toBeNull();
    expect((await complete("ch1-launch-pad", "lunchbox-think")).minutesEarned).toBe(0);
    const r3 = await complete("ch1-launch-pad", "lunchbox-create");
    expect(r3).toMatchObject({ minutesEarned: 15, unlockedStage: "rocket-read" });
  });

  it("uses the stage's short writing task instead of the Story Mountain", async () => {
    db.prepare("INSERT INTO stage_progress (chapter_id, stage_id, status) VALUES ('ch1-launch-pad', 'rocket-create', 'open')").run();
    const create = (await app.inject({ method: "GET", url: "/api/stage/ch1-launch-pad/rocket-create" })).json();
    expect(create.part).toBe("create");
    expect(create.unit.writing.format).toBe("sentences");
    expect(create.unit.writing.sentences).toBe(2);
  });

  it("never takes stars away on a replay", async () => {
    const r = await complete("ch1-launch-pad", "lunchbox-read", { secondTries: 9, wordsHunted: 0, asked: 0 });
    expect(r).toMatchObject({ stars: 1, newStars: 0 });
    expect((await hub()).chapters[0].stages[0].stars).toBe(3);
  });

  it("builds a Word Vault review from due words, and moves them along the schedule", async () => {
    for (const s of ["rocket-read", "rocket-think", "rocket-create", "moon-garden-read", "moon-garden-think", "moon-garden-create"]) await complete("ch1-launch-pad", s);
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
    db.prepare("INSERT INTO stage_progress (chapter_id, stage_id, status) VALUES ('ch3-ocean-garden', 'seed-read', 'open')").run();
    await app.inject({ method: "GET", url: "/api/stage/ch3-ocean-garden/seed-read" });
    expect(started).toBeGreaterThan(0);
  });
});
