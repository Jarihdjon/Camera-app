import { z } from "zod";
import { SKILL_IDS, THEMES, type SkillId } from "./skills.js";
import { paragraphs } from "./text.js";

export { paragraphs };

/**
 * The unit schema. Every unit, whether from the content bank or written by
 * Claude, must pass this before it is stored or shown to Yav.
 *
 * A unit walks the PYP inquiry cycle: Tune in, Find out (the story), Sort out
 * (word meanings, questions, gap fill), Go further (maths and inquiry), Reflect,
 * and Take action (writing on paper). Everything except the questions and the
 * writing task is optional, so short units still work.
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

/** Index of the story paragraph that holds the answer, for "look again" pointers. */
const para = z.number().int().min(0).optional();

export const ShortAnswerSchema = z.object({
  ...base,
  kind: z.literal("short-answer"),
  prompt: z.string().min(1),
  /**
   * "whole": the answer must be one of `accept`, with forgiving spelling.
   * "keyword": any word of the answer matching any word in `accept` counts, so a
   * sentence like "it was behind the door" is right. `groups` needs one word from each group.
   */
  match: z.enum(["whole", "keyword"]).default("whole"),
  accept: z.array(z.string().min(1)).default([]),
  groups: z.array(z.array(z.string().min(1)).min(1)).optional(),
  /** A model answer shown after he gets it, or after two tries. */
  model: z.string().optional(),
  hint: z.string().min(1),
  para,
});

export const MultipleChoiceSchema = z.object({
  ...base,
  kind: z.literal("multiple-choice"),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  correctIndex: z.number().int().min(0),
  hint: z.string().min(1),
  para,
});

/** Word detective: pick the closest meaning of a word from the story. */
export const WordMeaningSchema = z.object({
  ...base,
  kind: z.literal("word-meaning"),
  word: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  correctIndex: z.number().int().min(0),
  hint: z.string().min(1),
});

/**
 * Maths items carry an expression the server evaluates, so the answer key is never
 * trusted from the model. `tolerance` allows "about" answers (5 + 21 with tolerance 1 accepts 25 to 27).
 */
export const MathsSchema = z.object({
  ...base,
  kind: z.literal("maths"),
  prompt: z.string().min(1),
  /** Arithmetic only: digits, spaces, + - * / ( ). */
  expression: z.string().regex(/^[\d\s+\-*/()]+$/),
  tolerance: z.number().int().min(0).max(10).default(0),
  /** Unit shown next to the answer box, e.g. "crackers". */
  unit: z.string().optional(),
  /** Worked solution shown after he gets it, or after two tries. */
  working: z.string().optional(),
  hint: z.string().min(1),
});

/** A thinking question with no single right answer. Never marked; saved for a grown-up to talk about. */
export const OpenQuestionSchema = z.object({
  ...base,
  kind: z.literal("open"),
  prompt: z.string().min(1),
  /** One sensible idea, shown after he answers. */
  model: z.string().min(1),
});

/** Fill the gaps from a word bank. Decoys fit nowhere. */
export const GapFillSchema = z.object({
  ...base,
  kind: z.literal("gap-fill"),
  prompt: z.string().min(1),
  /** Each sentence contains ___ where the answer goes. */
  sentences: z.array(z.object({ text: z.string().includes("___"), answer: z.string().min(1) })).min(2).max(6),
  decoys: z.array(z.string().min(1)).max(3),
});

export const WritingTaskSchema = z.object({
  ...base,
  kind: z.literal("writing"),
  prompt: z.string().min(1),
  /** "sentences": up to three sentences. "story-mountain": plan a story on a five-stage mountain sheet. */
  format: z.enum(["sentences", "story-mountain"]).default("sentences"),
  /** Sentence starters remove the blank-page problem. */
  starters: z.array(z.string()).max(3),
  /** Number of sentences asked for: never more than three. */
  sentences: z.number().int().min(1).max(3),
  mode: z.enum(["print", "screen"]),
});

export const ActivitySchema = z.discriminatedUnion("kind", [
  ShortAnswerSchema,
  MultipleChoiceSchema,
  WordMeaningSchema,
  MathsSchema,
  OpenQuestionSchema,
  GapFillSchema,
  WritingTaskSchema,
]);

export const PassageSchema = z.object({
  title: z.string().min(1),
  /** Paragraphs separated by a blank line. */
  text: z.string().min(1),
  glossary: z.array(GlossEntrySchema),
});

export const PYP_THEMES = [
  "Who We Are",
  "Where We Are in Place and Time",
  "How We Express Ourselves",
  "How The World Works",
  "How We Organise Ourselves",
  "Sharing The Planet",
] as const;

export const InquirySchema = z.object({
  pypTheme: z.enum(PYP_THEMES),
  centralIdea: z.string().min(1),
  keyConcepts: z.array(z.string().min(1)).min(1).max(3),
  learnerProfile: z.string().min(1),
  /** Before reading: a question that connects the story to his own life. Optional to answer. */
  tuneIn: z.string().min(1),
  /** After the unit: reflect as the learner profile attribute. */
  reflect: z.string().min(1),
});

export { SELF_CHECK_ITEMS as SELF_CHECK } from "./text.js";

export const UnitSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    theme: ThemeSchema,
    source: z.enum(["bank", "claude"]),
    /** The unit's accent colour, e.g. "#3949AB". */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    inquiry: InquirySchema.optional(),
    warmup: ActivitySchema.optional(),
    passage: PassageSchema.optional(),
    /** Word detective, shown straight after the story. */
    vocab: z.array(WordMeaningSchema).max(4).default([]),
    questions: z.array(ActivitySchema).min(3).max(8),
    gapFill: GapFillSchema.optional(),
    /** Go further: maths and inquiry questions. */
    corner: z.array(ActivitySchema).max(4).default([]),
    writing: WritingTaskSchema,
  })
  .superRefine((unit, ctx) => {
    if (unit.passage) {
      const words = unit.passage.text.trim().split(/\s+/).length;
      const max = unit.source === "bank" ? 260 : 150;
      if (words < 80 || words > max) {
        ctx.addIssue({ code: "custom", path: ["passage", "text"], message: `Passage is ${words} words; must be 80 to ${max}` });
      }
      const paras = paragraphs(unit.passage.text).length;
      for (const [i, q] of unit.questions.entries()) {
        if ("para" in q && q.para !== undefined && q.para >= paras) {
          ctx.addIssue({ code: "custom", path: ["questions", i, "para"], message: `para ${q.para} but the story has ${paras} paragraphs` });
        }
      }
    }
    const all = [unit.warmup, ...unit.vocab, ...unit.questions, ...unit.corner].filter(Boolean) as Activity[];
    for (const [i, q] of all.entries()) {
      if ((q.kind === "multiple-choice" || q.kind === "word-meaning") && q.correctIndex >= q.options.length) {
        ctx.addIssue({ code: "custom", path: ["activities", i, "correctIndex"], message: `${q.id}: correctIndex out of range` });
      }
      if (q.kind === "short-answer" && q.accept.length === 0 && !q.groups?.length) {
        ctx.addIssue({ code: "custom", path: ["activities", i], message: `${q.id}: needs accept words or groups` });
      }
    }
    const ids = [...all, unit.writing, ...(unit.gapFill ? [unit.gapFill] : [])].map((a) => a.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["id"], message: "activity ids must be unique" });
  });


export type Activity = z.infer<typeof ActivitySchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type Passage = z.infer<typeof PassageSchema>;
export type Inquiry = z.infer<typeof InquirySchema>;
