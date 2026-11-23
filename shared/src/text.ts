/** Story paragraphs, split on blank lines. Kept free of dependencies so the iPad app can use it cheaply. */
export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

/** The self-check statements at the end of every unit. */
export const SELF_CHECK_ITEMS = [
  "I read the story carefully before answering.",
  "I used clues from the story, not just guesses.",
  "I tried my best on the tricky parts.",
] as const;
