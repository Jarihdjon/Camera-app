import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { toChildUnit, type ChapterDef, type Unit } from "@yav/shared";
import type { DB } from "../db/db.js";
import { getSetting } from "../db/settings.js";
import { findUnit } from "../units.js";
import { walletBalance } from "./child.js";
import {
  allChapters,
  buildChallengeUnit,
  buildReviewUnit,
  chapterViews,
  completeStage,
  findStage,
  hubView,
  learnerNow,
  progressKey,
  applyWriting,
  withStretch,
} from "../engine/chapters.js";

export interface ChapterOpts {
  db: DB;
  bank: Unit[];
  bankChapters: ChapterDef[];
  /** Called when he opens a stage in his last unlocked chapter: time to write the next one. */
  onLastChapterStarted?: () => void;
  isGenerating?: () => boolean;
}

export const chapterRoutes: FastifyPluginAsync<ChapterOpts> = async (app, opts) => {
  const { db, bank, bankChapters } = opts;
  const chapters = () => allChapters(db, bankChapters);

  app.get("/hub", async () => hubView(db, bank, chapters(), opts.isGenerating?.() ?? false));

  /** Open a stage: builds review and challenge stages fresh, adds stretch, and returns saved progress. */
  app.get("/stage/:chapterId/:stageId", async (req, reply) => {
    const { chapterId, stageId } = z.object({ chapterId: z.string(), stageId: z.string() }).parse(req.params);
    const list = chapters();
    const found = findStage(list, chapterId, stageId);
    if (!found) return reply.code(404).send({ error: "unknown stage" });
    const views = chapterViews(db, bank, list);
    const view = views.find((c) => c.id === chapterId)?.stages.find((s) => s.id === stageId);
    if (!view || view.status === "locked") return reply.code(403).send({ error: "locked" });

    const snap = learnerNow(db, bank, list);
    const tier = view.tier;
    const robot = (db.prepare("SELECT name FROM robot WHERE id = 1").get() as { name: string | null }).name ?? "Robot";
    let unit: Unit | undefined;
    if (found.stage.kind === "review") unit = buildReviewUnit(db, bank, found.chapter, snap);
    else if (found.stage.kind === "challenge") unit = buildChallengeUnit(db, bank, found.chapter, snap);
    else {
      const base = findUnit(db, bank, found.stage.unitId);
      unit = base && applyWriting(withStretch(db, bank.find((b) => b.id === base.id) ?? base, snap, robot, tier), found.stage);
    }
    if (!unit) return reply.code(404).send({ error: "unknown unit" });

    if (list[list.length - 1]?.id === chapterId || views.filter((c) => c.status === "locked").length === 0) opts.onLastChapterStarted?.();

    const progressId = progressKey(found.stage, chapterId);
    const saved = db.prepare("SELECT step, state FROM unit_progress WHERE unit_id = ?").get(progressId) as { step: number; state: string } | undefined;
    return {
      kind: found.stage.kind,
      part: found.stage.kind === "story" ? found.stage.part ?? null : null,
      tier,
      progressId,
      chapter: { id: found.chapter.id, title: found.chapter.title, color: found.chapter.color },
      unit: toChildUnit(unit),
      progress: saved ? { step: saved.step, state: JSON.parse(saved.state) as unknown } : null,
      levels: snap.levels,
    };
  });

  /** Saved after every step, so closing the app never loses his place. */
  app.put("/unit/:id/progress", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({
      chapterId: z.string().optional(),
      stageId: z.string().optional(),
      step: z.number().int().min(0),
      state: z.record(z.string(), z.unknown()).default({}),
      label: z.string().max(80).optional(),
    }).parse(req.body);
    const state = JSON.stringify(body.state);
    if (state.length > 20_000) return { ok: false };
    db.prepare(`INSERT INTO unit_progress (unit_id, chapter_id, stage_id, step, state, label, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(unit_id) DO UPDATE SET chapter_id = excluded.chapter_id, stage_id = excluded.stage_id, step = excluded.step,
                state = excluded.state, label = excluded.label, updated_at = excluded.updated_at`)
      .run(id, body.chapterId ?? null, body.stageId ?? null, body.step, state, body.label ?? null);
    return { ok: true };
  });

  app.post("/stage/:chapterId/:stageId/complete", async (req, reply) => {
    const { chapterId, stageId } = z.object({ chapterId: z.string(), stageId: z.string() }).parse(req.params);
    const metrics = z.object({
      secondTries: z.number().int().min(0).default(0),
      wordsHunted: z.number().int().min(0).default(0),
      asked: z.number().int().min(0).default(0),
    }).parse(req.body ?? {});
    const list = chapters();
    const view = chapterViews(db, bank, list).find((c) => c.id === chapterId)?.stages.find((s) => s.id === stageId);
    if (!view) return reply.code(404).send({ error: "unknown stage" });
    if (view.status === "locked") return reply.code(403).send({ error: "locked" });
    const result = completeStage(db, bank, list, chapterId, stageId, metrics, { perUnit: getSetting(db, "minutesPerUnit"), cap: getSetting(db, "dailyUnitCap") });
    return { ...result, wallet: walletBalance(db) };
  });
};
