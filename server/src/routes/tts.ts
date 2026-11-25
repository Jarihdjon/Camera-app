import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { splitForSpeech } from "@yav/shared/childHelpers";
import { characterVoice, NARRATOR_VOICE, SPARKY_VOICE } from "@yav/shared/game";
import type { DB } from "../db/db.js";
import type { GameContent } from "../game/engine.js";
import { VOICES, type Tts, type Voice } from "../tts.js";

/**
 * GET /api/tts/status  → is the natural voice ready?
 * GET /api/tts?v=voice&s=speed&t=text → WAV audio for one sentence (cached).
 */
export const ttsRoutes: FastifyPluginAsync<{ tts: Tts | null }> = async (app, { tts }) => {
  app.get("/tts/status", async () => ({ state: tts?.state ?? "off", queued: tts?.queued ?? 0 }));

  app.get("/tts", async (req, reply) => {
    if (!tts || tts.state !== "ready") return reply.code(503).send({ error: "voice not ready" });
    const q = z.object({ v: z.enum(VOICES), s: z.coerce.number().min(0.6).max(1.4).default(1), t: z.string().trim().min(1).max(400) }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "bad request" });
    try {
      const wav = await tts.speak(q.data.t, q.data.v, q.data.s);
      return reply.header("content-type", "audio/wav").header("cache-control", "private, max-age=31536000, immutable").send(wav);
    } catch (e) {
      req.log.warn(e, "tts failed");
      return reply.code(500).send({ error: "voice failed" });
    }
  });
};

/**
 * Every line the game will read aloud, with the voice the iPad will ask for, so they can be
 * made ahead of time in the background: stories, listening sentences and mission scripts.
 */
export function gameLines(content: GameContent, names: { child: string; robot: string }) {
  const out: { text: string; voice: Voice; speed: number }[] = [];
  const add = (text: string, pick: { voice: string; speed: number }) => {
    for (const c of splitForSpeech(text)) out.push({ text: c.text, voice: pick.voice as Voice, speed: pick.speed });
  };
  for (const pack of content.packs.values()) {
    const m = pack.mission;
    if (m) {
      const byId = new Map(m.characters.map((c) => [c.id, c]));
      const line = (who: string, text: string) => {
        const c = byId.get(who);
        add(text.replaceAll("Sparky", names.robot).replaceAll("{name}", names.child), c ? characterVoice(c) : SPARKY_VOICE);
      };
      m.intro.forEach((l) => line(l.who, l.line));
      m.beats.forEach((b) => [b.setup, b.success, b.fail].forEach((t) => line(b.who, t)));
      m.finale.forEach((l) => line(l.who, l.line));
    }
    add(pack.passage.text, NARRATOR_VOICE);
  }
  return out;
}

export function childNames(db: DB) {
  const child = db.prepare("SELECT first_name FROM child WHERE id = 1").get() as { first_name: string } | undefined;
  const robot = db.prepare("SELECT name FROM robot WHERE id = 1").get() as { name: string } | undefined;
  return { child: child?.first_name ?? "friend", robot: robot?.name ?? "Sparky" };
}
