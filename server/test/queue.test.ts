import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/db.js";
import { setSetting } from "../src/db/settings.js";
import { loadContentBank } from "../src/content.js";
import { allChapters, chapterViews, loadBankChapters } from "../src/engine/chapters.js";
import { GenerationQueue } from "../src/ai/queue.js";
import { qualityProblems, readability } from "../src/ai/readability.js";
import type { UnitModel } from "../src/ai/claude.js";

const bank = loadContentBank();
const bankChapters = loadBankChapters(bank);
// A stand-in "Claude" that returns a copy of a real workbook unit.
const sample = bank.find((u) => u.id === "bank-002-the-lost-lunchbox")!;
const good: UnitModel = async () => ({ output: { ...sample, source: "claude" }, refused: false, inputTokens: 3000, outputTokens: 2500, model: "claude-opus-5-5" });

function unlockAll(db: ReturnType<typeof openDb>) {
  for (const c of bankChapters) db.prepare("INSERT OR REPLACE INTO stage_progress (chapter_id, stage_id, status) VALUES (?, ?, 'open')").run(c.id, c.stages[0]!.id);
}

describe("quality checks", () => {
  it("passes a workbook unit and measures reading level", () => {
    expect(qualityProblems({ ...sample, source: "claude" })).toEqual([]);
    expect(readability("The cat sat. The dog ran fast.").avgSentence).toBe(3.5);
  });
  it("rejects answers that are not in their paragraph, and glossary words not in the story", () => {
    const bad = structuredClone(sample);
    const q = bad.questions.find((x) => x.kind === "short-answer")!;
    if (q.kind === "short-answer") q.para = 3;
    bad.passage!.glossary.push({ word: "zeppelin", meaning: "An airship." });
    const p = qualityProblems(bad);
    expect(p.some((x) => x.includes("not in paragraph"))).toBe(true);
    expect(p.some((x) => x.includes("zeppelin"))).toBe(true);
  });
});

describe("generation queue", () => {
  it("is not needed while chapters are still locked", async () => {
    const db = openDb(":memory:");
    const q = new GenerationQueue(db, bank, bankChapters, good);
    expect(q.needed()).toBe(false);
    expect(await q.run()).toBe("not-needed");
  });

  it("writes a new locked planet once every chapter is unlocked", async () => {
    const db = openDb(":memory:");
    unlockAll(db);
    const q = new GenerationQueue(db, bank, bankChapters, good);
    expect(await q.run()).toBe("created");
    const chapters = allChapters(db, bankChapters);
    expect(chapters).toHaveLength(4);
    const ch4 = chapters[3]!;
    expect(ch4.stages.map((s) => (s.kind === "story" ? s.part : s.kind))).toEqual(["read", "think", "create", "read", "think", "create", "review", "challenge"]);
    const prompts = (db.prepare("SELECT prompt FROM generation_log ORDER BY id").all() as { prompt: string }[]).map((r) => r.prompt);
    expect(prompts[0]).toContain('format \"sentences\"'.replace(/\\/g, ""));
    expect(prompts[1]).toContain("story-mountain");
    expect(chapterViews(db, bank, chapters)[3]!.status).toBe("locked");
    const logged = db.prepare("SELECT COUNT(*) AS n FROM generation_log WHERE valid = 1").get() as { n: number };
    expect(logged.n).toBe(2);
    expect(q.needed()).toBe(false);
  });

  it("retries a bad draft once, then gives up without saving anything", async () => {
    const db = openDb(":memory:");
    unlockAll(db);
    let calls = 0;
    const bad: UnitModel = async () => {
      calls++;
      return { output: { ...sample, passage: { ...sample.passage!, glossary: [{ word: "zeppelin", meaning: "An airship." }] } }, refused: false, inputTokens: 10, outputTokens: 10, model: "claude-opus-5-5" };
    };
    const q = new GenerationQueue(db, bank, bankChapters, bad);
    expect(await q.run()).toBe("failed");
    expect(calls).toBe(4);
    expect(allChapters(db, bankChapters)).toHaveLength(3);
  });

  it("stops at the monthly spend cap", async () => {
    const db = openDb(":memory:");
    unlockAll(db);
    setSetting(db, "monthlySpendCapAud", 0);
    expect(await new GenerationQueue(db, bank, bankChapters, good).run()).toBe("cap");
  });
});
