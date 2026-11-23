import type { Activity, Inquiry, Passage, Unit } from "./schemas.js";

/**
 * What the iPad is allowed to see. Answer keys, model answers and worked solutions
 * stay on the PC; the server reveals them only after he gets it or has had two tries.
 */
type Common = { id: string; skill: string; difficulty: number };
export type ChildActivity =
  | (Common & { kind: "short-answer"; prompt: string; hint: string; para?: number })
  | (Common & { kind: "multiple-choice"; prompt: string; options: string[]; hint: string; para?: number })
  | (Common & { kind: "word-meaning"; word: string; options: string[]; hint: string })
  | (Common & { kind: "maths"; prompt: string; unit?: string; hint: string })
  | (Common & { kind: "open"; prompt: string })
  | (Common & { kind: "gap-fill"; prompt: string; sentences: { text: string }[]; bank: string[] })
  | Extract<Activity, { kind: "writing" }>;

export interface ChildUnit {
  id: string;
  title: string;
  theme: string;
  color?: string;
  inquiry?: Inquiry;
  warmup?: ChildActivity;
  passage?: Passage;
  vocab: ChildActivity[];
  questions: ChildActivity[];
  gapFill?: ChildActivity;
  corner: ChildActivity[];
  writing?: Extract<Activity, { kind: "writing" }>;
}

/** Stable shuffle so the word bank order is the same every time, but not answer order. */
function shuffle<T>(items: T[], seed: string): T[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function toChildActivity(a: Activity): ChildActivity {
  const common = { id: a.id, skill: a.skill, difficulty: a.difficulty };
  switch (a.kind) {
    case "short-answer":
      return { ...common, kind: a.kind, prompt: a.prompt, hint: a.hint, para: a.para };
    case "multiple-choice":
      return { ...common, kind: a.kind, prompt: a.prompt, options: a.options, hint: a.hint, para: a.para };
    case "word-meaning":
      return { ...common, kind: a.kind, word: a.word, options: a.options, hint: a.hint };
    case "maths":
      return { ...common, kind: a.kind, prompt: a.prompt, unit: a.unit, hint: a.hint };
    case "open":
      return { ...common, kind: a.kind, prompt: a.prompt };
    case "gap-fill":
      return {
        ...common,
        kind: a.kind,
        prompt: a.prompt,
        sentences: a.sentences.map((s) => ({ text: s.text })),
        bank: shuffle([...a.sentences.map((s) => s.answer), ...a.decoys], a.id),
      };
    case "writing":
      return a;
  }
}

export function toChildUnit(u: Unit): ChildUnit {
  return {
    id: u.id,
    title: u.title,
    theme: u.theme,
    color: u.color,
    inquiry: u.inquiry,
    warmup: u.warmup && toChildActivity(u.warmup),
    passage: u.passage,
    vocab: u.vocab.map(toChildActivity),
    questions: u.questions.map(toChildActivity),
    gapFill: u.gapFill && toChildActivity(u.gapFill),
    corner: u.corner.map(toChildActivity),
    writing: u.writing,
  };
}
