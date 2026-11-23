import { z } from "zod";
import { SKILL_IDS, THEMES, type SkillId } from "./skills.js";

/**
 * The unit schema. Every unit, whether from the content bank or written by
 * Claude, must pass this before it is stored or shown to Yav.
 */
export const SkillIdSchema = z.enum(SKILL_IDS as [SkillId, ...SkillId[]]);
export const ThemeSchema = z.enum(THEMES);

export const GlossEntrySchema = z.object({
  word: z.string().min(1),
  /** Child-friendly explanation the robot reads aloud when the word is tapped. */
  meaning: z.string().min(1).max(200),
});

const base = {
  id: z.string().min(1),
  skill: SkillIdSchema,
  difficulty: z.number().int().min(1).max(5),
};

export const ShortAnswerSchema = z.object({
  ...base,
  kind: z.literal("short-answer"),
  prompt: z.string().min(1),
  /** Accepted answers. Checked with forgiving spelling. */
  accept: z.array(z.string().min(1)).min(1),
  hint: z.string().min(1),
});

export const MultipleChoiceSchema = z.object({
  ...base,
  kind: z.literal("multiple-choice"),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  correctIndex: z.number().int().min(0),
  hint: z.string().min(1),
});

/**
 * Maths items carry an expression the server evaluates. The answer key is
 * never trusted from the model: code computes it.
 */
export const MathsSchema = z.object({
  ...base,
  kind: z.literal("maths"),
  prompt: z.string().min(1),
  /** Arithmetic only: digits, spaces, + - * / ( ). */
  expression: z.string().regex(/^[\d\s+\-*/()]+$/),
  hint: z.string().min(1),
});

export const WritingTaskSchema = z.object({
  ...base,
  kind: z.literal("writing"),
  prompt: z.string().min(1),
  /** Sentence starters remove the blank-page problem. */
  starters: z.array(z.string()).max(3),
  /** Number of sentences asked for: never more than three. */
  sentences: z.number().int().min(1).max(3),
  mode: z.enum(["print", "screen"]),
});

export const ActivitySchema = z.discriminatedUnion("kind", [
  ShortAnswerSchema,
  MultipleChoiceSchema,
  MathsSchema,
  WritingTaskSchema,
]);

export const PassageSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  glossary: z.array(GlossEntrySchema),
});

export const UnitSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    theme: ThemeSchema,
    source: z.enum(["bank", "claude"]),
    warmup: ActivitySchema,
    passage: PassageSchema.optional(),
    questions: z.array(ActivitySchema).min(4).max(6),
    writing: WritingTaskSchema,
  })
  .superRefine((unit, ctx) => {
    if (unit.passage) {
      const words = unit.passage.text.trim().split(/\s+/).length;
      if (words < 80 || words > 150) {
        ctx.addIssue({ code: "custom", path: ["passage", "text"], message: `Passage is ${words} words; must be 80 to 150` });
      }
    }
    for (const [i, q] of unit.questions.entries()) {
      if (q.kind === "multiple-choice" && q.correctIndex >= q.options.length) {
        ctx.addIssue({ code: "custom", path: ["questions", i, "correctIndex"], message: "correctIndex out of range" });
      }
    }
  });

export type Activity = z.infer<typeof ActivitySchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type Passage = z.infer<typeof PassageSchema>;
