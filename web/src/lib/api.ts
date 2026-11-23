import type { ChildActivity, ChildUnit } from "@yav/shared";

export type { ChildActivity, ChildUnit };
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

export const api = {
  child: () => call<{ firstName: string | null; robot: RobotState; wallet: Wallet }>("GET", "/api/child"),
  setChild: (b: { firstName?: string; robotName?: string }) => call("POST", "/api/child", b),
  equip: (partId: string) => call<{ robot: RobotState }>("POST", "/api/robot/equip", { partId }),
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
    login: (pin: string) => call("POST", "/api/parent/login", { pin }),
    settings: () => call<Record<string, unknown>>("GET", "/api/parent/settings"),
    reviewQueue: () => call<{ id: string; created_at: string; review_status: string; parent_comment: string | null }[]>("GET", "/api/parent/review-queue"),
    questions: () => call<{ id: number; unit_id: string; question: string; reply: string; kind: string; flagged: number; created_at: string }[]>("GET", "/api/parent/questions"),
    responses: () => call<{ id: number; unit_id: string; activity_id: string | null; kind: string; text: string; talk_later: number; created_at: string }[]>("GET", "/api/parent/responses"),
    review: (id: string, status: "thumbs-up" | "redo", comment?: string) => call("POST", `/api/parent/uploads/${id}/review`, { status, comment }),
  },
};
