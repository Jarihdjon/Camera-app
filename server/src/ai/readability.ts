import { paragraphs, type Unit } from "@yav/shared";
import { checkKeywords, tokens } from "../engine/answers.js";

/**
 * Quality checks for units Claude writes, on top of the schema. Each returns a list of
 * problems; an empty list means the unit can go to Yav.
 */
export function readability(text: string) {
  const sentences = text.split(/[.!?]+["”]?\s+|[.!?]+["”]?$/).map((s) => s.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  const long = words.filter((w) => w.replace(/[^a-z]/gi, "").length >= 10);
  return {
    sentences: sentences.length,
    words: words.length,
    avgSentence: words.length / Math.max(1, sentences.length),
    longWordRate: long.length / Math.max(1, words.length),
  };
}

/**
 * Year 2 band, set from the Inquirer's Journal itself (its stories average 14 to 19 words a
 * sentence and he reads chapter books). The prompt asks for shorter sentences than this.
 */
export const BAND = { maxAvgSentence: 20, maxLongWordRate: 0.06 };

/** A word (or every word of a phrase like "relied on") appears in the text, allowing endings like -ed, -ing, -s. */
function appears(word: string, text: string): boolean {
  const T = tokens(text);
  return tokens(word).every((w) => {
    const stem = w.length > 5 ? w.slice(0, -2) : w;
    return T.some((t) => t === w || t.startsWith(stem));
  });
}

export function qualityProblems(unit: Unit, band = BAND): string[] {
  const problems: string[] = [];
  if (!unit.passage) return ["no story"];
  if (!unit.writing) problems.push("no writing task");
  if (!unit.inquiry) problems.push("no inquiry block");
  const paras = paragraphs(unit.passage.text);
  if (paras.length < 2) problems.push("story needs paragraphs separated by blank lines");

  const r = readability(unit.passage.text);
  if (r.avgSentence > band.maxAvgSentence) problems.push(`sentences too long (${r.avgSentence.toFixed(1)} words on average)`);
  if (r.longWordRate > band.maxLongWordRate) problems.push(`too many long words (${Math.round(r.longWordRate * 100)}%)`);

  for (const g of unit.passage.glossary) if (!appears(g.word, unit.passage.text)) problems.push(`glossary word "${g.word}" is not in the story`);
  for (const v of unit.vocab) if (!appears(v.word, unit.passage.text)) problems.push(`word detective "${v.word}" is not in the story`);

  for (const q of unit.questions) {
    if (q.kind !== "short-answer") continue;
    if (q.para === undefined) {
      problems.push(`${q.id}: needs a paragraph pointer`);
      continue;
    }
    const p = paras[q.para];
    if (!p || !checkKeywords(p, q.accept, q.groups?.length ? q.groups : undefined)) problems.push(`${q.id}: answer is not in paragraph ${q.para + 1}`);
  }
  return problems;
}
