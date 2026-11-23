import { describe, expect, it, beforeAll } from "vitest";
import { openDb } from "../src/db/db.js";
import { setSetting } from "../src/db/settings.js";
import { loadContentBank } from "../src/content.js";
import { buildApp } from "../src/app.js";
import { leaksAnswer, offlineAnswer, preScreen, tidy, wordAsked, type AskModel } from "../src/ai/ask.js";

const bank = loadContentBank();
const lunchbox = bank.find((u) => u.id === "bank-002-the-lost-lunchbox")!;
const fruitQ = lunchbox.questions.find((q) => q.id === "b002-q2")!;

describe("ask guardrails", () => {
  it("hands safety and personal questions straight to a grown-up", () => {
    expect(preScreen("my brother hits me")?.kind).toBe("grown-up");
    expect(preScreen("what is your address")?.kind).toBe("grown-up");
    expect(preScreen("don't tell mum")?.flagged).toBe(true);
    expect(preScreen("why did the koala hold on")).toBeNull();
  });
  it("spots word questions", () => {
    expect(wordAsked("What does identical mean?")).toBe("identical");
    expect(wordAsked("what is a joey")).toBe("joey");
    expect(wordAsked("craters")).toBe("craters");
    expect(wordAsked("why did Maya cry")).toBeNull();
  });
  it("answers workbook words offline", () => {
    expect(offlineAnswer("what does identical mean", lunchbox, undefined)).toMatchObject({ kind: "word" });
    expect(offlineAnswer("I'm stuck, help", lunchbox, fruitQ).reply).toContain("paragraph 1");
    expect(offlineAnswer("Can you give me a clue for this one?", lunchbox, fruitQ).reply).toContain("paragraph 1");
    expect(offlineAnswer("who would win in a fight", lunchbox, fruitQ).kind).toBe("offline");
  });
  it("catches replies that give the answer away", () => {
    expect(leaksAnswer("She packed a mandarin!", fruitQ)).toBe(true);
    expect(leaksAnswer("Look at the first paragraph to see what she packed.", fruitQ)).toBe(false);
  });
  it("keeps replies short", () => {
    expect(tidy("One. Two. Three. Four.")).toBe("One. Two. Three.");
  });
});

describe("ask route", () => {
  const db = openDb(":memory:");
  let calls = 0;
  let next: { kind: "answer" | "off-topic" | "grown-up"; reply: string } = { kind: "answer", reply: "Look at paragraph 1!" };
  const fake: AskModel = async () => {
    calls++;
    return { reply: next, refused: false, inputTokens: 100, outputTokens: 20, model: "claude-opus-5-5" };
  };
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    db.prepare("INSERT INTO child (id, first_name) VALUES (1, 'Yav')").run();
    app = await buildApp({ db, bank, serveWeb: false, askModel: fake });
  });
  const askQ = (question: string, activityId?: string) =>
    app.inject({ method: "POST", url: "/api/ask", payload: { unitId: lunchbox.id, activityId, question } }).then((r) => r.json());

  it("explains workbook words without calling the AI", async () => {
    const r = await askQ("what does identical mean?");
    expect(r.kind).toBe("word");
    expect(calls).toBe(0);
  });
  it("swaps a leaked answer for the hint", async () => {
    next = { kind: "answer", reply: "It was a mandarin." };
    const r = await askQ("what fruit did she pack", "b002-q2");
    expect(r.reply).not.toContain("mandarin");
    expect(r.reply).toContain("clue");
  });
  it("redirects off-topic and flags grown-up topics", async () => {
    next = { kind: "off-topic", reply: "Fun! Back to the story." };
    expect((await askQ("what is the best video game")).kind).toBe("off-topic");
    next = { kind: "grown-up", reply: "anything" };
    expect((await askQ("I feel sad at school")).kind).toBe("grown-up");
    const flagged = db.prepare("SELECT COUNT(*) AS n FROM ask_log WHERE flagged = 1").get() as { n: number };
    expect(flagged.n).toBe(1);
  });
  it("stops after the daily limit", async () => {
    setSetting(db, "askDailyLimit", 1);
    expect((await askQ("why were the boxes red")).kind).toBe("limit");
  });
});
