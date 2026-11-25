import type { ChildActivity, ChildUnit } from "@yav/shared";
import type { ChapterView, HubView, Levels, StageCompleteResult } from "@yav/shared/chapterView";
import type { GameState, GateQuestion, GateResult, PackView, Perk } from "@yav/shared/game";

export type { ChildActivity, ChildUnit, ChapterView, HubView, Levels, StageCompleteResult };
export type StagePart = "read" | "think" | "create";
export type StageOpen = { kind: "story" | "review" | "challenge"; part: StagePart | null; tier: number; progressId: string; chapter: { id: string; title: string; color: string }; unit: ChildUnit; progress: { step: number; state: Record<string, unknown> } | null; levels: Levels };
export type RobotState = { name: string | null; parts: string[]; unlocked: string[]; gemsEarned: number };
export type Wallet = { minutes: number; blocks: number; gems: number };
export type Reveal = { text?: string; correctIndex?: number } | null;
export type AskReply = { kind: "answer" | "word" | "off-topic" | "grown-up" | "offline" | "limit"; reply: string };

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body instanceof FormData || body === undefined ? undefined : { "content-type": "application/json" },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json() as Promise<T>;
}

export type ArcadeCategory = "numbers" | "words" | "puzzles" | "science";
export type ArcadeGame = { id: string; kind: "embed" | "h5p"; title: string; category: ArcadeCategory; url: string | null; folder: string | null; plays: number; best: number | null; rewardedToday: boolean };
export type ArcadeFinish = { gems: number; minutes: number; reason: "score" | "finished" | "too-quick" | "already-today"; wallet: { gems: number } };
export type ParentArcade = {
  games: (ArcadeGame & { skill: string | null; hidden: number; sort: number })[];
  hosts: string[];
  messages: { game_id: string; title: string; origin: string; data: string; created_at: string }[];
  skills: string[];
};

export const api = {
  arcade: {
    list: () => call<ArcadeGame[]>("GET", "/api/arcade"),
    start: (id: string) => call<{ playId: string }>("POST", `/api/arcade/${encodeURIComponent(id)}/start`, {}),
    finish: (playId: string, result: { score?: number; max?: number } = {}) => call<ArcadeFinish>("POST", `/api/arcade/play/${encodeURIComponent(playId)}/finish`, result),
    message: (id: string, origin: string, data: string) => call("POST", `/api/arcade/${encodeURIComponent(id)}/message`, { origin, data }),
  },
  child: () => call<{ firstName: string | null; robot: RobotState; wallet: Wallet }>("GET", "/api/child"),
  setChild: (b: { firstName?: string; robotName?: string }) => call("POST", "/api/child", b),
  equip: (partId: string) => call<{ robot: RobotState }>("POST", "/api/robot/equip", { partId }),
  game: {
    state: () => call<GameState>("GET", "/api/game/state"),
    start: (levelId: string) => call<{ runId: string; checkpoint: number; gems: string[]; eggs: string[]; realm: string; pack: PackView }>("POST", `/api/game/level/${encodeURIComponent(levelId)}/start`, {}),
    gate: (runId: string, gate: number) => call<GateQuestion>("POST", "/api/game/gate", { runId, gate }),
    answer: (questionId: string, answer: string | number) => call<GateResult & { wallet: Wallet }>("POST", "/api/game/answer", { questionId, answer }),
    collect: (levelId: string, kind: "gem" | "egg", id: string) =>
      call<{ perk: Perk | null; state: GameState["perks"]; wallet: Wallet }>("POST", "/api/game/collect", { levelId, kind, id }),
    finish: (runId: string) => call<{ minutesEarned: number; bonusGems: number; wallet: Wallet }>("POST", "/api/game/finish", { runId }),
  },
  hub: () => call<HubView>("GET", "/api/hub"),
  stage: (chapterId: string, stageId: string) => call<StageOpen>("GET", `/api/stage/${encodeURIComponent(chapterId)}/${encodeURIComponent(stageId)}`),
  saveProgress: (unitId: string, b: { chapterId?: string; stageId?: string; step: number; state: Record<string, unknown>; label?: string }) =>
    call<{ ok: boolean }>("PUT", `/api/unit/${encodeURIComponent(unitId)}/progress`, b),
  completeStage: (chapterId: string, stageId: string, m: { secondTries: number; wordsHunted: number; asked: number }) =>
    call<StageCompleteResult & { wallet: Wallet }>("POST", `/api/stage/${encodeURIComponent(chapterId)}/${encodeURIComponent(stageId)}/complete`, m),
  units: () => call<{ id: string; title: string; theme: string; color: string | null; pypTheme: string | null; done: boolean }[]>("GET", "/api/units"),
  unit: (id: string) => call<ChildUnit>("GET", `/api/unit/${encodeURIComponent(id)}`),
  today: () => call<{ units: ChildUnit[]; wallet: Wallet }>("GET", "/api/session/today"),
  attempt: (b: { unitId: string; activityId: string; answer: string | number; usedHint?: boolean; msTaken?: number; tryNumber?: number; blank?: number }) =>
    call<{ correct: boolean; hint: string | null; reveal: Reveal; wallet: Wallet }>("POST", "/api/attempt", b),
  respond: (b: { unitId: string; activityId?: string; kind: "open" | "tune-in" | "reflect" | "self-check"; text: string; talkLater?: boolean }) =>
    call<{ model: string | null; wallet: Wallet }>("POST", "/api/respond", b),
  ask: (b: { unitId: string; activityId?: string; question: string; word?: { word: string; sentence: string } }) => call<AskReply>("POST", "/api/ask", b),
  tapWord: (word: string, meaning?: string) => call<{ wallet: Wallet }>("POST", "/api/word-tap", { word, meaning }),
  completeUnit: (id: string) => call<{ minutesEarned: number; capReached: boolean; wallet: Wallet }>("POST", `/api/unit/${encodeURIComponent(id)}/complete`),
  upload: (file: Blob, activityId: string) => {
    const fd = new FormData();
    fd.append("activityId", activityId);
    fd.append("photo", file, "page.jpg");
    return call<{ id: string; unlocked: boolean }>("POST", "/api/uploads", fd);
  },
  parent: {
    arcade: {
      get: () => call<ParentArcade>("GET", "/api/parent/arcade"),
      addLink: (b: { link: string; title: string; category: ArcadeCategory; skill?: string | null }) => call<{ id: string }>("POST", "/api/parent/arcade", b),
      addH5p: (form: FormData) => call<{ id: string; title: string; missing: string[] }>("POST", "/api/parent/arcade/h5p", form),
      update: (id: string, b: { title?: string; category?: ArcadeCategory; skill?: string | null; hidden?: boolean; sort?: number }) => call("PATCH", `/api/parent/arcade/${encodeURIComponent(id)}`, b),
      remove: (id: string) => call("DELETE", `/api/parent/arcade/${encodeURIComponent(id)}`),
      setHosts: (hosts: string[]) => call<{ hosts: string[] }>("PUT", "/api/parent/arcade/hosts", { hosts }),
    },
    login: (pin: string) => call("POST", "/api/parent/login", { pin }),
    settings: () => call<Record<string, unknown>>("GET", "/api/parent/settings"),
    reviewQueue: () => call<{ id: string; created_at: string; review_status: string; parent_comment: string | null }[]>("GET", "/api/parent/review-queue"),
    questions: () => call<{ id: number; unit_id: string; question: string; reply: string; kind: string; flagged: number; created_at: string }[]>("GET", "/api/parent/questions"),
    responses: () => call<{ id: number; unit_id: string; activity_id: string | null; kind: string; text: string; talk_later: number; created_at: string }[]>("GET", "/api/parent/responses"),
    progress: () => call<ParentProgress>("GET", "/api/parent/progress"),
    unlock: (chapterId: string, stageId: string) => call("POST", "/api/parent/unlock", { chapterId, stageId }),
    retireChapter: (id: string) => call("POST", `/api/parent/chapters/${encodeURIComponent(id)}/retire`),
    review: (id: string, status: "thumbs-up" | "redo", comment?: string) => call("POST", `/api/parent/uploads/${id}/review`, { status, comment }),
  },
};

export interface ParentProgress {
  strands: { strand: string; mastery: number; level: number }[];
  skills: { id: string; strand: string; label: string; mastery: number; difficulty: number; attempts: number }[];
  weakest: string;
  strongest: string;
  wordsLearned: number;
  dueWords: number;
  dueItems: number;
  stars: number;
  chapters: ChapterView[];
  generating: boolean;
  lastGeneration: { created_at: string; valid: number; error: string | null } | null;
  generatedChapters: { id: string; title: string; status: string }[];
}
