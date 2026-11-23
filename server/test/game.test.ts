import { beforeAll, describe, expect, it } from "vitest";
import { buildLayout, GATES } from "@yav/shared/game";
import { openDb } from "../src/db/db.js";
import { setSetting } from "../src/db/settings.js";
import { loadContentBank } from "../src/content.js";
import { buildApp } from "../src/app.js";
import { loadGameContent } from "../src/game/engine.js";
import { numberQuestion, puzzleQuestion, sentenceQuestion, spellingQuestion } from "../src/game/generators.js";

const content = loadGameContent();
const jungle = content.packs.get("wildlands-jungle-jumble")!;

describe("game content", () => {
  it("loads both packs and the four realms", () => {
    expect(content.realms.map((r) => r.name)).toEqual(["Wildlands", "Splash Bay", "Cosmo Heights", "Dreamforge"]);
    expect([...content.packs.keys()].sort()).toEqual(["wildlands-busy-town", "wildlands-jungle-jumble"]);
  });

  it("builds the same course from the same seed, with 7 gates, 8 checkpoints and 2 eggs", () => {
    const a = buildLayout("wildlands-jungle-jumble");
    const b = buildLayout("wildlands-jungle-jumble");
    expect(a).toEqual(b);
    expect(a.gates).toHaveLength(GATES.length);
    expect(a.checkpoints).toHaveLength(GATES.length + 1);
    expect(a.eggs.map((e) => e.perk)).toEqual(["jet", "shield"]);
    expect(a.eggs[1]!.needsJet).toBe(true);
    expect(a.gems.filter((g) => g.big)).toHaveLength(1);
    // Gates run forward along the course.
    expect(a.gates.map((g) => g.z)).toEqual([...a.gates.map((g) => g.z)].sort((x, y) => x - y));
  });
});

describe("generators", () => {
  it("make number questions with computed answers at each band", () => {
    for (const band of [1, 2, 3] as const) {
      for (let i = 0; i < 30; i++) {
        const q = numberQuestion(band, jungle, `n${band}-${i}`);
        const n = Number(q.answer);
        expect(Number.isInteger(n) && n >= 0).toBe(true);
        if (band === 1) expect(n).toBeLessThanOrEqual(50);
      }
    }
    // Same seed, same question; different seeds vary.
    expect(numberQuestion(2, jungle, "x").prompt).toBe(numberQuestion(2, jungle, "x").prompt);
    const prompts = new Set(Array.from({ length: 20 }, (_, i) => numberQuestion(2, jungle, `s${i}`).prompt));
    expect(prompts.size).toBeGreaterThan(10);
  });

  it("make puzzles whose answer is one of the options", () => {
    for (const band of [1, 2, 3] as const) {
      for (let i = 0; i < 30; i++) {
        const q = puzzleQuestion(band, `p${band}-${i}`);
        expect(q.options).toHaveLength(3);
        expect(q.options![Number(q.answer)]).toBe(q.answerText);
        expect(new Set(q.options).size).toBe(3);
      }
    }
    const q = puzzleQuestion(1, "fixed");
    if (q.prompt.startsWith("What number")) {
      const nums = q.prompt.match(/-?\d+/g)!.map(Number);
      expect(Number(q.answerText) - nums[3]!).toBe(nums[3]! - nums[2]!);
    }
  });

  it("make spelling and sentence tiles that rebuild the answer", () => {
    const s = spellingQuestion(1, jungle, "a");
    expect(s.letters!.slice().sort().join("")).toBe(s.answer.split("").sort().join(""));
    const t = sentenceQuestion(2, jungle, "b");
    expect(t.tiles!.slice().sort().join(" ")).toBe(t.answer.split(" ").sort().join(" "));
    expect(t.tiles!.join(" ")).not.toBe(t.answer);
  });
});

describe("game API", () => {
  const db = openDb(":memory:");
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    app = await buildApp({ db, bank: loadContentBank(), serveWeb: false, askModel: null, gameContent: content });
  });
  const post = (url: string, payload: Record<string, unknown>) => app.inject({ method: "POST", url: `/api/game${url}`, payload }).then((r) => r.json());

  let runId = "";
  it("shows every realm open, with coming-soon levels marked", async () => {
    const s = (await app.inject({ method: "GET", url: "/api/game/state" })).json();
    expect(s.realms).toHaveLength(4);
    const wild = s.realms[0];
    expect(wild.levels[0]).toMatchObject({ name: "Jungle Jumble", completed: false, checkpoint: 0 });
    expect(wild.levels[0].gemsTotal).toBeGreaterThan(10);
    expect(wild.levels[2].packId).toBeNull();
  });

  it("starts a level and resumes the same run", async () => {
    const a = await post("/level/jungle-jumble/start", {});
    const b = await post("/level/jungle-jumble/start", {});
    expect(a.runId).toBe(b.runId);
    expect(a.pack.passage.title).toBe("Kip the Koala");
    runId = a.runId;
  });

  it("never sends the answer, and returns the same open question after a reload", async () => {
    const q1 = await post("/gate", { runId, gate: 0 });
    expect(q1.gate).toBe("listen");
    expect(JSON.stringify(q1)).not.toMatch(/"correct"|"answer"/);
    const again = await post("/gate", { runId, gate: 0 });
    expect(again).toEqual(q1);
  });

  it("a wrong answer keeps the checkpoint and the gate asks a fresh question of the same kind", async () => {
    const q1 = await post("/gate", { runId, gate: 0 });
    const wrongIndex = [0, 1, 2].find((i) => i !== Number(db.prepare("SELECT answer FROM game_question WHERE id = ?").get(q1.id) && (db.prepare("SELECT answer FROM game_question WHERE id = ?").get(q1.id) as { answer: string }).answer))!;
    const r = await post("/answer", { questionId: q1.id, answer: wrongIndex });
    expect(r).toMatchObject({ correct: false, shielded: false, checkpoint: 0 });
    const q2 = await post("/gate", { runId, gate: 0 });
    expect(q2.id).not.toBe(q1.id);
    expect(q2.gate).toBe("listen");
    expect(q2.prompt).not.toBe(q1.prompt);
    // Answering an already-answered question is refused.
    expect((await app.inject({ method: "POST", url: "/api/game/answer", payload: { questionId: q1.id, answer: 0 } })).statusCode).toBe(409);
  });

  it("a right answer opens the gate and moves the checkpoint on", async () => {
    const q = await post("/gate", { runId, gate: 0 });
    const right = (db.prepare("SELECT answer FROM game_question WHERE id = ?").get(q.id) as { answer: string }).answer;
    const r = await post("/answer", { questionId: q.id, answer: Number(right) });
    expect(r).toMatchObject({ correct: true, checkpoint: 1 });
    expect((await post("/level/jungle-jumble/start", {})).checkpoint).toBe(1);
  });

  it("eggs give perks once, and a shield absorbs one wrong answer", async () => {
    const jet = await post("/collect", { levelId: "jungle-jumble", kind: "egg", id: "egg0" });
    expect(jet.perk).toBe("jet");
    expect(jet.state.jet).toBe(true);
    expect((await post("/collect", { levelId: "jungle-jumble", kind: "egg", id: "egg0" })).perk).toBeNull();
    const sh = await post("/collect", { levelId: "jungle-jumble", kind: "egg", id: "egg1" });
    expect(sh.state.shield).toBe(2);
    const q = await post("/gate", { runId, gate: 1 });
    const r = await post("/answer", { questionId: q.id, answer: "definitely wrong" });
    expect(r).toMatchObject({ correct: false, shielded: true, shields: 1, checkpoint: 1 });
  });

  it("gems count once each, big gems are worth 5", async () => {
    const layout = buildLayout("wildlands-jungle-jumble");
    const big = layout.gems.find((g) => g.big)!;
    const before = (await post("/collect", { levelId: "jungle-jumble", kind: "gem", id: "g0" })).wallet.gems;
    const again = (await post("/collect", { levelId: "jungle-jumble", kind: "gem", id: "g0" })).wallet.gems;
    expect(again).toBe(before);
    const after = (await post("/collect", { levelId: "jungle-jumble", kind: "gem", id: big.id })).wallet.gems;
    expect(after - again).toBe(5);
  });

  it("finishing needs all seven gates, then earns minutes and a gem bonus", async () => {
    expect((await app.inject({ method: "POST", url: "/api/game/finish", payload: { runId } })).statusCode).toBe(409);
    for (let g = 1; g < GATES.length; g++) {
      const q = await post("/gate", { runId, gate: g });
      const right = (db.prepare("SELECT answer FROM game_question WHERE id = ?").get(q.id) as { answer: string }).answer;
      await post("/answer", { questionId: q.id, answer: q.kind === "choice" ? Number(right) : right });
    }
    const done = await post("/finish", { runId });
    expect(done).toMatchObject({ minutesEarned: 15, bonusGems: 10 });
    const s = (await app.inject({ method: "GET", url: "/api/game/state" })).json();
    expect(s.realms[0].levels[0].completed).toBe(true);
    // Answers fed the learning engine.
    const n = (db.prepare("SELECT COUNT(*) AS n FROM attempt WHERE activity_id LIKE 'game:%'").get() as { n: number }).n;
    expect(n).toBeGreaterThanOrEqual(GATES.length);
  });

  it("parent difficulty moves the band", async () => {
    setSetting(db, "gameDifficulty", { wildlands: "hard" });
    const run = (await post("/level/busy-town/start", {})).runId;
    const q = await post("/gate", { runId: run, gate: 3 });
    expect(q.band).toBeGreaterThanOrEqual(2);
  });
});
