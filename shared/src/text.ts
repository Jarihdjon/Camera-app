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

export interface Chunk {
  text: string;
  /** Pause after this chunk, in milliseconds. */
  pause: number;
}

/**
 * Split text into sentence-sized pieces with natural pauses: about a third of a second
 * after a sentence, longer after a paragraph or a "...", and a beat after a question.
 */
export function splitForSpeech(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  paras.forEach((para, pi) => {
    // " ... " marks a deliberate pause (e.g. between a listening sentence and its question).
    const parts = para.split(/\s*\.\.\.\s*/).filter(Boolean);
    parts.forEach((part, ki) => {
      const sentences = part.match(/[^.!?]+(?:[.!?]+["”’']?|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [part];
      sentences.forEach((s, si) => {
        const lastInPart = si === sentences.length - 1;
        const lastInPara = lastInPart && ki === parts.length - 1;
        let pause = /\?["”’']?$/.test(s) ? 450 : /!["”’']?$/.test(s) ? 380 : 320;
        if (lastInPart && !lastInPara) pause = 700;
        if (lastInPara && pi < paras.length - 1) pause = 800;
        if (lastInPara && pi === paras.length - 1) pause = 0;
        chunks.push({ text: s, pause });
      });
    });
  });
  return chunks;
}

