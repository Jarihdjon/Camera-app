import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { DB } from "../db/db.js";
import { getSetting } from "../db/settings.js";
import { walletBalance } from "../routes/child.js";
import { answerGate, collect, findLevel, finishLevel, gameState, gateQuestion, packView, startLevel, type GameContent } from "./engine.js";

/** The 3D game's API. Answers are checked here; the iPad never sees them. */
export const gameRoutes: FastifyPluginAsync<{ db: DB; content: GameContent }> = async (app, { db, content }) => {
  app.get("/state", async () => gameState(db, content));

  app.get("/pack/:levelId", async (req, reply) => {
    const { levelId } = z.object({ levelId: z.string() }).parse(req.params);
    const found = findLevel(content, levelId);
    return found?.pack ? packView(found.pack) : reply.code(404).send({ error: "no pack" });
  });

  app.post("/level/:levelId/start", async (req, reply) => {
    const { levelId } = z.object({ levelId: z.string() }).parse(req.params);
    return startLevel(db, content, levelId) ?? reply.code(404).send({ error: "coming soon" });
  });

  app.post("/gate", async (req, reply) => {
    const { runId, gate } = z.object({ runId: z.string(), gate: z.number().int().min(0).max(6) }).parse(req.body);
    return gateQuestion(db, content, runId, gate) ?? reply.code(404).send({ error: "no gate" });
  });

  app.post("/answer", async (req, reply) => {
    const { questionId, answer } = z.object({ questionId: z.string(), answer: z.union([z.string().max(200), z.number()]) }).parse(req.body);
    const r = answerGate(db, questionId, answer);
    return r ? { ...r, wallet: walletBalance(db) } : reply.code(409).send({ error: "already answered" });
  });

  app.post("/collect", async (req, reply) => {
    const body = z.object({ levelId: z.string(), kind: z.enum(["gem", "egg"]), id: z.string() }).parse(req.body);
    const r = collect(db, content, body.levelId, body.kind, body.id);
    return r ? { ...r, state: gameState(db, content).perks, wallet: walletBalance(db) } : reply.code(404).send({ error: "unknown" });
  });

  app.post("/finish", async (req, reply) => {
    const { runId } = z.object({ runId: z.string() }).parse(req.body);
    const r = finishLevel(db, runId, { perUnit: getSetting(db, "minutesPerUnit"), cap: getSetting(db, "dailyUnitCap") });
    return r ? { ...r, wallet: walletBalance(db) } : reply.code(409).send({ error: "not finished" });
  });
};
