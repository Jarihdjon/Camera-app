/** The skill map from the build plan. Ids are stable: they key mastery rows in the database. */
export const STRANDS = ["reading", "writing", "maths", "inquiry"] as const;
export type Strand = (typeof STRANDS)[number];

export const SKILLS = {
  "reading.word-meaning": { strand: "reading", label: "Word meaning in context" },
  "reading.recall": { strand: "reading", label: "Recall" },
  "reading.inference": { strand: "reading", label: "Inference" },
  "reading.sentence-sense": { strand: "reading", label: "Understanding a whole sentence" },
  "reading.word-asking": { strand: "reading", label: "Asking about words" },
  "reading.listening": { strand: "reading", label: "Listening" },
  "writing.fill-blank": { strand: "writing", label: "Fill-in-the-blank sentences" },
  "writing.three-sentences": { strand: "writing", label: "Three-sentence responses" },
  "writing.story-mountain": { strand: "writing", label: "Story Mountain planning" },
  "writing.spelling": { strand: "writing", label: "Spelling" },
  "writing.sentence-building": { strand: "writing", label: "Building sentences" },
  "maths.place-value": { strand: "maths", label: "Place value" },
  "maths.add-subtract": { strand: "maths", label: "Add and subtract" },
  "maths.times-tables": { strand: "maths", label: "Times tables" },
  "maths.word-problems": { strand: "maths", label: "Multi-step word problems" },
  "maths.patterns": { strand: "maths", label: "Patterns and logic" },
  "inquiry.concepts": { strand: "inquiry", label: "PYP key concepts" },
  "inquiry.predictions": { strand: "inquiry", label: "Predictions" },
  "inquiry.why-questions": { strand: "inquiry", label: "Why-questions" },
} as const satisfies Record<string, { strand: Strand; label: string }>;

export type SkillId = keyof typeof SKILLS;
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

export const THEMES = ["minecraft", "astro-bot", "space", "lego", "robots", "animals", "nature", "everyday"] as const;
export type Theme = (typeof THEMES)[number];
/** His interest themes, rotated by the planner for generated units. */
export const INTEREST_THEMES = ["minecraft", "astro-bot", "space", "lego", "robots"] as const satisfies readonly Theme[];
