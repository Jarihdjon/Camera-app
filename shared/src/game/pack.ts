import { z } from "zod";
import { BEAT_EFFECTS, CHARACTER_KINDS, GATES } from "./types.js";

/**
 * A topic pack: everything one level needs. Every pack fills the same seven gates, so
 * every level in every realm has the same mix; only the topic changes.
 */
const Band = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const PackChoiceSchema = z.object({
  id: z.string().min(1),
  band: Band,
  prompt: z.string().min(1),
  /** Listen gate: what Sparky says aloud (the text is hidden until he asks to see it). */
  say: z.string().optional(),
  options: z.array(z.string().min(1)).length(3),
  correct: z.number().int().min(0).max(2),
  hint: z.string().min(1),
});

export const PaletteSchema = z.object({
  top: z.string(), side: z.string(), accent: z.string(), prop: z.string(), prop2: z.string(),
  sky: z.tuple([z.string(), z.string()]), fog: z.string(),
  props: z.enum(["jungle", "town", "beach", "moon", "castle"]),
});

const LineSchema = z.object({ who: z.string().min(1), line: z.string().min(1).max(220) });

/** The level's story: a character who needs help, and the seven gates as steps of a treasure hunt. */
export const MissionSchema = z.object({
  title: z.string().min(1),
  goal: z.string().min(1).max(120),
  treasure: z.object({ name: z.string().min(1), emoji: z.string().min(1) }),
  characters: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: z.enum(CHARACTER_KINDS),
    color: z.string(),
    voice: z.object({ pitch: z.number().min(0.5).max(2), rate: z.number().min(0.6).max(1.3) }).optional(),
  })).min(1),
  intro: z.array(LineSchema).min(1).max(6),
  beats: z.array(z.object({
    who: z.string().min(1),
    setup: z.string().min(1).max(220),
    success: z.string().min(1).max(220),
    fail: z.string().min(1).max(220),
    effect: z.enum(BEAT_EFFECTS),
    clue: z.string().min(1).max(80),
    clueIcon: z.string().min(1),
  })).length(GATES.length),
  finale: z.array(LineSchema).min(1).max(5),
  /** Things the Number beat counts, so its maths fits the story (e.g. bridge planks). */
  numberThings: z.array(z.object({ one: z.string(), many: z.string() })).optional(),
});

export const PackSchema = z.object({
  id: z.string().min(1),
  realm: z.string().min(1),
  level: z.string().min(1),
  title: z.string().min(1),
  emoji: z.string().min(1),
  palette: PaletteSchema,
  passage: z.object({ title: z.string().min(1), text: z.string().min(1) }),
  glossary: z.array(z.object({ word: z.string().min(1), meaning: z.string().min(1) })).min(2),
  /** Things to count in Number gates, e.g. { one: "banana", many: "bananas" }. */
  things: z.array(z.object({ one: z.string(), many: z.string() })).min(3),
  /** Topic words for spelling, easiest first. */
  spelling: z.array(z.string().regex(/^[a-z]+$/)).min(6),
  /** Sentences to rebuild from word tiles. */
  sentences: z.array(z.object({ band: Band, text: z.string().min(1) })).min(3),
  questions: z.object({
    listen: z.array(PackChoiceSchema).min(4),
    read: z.array(PackChoiceSchema).min(4),
    word: z.array(PackChoiceSchema).min(4),
    science: z.array(PackChoiceSchema).min(4),
  }),
  eggs: z.array(z.enum(["shield", "jet", "hint", "magnet"])).length(2).default(["jet", "shield"]),
  mission: MissionSchema.optional(),
}).superRefine((p, ctx) => {
  if (p.mission) {
    const ids = new Set(["sparky", ...p.mission.characters.map((c) => c.id)]);
    for (const l of [...p.mission.intro, ...p.mission.finale, ...p.mission.beats]) {
      if (!ids.has(l.who)) ctx.addIssue({ code: "custom", message: `mission line by unknown character "${l.who}"` });
    }
  }
  const ids = Object.values(p.questions).flat().map((q) => q.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "question ids must be unique" });
  for (const q of p.questions.listen) if (!q.say) ctx.addIssue({ code: "custom", message: `${q.id}: listen questions need "say"` });
});

export const RealmDefSchema = z.object({
  /** The realm's quest item: one piece comes back with each level that has a mission. */
  quest: z.object({ name: z.string().min(1), emoji: z.string().min(1) }).optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  emoji: z.string().min(1),
  color: z.string(),
  sky: z.tuple([z.string(), z.string()]),
  levels: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), emoji: z.string().min(1), pack: z.string().nullable() })).min(1),
});

export type Pack = z.infer<typeof PackSchema>;
export type PackChoice = z.infer<typeof PackChoiceSchema>;
export type RealmDef = z.infer<typeof RealmDefSchema>;
export type MissionDef = z.infer<typeof MissionSchema>;
