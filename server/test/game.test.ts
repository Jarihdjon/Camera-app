import { beforeAll, describe, expect, it } from "vitest";
import { buildLayout, GATES, QUESTIONS_PER_GATE } from "@yav/shared/game";
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
  const rightAnswer = (q: { id: string; kind: string }) => {
    const a = (db.prepare("SELECT answer FROM game_question WHERE id = ?").get(q.id) as { answer: string }).answer;
    return q.kind === "choice" ? Number(a) : a;
  };
  /** Answer the whole round at a gate correctly. */
  const clearGate = async (run: string, gate: number) => {
    let r: Record<string, unknown> = {};
    for (let i = 0; i < QUESTIONS_PER_GATE; i++) {
      const q = await post("/gate", { runId: run, gate });
      r = await post("/answer", { questionId: q.id, answer: rightAnswer(q) });
    }
    return r;
  };

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

  it("a gate is a round of questions: all must be right, and the last is a harder boss question", async () => {
    const q1 = await post("/gate", { runId, gate: 0 });
    expect(q1).toMatchObject({ step: 1, steps: QUESTIONS_PER_GATE });
    const r1 = await post("/answer", { questionId: q1.id, answer: rightAnswer(q1) });
    expect(r1).toMatchObject({ correct: true, progress: 1, needed: QUESTIONS_PER_GATE, checkpoint: 0 });
    const q2 = await post("/gate", { runId, gate: 0 });
    expect(q2.step).toBe(2);
    expect(q2.prompt).not.toBe(q1.prompt);
    await post("/answer", { questionId: q2.id, answer: rightAnswer(q2) });
    const boss = await post("/gate", { runId, gate: 0 });
    expect(boss.step).toBe(QUESTIONS_PER_GATE);
    expect(boss.band).toBeGreaterThanOrEqual(q2.band);
    const r3 = await post("/answer", { questionId: boss.id, answer: rightAnswer(boss) });
    expect(r3).toMatchObject({ correct: true, progress: 3, checkpoint: 1 });
    expect((await post("/level/jungle-jumble/start", {})).checkpoint).toBe(1);
  });

  it("a miss part-way through a round starts the round again", async () => {
    const run = (await post("/level/busy-town/start", {})).runId;
    const q1 = await post("/gate", { runId: run, gate: 0 });
    await post("/answer", { questionId: q1.id, answer: rightAnswer(q1) });
    const q2 = await post("/gate", { runId: run, gate: 0 });
    const miss = await post("/answer", { questionId: q2.id, answer: "definitely wrong" });
    expect(miss).toMatchObject({ correct: false, progress: 0, checkpoint: 0 });
    expect((await post("/gate", { runId: run, gate: 0 })).step).toBe(1);
  });

  it("eggs give perks once, and a shield absorbs one wrong answer", async () => {
    const jet = await post("/collect", { levelId: "jungle-jumble", kind: "egg", id: "egg0" });
    expect(jet.perk).toBe("jet");
    expect(jet.state.jet).toBe(true);
    expect((await post("/collect", { levelId: "jungle-jumble", kind: "egg", id: "egg0" })).perk).toBeNull();
    const sh = await post("/collect", { levelId: "jungle-jumble", kind: "egg", id: "egg1" });
    expect(sh.state.shield).toBe(2);
    const q0 = await post("/gate", { runId, gate: 1 });
    await post("/answer", { questionId: q0.id, answer: rightAnswer(q0) });
    const q = await post("/gate", { runId, gate: 1 });
    const r = await post("/answer", { questionId: q.id, answer: "definitely wrong" });
    // The shield saves him and keeps his place in the round.
    expect(r).toMatchObject({ correct: false, shielded: true, shields: 1, checkpoint: 1, progress: 1 });
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
    for (let g = 1; g < GATES.length; g++) await clearGate(runId, g);
    const done = await post("/finish", { runId });
    expect(done).toMatchObject({ minutesEarned: 15, bonusGems: 10 });
    const s = (await app.inject({ method: "GET", url: "/api/game/state" })).json();
    expect(s.realms[0].levels[0].completed).toBe(true);
    // Finishing a mission level returns a Heartwood Compass piece to Wildlands.
    expect(s.realms[0].quest).toMatchObject({ name: "Heartwood Compass", pieces: 1, total: 4 });
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

describe("missions", () => {
  it("Jungle Jumble has a full seven-beat mission with a bridge", () => {
    const m = jungle.mission!;
    expect(m.beats).toHaveLength(7);
    expect(m.beats.map((b) => b.effect)).toEqual(["fly", "signpost", "door", "bridge", "vine", "chest", "vault"]);
    expect(m.characters.map((c) => c.id)).toContain("kip");
  });

  it("the bridge beat turns its gate into a gap that planks fill once answered", () => {
    const withMission = buildLayout(jungle.id, jungle.eggs, jungle.mission!.beats.map((b) => b.effect));
    const bridge = withMission.reveals.find((r) => r.gate === 3)!;
    expect(bridge.boxes).toHaveLength(6);
    const gate = withMission.gates[3]!;
    const after = withMission.checkpoints[4]!;
    // No ground between the approach and the far bank until the planks appear.
    const gapZ = (gate.z + after.z) / 2;
    const solid = withMission.boxes.some((b) => Math.abs(b.x) < 1 && Math.abs(b.z - gapZ) < b.d / 2 && b.kind === "ground");
    expect(solid).toBe(false);
  });

  it("the Number beat counts the story's things", () => {
    const content2 = loadGameContent();
    const pack = content2.packs.get("wildlands-jungle-jumble")!;
    const q = numberQuestion(2, { ...pack, things: pack.mission!.numberThings! }, "seed-1");
    expect(q.prompt).toMatch(/bridge plank|log|rope/);
  });
});
