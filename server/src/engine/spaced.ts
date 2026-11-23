/** Spaced repetition at 1, 3, 7 and 14 days for words and weak skills. */
export const REVIEW_DAYS = [1, 3, 7, 14] as const;

export interface ReviewState {
  step: number; // index into REVIEW_DAYS; past the end means retired
  dueAt: Date | null;
}

const DAY = 24 * 3600 * 1000;

export function scheduleReview(state: ReviewState, remembered: boolean, now: Date): ReviewState {
  // A miss sends the item back to the start; nothing is lost, it just comes back sooner.
  const step = remembered ? state.step + 1 : 0;
  const days = REVIEW_DAYS[step];
  return { step, dueAt: days === undefined ? null : new Date(now.getTime() + days * DAY) };
}

export function firstReview(now: Date): ReviewState {
  return { step: 0, dueAt: new Date(now.getTime() + REVIEW_DAYS[0] * DAY) };
}

export function isDue(state: ReviewState, now: Date): boolean {
  return state.dueAt !== null && state.dueAt.getTime() <= now.getTime();
}
