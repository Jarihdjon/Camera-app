import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Unit } from "@yav/shared";
import type { DB } from "../db/db.js";
import { ask, type AskModel } from "../ai/ask.js";
import { findActivity, findUnit } from "../units.js";

interface Opts { db: DB; bank: Unit[]; model: AskModel | null }

/** Ask Sparky. Every question and reply is logged for the parent area. */
export const askRoutes: FastifyPluginAsync<Opts> = async (app, { db, bank, model }) => {
  app.post("/ask", async (req, reply) => {
    const body = z.object({
      unitId: z.string(),
      activityId: z.string().optional(),
      question: z.string().trim().min(1).max(200),
      /** A word tapped in the story, with its sentence, so the meaning fits the story. */
      word: z.object({ word: z.string().max(40), sentence: z.string().max(400) }).optional(),
    }).parse(req.body);
    const unit = findUnit(db, bank, body.unitId);
    if (!unit) return reply.code(404).send({ error: "unknown unit" });
    const activity = body.activityId ? findActivity(unit, body.activityId) : undefined;
    const child = db.prepare("SELECT first_name FROM child WHERE id = 1").get() as { first_name: string } | undefined;
    const robot = db.prepare("SELECT name FROM robot WHERE id = 1").get() as { name: string | null };

    // A tapped word we have explained before needs no new call.
    if (body.word) {
      const known = db.prepare("SELECT meaning FROM word WHERE word = ? AND meaning IS NOT NULL").get(body.word.word.toLowerCase()) as { meaning: string } | undefined;
      if (known) return { kind: "word", reply: known.meaning };
    }
    const question = body.word ? `What does "${body.word.word}" mean in this sentence: "${body.word.sentence}"` : body.question;
    const result = await ask(db, { unit, activity, question, names: { child: child?.first_name ?? "friend", robot: robot.name ?? "Robot" }, model });

    db.prepare("INSERT INTO ask_log (unit_id, activity_id, question, reply, kind, flagged) VALUES (?, ?, ?, ?, ?, ?)")
      .run(unit.id, body.activityId ?? null, body.word ? `(tapped) ${body.word.word}` : body.question, result.reply, result.kind, result.flagged ? 1 : 0);
    if (body.word && (result.kind === "word" || result.kind === "answer")) {
      db.prepare("UPDATE word SET meaning = ? WHERE word = ? AND meaning IS NULL").run(result.reply, body.word.word.toLowerCase());
    }
    // Asking is always the winning move: a gem for every on-topic question.
    if (result.kind === "answer" || result.kind === "word") {
      db.prepare("INSERT INTO wallet_entry (currency, amount, reason) VALUES ('gems', 1, 'ask')").run();
    }
    return { kind: result.kind, reply: result.reply };
  });
};
