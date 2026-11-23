/**
 * Turns spoken words into mouth movements. The iPad's speech engine fires a
 * "boundary" event at the start of each word; we open and close the mouth
 * roughly once per syllable for that word.
 */
export interface MouthKeyframe {
  at: number; // ms from the start of the word
  open: number; // 0 closed .. 1 wide open
}

export const SYLLABLE_MS = 150;

/** Rough syllable count: vowel groups, at least one. */
export function syllables(word: string): number {
  const groups = word.toLowerCase().replace(/[^a-z]/g, "").replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

export function mouthTimeline(word: string): MouthKeyframe[] {
  const n = syllables(word);
  const frames: MouthKeyframe[] = [];
  for (let i = 0; i < n; i++) {
    const t = i * SYLLABLE_MS;
    // Alternate wide and medium so speech doesn't look mechanical.
    frames.push({ at: t, open: i % 2 === 0 ? 0.9 : 0.6 });
    frames.push({ at: t + SYLLABLE_MS * 0.6, open: 0.15 });
  }
  frames.push({ at: n * SYLLABLE_MS, open: 0 });
  return frames;
}

/** Pulls the word that starts at charIndex out of the utterance text. */
export function wordAt(text: string, charIndex: number, charLength?: number): string {
  if (charLength) return text.slice(charIndex, charIndex + charLength);
  return text.slice(charIndex).match(/^[\w'-]+/)?.[0] ?? "";
}
