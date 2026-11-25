import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Tts, type Engine } from "../src/tts.js";
import { gameLines } from "../src/routes/tts.js";
import { loadGameContent } from "../src/game/engine.js";

function fakeEngine(log: string[]): () => Promise<Engine> {
  return async () => ({
    generate: async (text) => {
      log.push(text);
      await new Promise((r) => setTimeout(r, 5));
      return new TextEncoder().encode(`RIFF${text}`).buffer;
    },
  });
}
const ready = async (t: Tts) => {
  t.start();
  while (t.state === "loading") await new Promise((r) => setTimeout(r, 1));
};

describe("natural voice", () => {
  it("makes each line once and serves it from the cache after", async () => {
    const log: string[] = [];
    const t = new Tts(mkdtempSync(path.join(tmpdir(), "tts-")), fakeEngine(log));
    await ready(t);
    const a = await t.speak("Hello there.", "af_heart", 1);
    const b = await t.speak("Hello there.", "af_heart", 1);
    expect(a.toString()).toBe("RIFFHello there.");
    expect(b.equals(a)).toBe(true);
    expect(log).toEqual(["Hello there."]);
  });

  it("lines the iPad is waiting for go before warm-up lines", async () => {
    const log: string[] = [];
    const t = new Tts(mkdtempSync(path.join(tmpdir(), "tts-")), fakeEngine(log));
    await ready(t);
    t.warm([1, 2, 3, 4].map((i) => ({ text: `warm ${i}`, voice: "af_heart" as const })));
    await t.speak("now please", "am_puck", 1.05);
    expect(log.indexOf("now please")).toBeLessThanOrEqual(1);
  });

  it("reports failure when the voice can't load, so the iPad uses its own", async () => {
    const t = new Tts(mkdtempSync(path.join(tmpdir(), "tts-")), async () => { throw new Error("no model"); });
    await ready(t);
    expect(t.state).toBe("failed");
  });

  it("knows every mission line, with names filled in", () => {
    const lines = gameLines(loadGameContent(), { child: "Yav", robot: "Bolt" });
    expect(lines.some((l) => l.text.includes("Bolt") && l.voice === "af_bella")).toBe(true);
    expect(lines.some((l) => l.text.includes("Sparky"))).toBe(false);
  });
});
