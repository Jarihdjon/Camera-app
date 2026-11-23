import type { Unit } from "@yav/shared";

export type Wallet = { minutes: number; blocks: number; gems: number };

/** Units as the iPad sees them: answer keys stripped by the server. */
export type ChildUnit = Omit<Unit, "warmup" | "questions"> & {
  warmup: ChildActivity;
  questions: ChildActivity[];
};
export type ChildActivity =
  | { id: string; kind: "short-answer"; skill: string; difficulty: number; prompt: string; hint: string }
  | { id: string; kind: "multiple-choice"; skill: string; difficulty: number; prompt: string; options: string[]; hint: string }
  | { id: string; kind: "maths"; skill: string; difficulty: number; prompt: string; hint: string }
  | Unit["writing"];

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
  child: () => call<{ firstName: string | null; robot: { name: string | null; parts: string[] }; wallet: Wallet }>("GET", "/api/child"),
  setChild: (b: { firstName?: string; robotName?: string }) => call("POST", "/api/child", b),
  today: () => call<{ units: ChildUnit[]; wallet: Wallet }>("GET", "/api/session/today"),
  attempt: (b: { unitId: string; activityId: string; answer: string | number; usedHint: boolean; msTaken: number }) =>
    call<{ correct: boolean; hint: string | null; wallet: Wallet }>("POST", "/api/attempt", b),
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
    review: (id: string, status: "thumbs-up" | "redo", comment?: string) => call("POST", `/api/parent/uploads/${id}/review`, { status, comment }),
  },
};
