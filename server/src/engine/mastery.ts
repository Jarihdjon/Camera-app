/**
 * Per-skill mastery and difficulty stepping, from "The learning engine" in the build plan.
 * Pure functions so they are easy to test and tune.
 */

export interface SkillState {
  mastery: number; // 0..1
  difficulty: number; // 1..5
  streakCorrect: number;
  streakMissed: number;
  lastPractised: Date | null;
}

export const ENGINE = {
  /** Target success rate: the stretch zone. Tune with real data. */
  targetSuccess: 0.8,
  gainOnCorrect: 0.08,
  gainOnHintedCorrect: 0.04,
  lossOnMiss: 0.1,
  /** Mastery fades by this fraction per week without practice. */
  weeklyDecay: 0.05,
  stepUpAfter: 3,
  stepDownAfter: 2,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function decay(state: SkillState, now: Date): SkillState {
  if (!state.lastPractised) return state;
  const weeks = (now.getTime() - state.lastPractised.getTime()) / (7 * 24 * 3600 * 1000);
  if (weeks <= 0) return state;
  return { ...state, mastery: state.mastery * Math.pow(1 - ENGINE.weeklyDecay, weeks) };
}

export interface AttemptResult {
  correct: boolean;
  usedHint: boolean;
}

export function applyAttempt(state: SkillState, r: AttemptResult, now: Date): SkillState {
  const s = decay(state, now);
  let mastery = s.mastery;
  let { difficulty, streakCorrect, streakMissed } = s;

  if (r.correct) {
    mastery += r.usedHint ? ENGINE.gainOnHintedCorrect : ENGINE.gainOnCorrect;
    streakCorrect += 1;
    streakMissed = 0;
    if (streakCorrect >= ENGINE.stepUpAfter) {
      difficulty += 1;
      streakCorrect = 0;
    }
  } else {
    mastery -= ENGINE.lossOnMiss;
    streakMissed += 1;
    streakCorrect = 0;
    if (streakMissed >= ENGINE.stepDownAfter) {
      difficulty -= 1;
      streakMissed = 0;
    }
  }

  return {
    mastery: clamp(mastery, 0, 1),
    difficulty: clamp(difficulty, 1, 5),
    streakCorrect,
    streakMissed,
    lastPractised: now,
  };
}

/** After two misses the engine steps down and offers a hint on the next item. */
export function shouldOfferHint(state: SkillState): boolean {
  return state.streakMissed >= 1;
}
