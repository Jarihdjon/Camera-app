import { rng, type Band } from "@yav/shared/game";
import type { Pack } from "@yav/shared";

/**
 * Endless fresh questions for the Number, Puzzle and Write gates. Seeded, so the same
 * seed gives the same question, and answers are computed, never guessed.
 */
export interface Generated {
  key: string;
  kind: "number" | "choice" | "tiles" | "letters";
  prompt: string;
  say?: string;
  unit?: string;
  options?: string[];
  tiles?: string[];
  letters?: string[];
  length?: number;
  /** For choice: the index as a string. Number: the value. Tiles/letters: the exact text. */
  answer: string;
  answerText: string;
  skill: string;
}

const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
function shuffle<T>(a: T[], r: () => number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j]!, b[i]!];
  }
  return b;
}

export function numberQuestion(band: Band, pack: Pack, seed: string): Generated {
  const r = rng(seed);
  const t = pack.things[int(r, 0, pack.things.length - 1)]!;
  const t2 = pack.things[int(r, 0, pack.things.length - 1)]!;
  let prompt: string;
  let answer: number;
  let skill = "maths.word-problems";
  const style = int(r, 0, 2);
  if (band === 1) {
    if (style === 0) {
      const a = int(r, 3, 10), b = int(r, 2, 9);
      prompt = `There are ${a} ${t.many}. ${b} more come along. How many ${t.many} are there now?`;
      answer = a + b;
    } else if (style === 1) {
      const a = int(r, 8, 18), b = int(r, 2, Math.min(9, a - 1));
      prompt = `Sparky has ${a} ${t.many}. He gives ${b} away. How many are left?`;
      answer = a - b;
    } else {
      const n = int(r, 2, 5), k = [2, 5, 10][int(r, 0, 2)]!;
      prompt = `There are ${n} groups with ${k} ${t.many} in each. How many ${t.many} altogether?`;
      answer = n * k;
      skill = "maths.times-tables";
    }
  } else if (band === 2) {
    if (style === 0) {
      const a = int(r, 21, 68), b = int(r, 11, 29);
      prompt = `${a} ${t.many} are here and ${b} more arrive. How many is that?`;
      answer = a + b;
    } else if (style === 1) {
      const a = int(r, 40, 95), b = int(r, 12, a - 10);
      prompt = `There were ${a} ${t.many}. ${b} went away. How many are left?`;
      answer = a - b;
      skill = "maths.add-subtract";
    } else {
      const n = int(r, 3, 6), k = int(r, 3, 6);
      prompt = `${n} boxes each hold ${k} ${t.many}. How many ${t.many} in total?`;
      answer = n * k;
      skill = "maths.times-tables";
    }
  } else {
    if (style === 0) {
      const n = int(r, 4, 9), k = int(r, 6, 9);
      prompt = `${n} rows of ${t.many}, with ${k} in each row. How many altogether?`;
      answer = n * k;
      skill = "maths.times-tables";
    } else if (style === 1) {
      const n = int(r, 3, 6), k = int(r, 3, 8), extra = int(r, 4, 15);
      prompt = `There are ${n} groups of ${k} ${t.many}, and then ${extra} ${t2.many} too. How many things altogether?`;
      answer = n * k + extra;
    } else {
      const total = int(r, 6, 10) * int(r, 3, 6);
      const each = [3, 4, 5, 6].find((d) => total % d === 0) ?? 2;
      prompt = `${total} ${t.many} are shared equally into groups of ${each}. How many groups?`;
      answer = total / each;
      skill = "maths.times-tables";
    }
  }
  return { key: `num:${prompt}`, kind: "number", prompt, unit: undefined, answer: String(answer), answerText: String(answer), skill };
}

const SHAPES = ["🔴", "🔵", "🟡", "🟢", "⭐", "🔺", "🟣"];

export function puzzleQuestion(band: Band, seed: string): Generated {
  const r = rng(seed);
  const shapeStyle = band === 1 && r() < 0.5;
  if (shapeStyle) {
    // Repeating patterns: AB, AAB, ABC.
    const pats = [[0, 1], [0, 0, 1], [0, 1, 2], [0, 1, 1]];
    const pat = pats[int(r, 0, pats.length - 1)]!;
    const shapes = shuffle(SHAPES, r).slice(0, 3);
    const seq = Array.from({ length: pat.length * 2 + 1 }, (_, i) => shapes[pat[i % pat.length]!]!);
    const next = shapes[pat[seq.length % pat.length]!]!;
    const options = shuffle([next, ...shapes.filter((s) => s !== next).slice(0, 2)], r);
    return { key: `pat:${seq.join("")}`, kind: "choice", prompt: `What comes next? ${seq.join(" ")} …`, options, answer: String(options.indexOf(next)), answerText: next, skill: "maths.patterns" };
  }
  // Build five terms from one rule; show four and ask for the fifth.
  let terms: number[];
  if (band === 1) {
    const step = [1, 2, 5, 10][int(r, 0, 3)]!;
    const start = int(r, 0, 10) * step;
    terms = [0, 1, 2, 3, 4].map((i) => start + i * step);
  } else if (band === 2) {
    const step = [3, 4, -2, -5, 10][int(r, 0, 4)]!;
    const start = step < 0 ? int(r, 30, 60) : int(r, 1, 20);
    terms = [0, 1, 2, 3, 4].map((i) => start + i * step);
  } else {
    const kind = int(r, 0, 2);
    const start = kind === 0 ? int(r, 1, 4) : int(r, 1, 10);
    if (kind === 0) terms = [0, 1, 2, 3, 4].map((i) => start * 2 ** i);
    else if (kind === 1) {
      terms = [start];
      for (let i = 1; i < 5; i++) terms.push(terms[i - 1]! + (i % 2 ? 2 : 3));
    } else {
      const step = int(r, 6, 9);
      terms = [0, 1, 2, 3, 4].map((i) => step + i * step);
    }
  }
  const seq = terms.slice(0, 4);
  const next = terms[4]!;
  const diff = seq[3]! - seq[2]!;
  const wrong = [next + 1, next - 1, next + diff, seq[3]!].filter((w) => w !== next && w >= 0);
  const options = shuffle([String(next), ...shuffle([...new Set(wrong)], r).slice(0, 2).map(String)], r);
  return { key: `seq:${seq.join(",")}`, kind: "choice", prompt: `What number comes next? ${seq.join(", ")}, …`, options, answer: String(options.indexOf(String(next))), answerText: String(next), skill: "maths.patterns" };
}

export function spellingQuestion(band: Band, pack: Pack, seed: string): Generated {
  const r = rng(seed);
  const maxLen = band === 1 ? 4 : band === 2 ? 6 : 99;
  const minLen = band === 3 ? 5 : 0;
  const words = pack.spelling.filter((w) => w.length <= maxLen && w.length >= minLen);
  const word = (words.length ? words : pack.spelling)[int(r, 0, (words.length || pack.spelling.length) - 1)]!;
  const decoys = band === 1 ? [] : shuffle("aeioustrnl".split("").filter((c) => !word.includes(c)), r).slice(0, 2);
  return {
    key: `spell:${word}`,
    kind: "letters",
    prompt: "Listen, then spell the word with the letter tiles.",
    say: `Spell the word: ${word}.`,
    letters: shuffle([...word.split(""), ...decoys], r),
    length: word.length,
    answer: word,
    answerText: word,
    skill: "writing.spelling",
  };
}

export function sentenceQuestion(band: Band, pack: Pack, seed: string): Generated {
  const r = rng(seed);
  const pool = pack.sentences.filter((s) => s.band === band);
  const s = (pool.length ? pool : pack.sentences)[int(r, 0, (pool.length || pack.sentences.length) - 1)]!;
  const clean = s.text.replace(/[.!?]$/, "");
  const words = clean.split(/\s+/);
  let tiles = shuffle(words, r);
  if (tiles.join(" ") === words.join(" ")) tiles = [...words].reverse();
  return {
    key: `sent:${clean}`,
    kind: "tiles",
    prompt: "Put the word tiles in order to make the sentence.",
    say: s.text,
    tiles,
    answer: clean,
    answerText: s.text,
    skill: "writing.sentence-building",
  };
}

/** Pack questions (listen, read, word, science) with the options shuffled for variety. */
export function fromPack(q: Pack["questions"]["read"][number], seed: string): Generated {
  const r = rng(seed);
  const order = shuffle([0, 1, 2], r);
  const options = order.map((i) => q.options[i]!);
  return {
    key: `pack:${q.id}`,
    kind: "choice",
    prompt: q.prompt,
    say: q.say,
    options,
    answer: String(order.indexOf(q.correct)),
    answerText: q.options[q.correct]!,
    skill: "",
  };
}
