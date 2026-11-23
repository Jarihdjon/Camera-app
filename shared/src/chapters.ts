import { z } from "zod";

/**
 * Chapters are planets around the Star Station hub. Each holds stages that unlock in
 * order: story stages (one inquiry unit each), a Word Vault review built from what is
 * due for him, and a chapter challenge built from the chapter's own items.
 */
export const StageDefSchema = z.discriminatedUnion("kind", [
  z.object({ id: z.string().min(1), kind: z.literal("story"), unitId: z.string().min(1) }),
  z.object({ id: z.string().min(1), kind: z.literal("review") }),
  z.object({ id: z.string().min(1), kind: z.literal("challenge") }),
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
