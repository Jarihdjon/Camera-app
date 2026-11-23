import type { Strand, Theme } from "@yav/shared";
import { INTEREST_THEMES } from "@yav/shared";

/**
 * Chooses the shape of the next unit. Rules from the build plan, in priority order:
 * 1. Due reviews first.  2. Weakest strand gets a slot, strongest gets a challenge slot.
 * 3. (difficulty stepping lives in mastery.ts)  4. Never the same format twice in a row.
 * 5. Rotate themes.  6. Parent pins win ties.
 */

export interface StrandSummary {
  strand: Strand;
  mastery: number; // mean of the strand's skills
}

export interface PickInput {
  strands: StrandSummary[];
  dueReviewSkills: string[];
  pinnedSkills: string[];
  lastFormat: string | null;
  recentThemes: Theme[]; // most recent first
}

export interface UnitPlan {
  focusStrand: Strand;
  challengeStrand: Strand;
  reviewSkills: string[];
  pinnedSkills: string[];
  theme: Theme;
  avoidFormat: string | null;
}

export function planNextUnit(input: PickInput): UnitPlan {
  if (input.strands.length === 0) throw new Error("No strands to plan from");
  const sorted = [...input.strands].sort((a, b) => a.mastery - b.mastery);
  const weakest = sorted[0]!.strand;
  const strongest = sorted[sorted.length - 1]!.strand;
  return {
    focusStrand: weakest,
    challengeStrand: strongest,
    reviewSkills: input.dueReviewSkills.slice(0, 3),
    pinnedSkills: input.pinnedSkills,
    theme: nextTheme(input.recentThemes),
    avoidFormat: input.lastFormat,
  };
}

/** The theme used least recently, so none wears out. */
export function nextTheme(recent: Theme[]): Theme {
  const unused = INTEREST_THEMES.filter((t) => !recent.includes(t));
  if (unused.length > 0) return unused[0]!;
  return [...recent].reverse()[0] ?? INTEREST_THEMES[0];
}
