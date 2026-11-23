import { z } from "zod";

/**
 * Chapters are planets around the Star Station hub. Each holds stages that unlock in
 * order: story stages (one inquiry unit each), a Word Vault review built from what is
 * due for him, and a chapter challenge built from the chapter's own items.
 */
/** Each story is split into three short stages that get harder: read, think, create. */
export const STAGE_PARTS = ["read", "think", "create"] as const;
export type StagePart = (typeof STAGE_PARTS)[number];

/** Replaces a unit's writing task for this stage, so workbook units stay as written. */
export const WritingOverrideSchema = z.object({
  format: z.enum(["sentences", "story-mountain"]),
  prompt: z.string().min(1),
  starters: z.array(z.string()).max(3).default([]),
  sentences: z.number().int().min(1).max(3).default(2),
});

/** Difficulty tier 1 (lots of help) to 5 (the chapter challenge). Worked out from position if not given. */
const tier = z.number().int().min(1).max(5).optional();

export const StageDefSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1),
    kind: z.literal("story"),
    unitId: z.string().min(1),
    /** Leave out to play the whole unit as one stage. */
    part: z.enum(STAGE_PARTS).optional(),
    tier,
    writing: WritingOverrideSchema.optional(),
  }),
  z.object({ id: z.string().min(1), kind: z.literal("review"), tier }),
  z.object({ id: z.string().min(1), kind: z.literal("challenge"), tier }),
]);

export const ChapterDefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  emoji: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Two colours for the planet's surface. */
  planet: z.tuple([z.string(), z.string()]),
  ring: z.boolean().default(false),
  stages: z.array(StageDefSchema).min(2),
});

export type StageDef = z.infer<typeof StageDefSchema>;
export type ChapterDef = z.infer<typeof ChapterDefSchema>;
export type WritingOverride = z.infer<typeof WritingOverrideSchema>;
