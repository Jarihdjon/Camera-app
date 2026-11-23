/** What the hub and chapter map receive. Free of dependencies so the iPad app can import it cheaply. */
export type StageStatus = "locked" | "open" | "done";

export interface StageView {
  id: string;
  kind: "story" | "review" | "challenge";
  title: string;
  status: StageStatus;
  stars: number;
}

export interface ChapterView {
  id: string;
  number: number;
  title: string;
  emoji: string;
  color: string;
  planet: [string, string];
  ring: boolean;
  status: StageStatus;
  stars: number;
  maxStars: number;
  stages: StageView[];
}

export interface ResumeView {
  chapterId: string;
  stageId: string;
  title: string;
  label: string;
}

export interface HubView {
  chapters: ChapterView[];
  resume: ResumeView | null;
  /** True while Claude is writing the next planet. */
  nextChapterComing: boolean;
}

export interface StageCompleteResult {
  stars: number;
  newStars: number;
  minutesEarned: number;
  unlockedStage: string | null;
  unlockedChapter: { id: string; title: string } | null;
}

/** Per-strand difficulty (1 to 5), so the iPad can add support or a stretch. */
export type Levels = Record<"reading" | "writing" | "maths" | "inquiry", number>;
