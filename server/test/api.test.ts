import { describe, expect, it, beforeAll } from "vitest";
import { openDb } from "../src/db/db.js";
import { setSetting } from "../src/db/settings.js";
import { hashPin } from "../src/auth.js";
import { loadContentBank } from "../src/content.js";
import { buildApp } from "../src/app.js";

describe("api", () => {
  const db = openDb(":memory:");
  const bank = loadContentBank();
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    setSetting(db, "parentPinHash", hashPin("2468"));
    app = await buildApp({ db, bank, serveWeb: false });
  });

  it("content bank validates", () => {
    expect(bank.length).toBeGreaterThan(0);
  });

  it("never sends answer keys to the iPad", async () => {
    const res = await app.inject({ method: "GET", url: "/api/session/today" });
    const text = res.body;
    expect(text).not.toContain("correctIndex");
    expect(text).not.toContain("\"accept\"");
    expect(text).not.toContain("expression");
  });

  it("checks a maths answer on the server and rewards blocks", async () => {
    const res = await app.inject({ method: "POST", url: "/api/attempt", payload: { unitId: bank[0]!.id, activityId: "b001-warmup", answer: "24", msTaken: 5000 } });
    expect(res.json()).toMatchObject({ correct: true, wallet: { blocks: 2 } });
  });

  it("word taps always earn a gem", async () => {
    const res = await app.inject({ method: "POST", url: "/api/word-tap", payload: { word: "Fragile" } });
    expect(res.json().wallet.gems).toBe(1);
  });

  it("caps earned minutes per day", async () => {
    setSetting(db, "dailyUnitCap", 1);
    const a = await app.inject({ method: "POST", url: "/api/unit/u1/complete" });
    const b = await app.inject({ method: "POST", url: "/api/unit/u2/complete" });
    expect(a.json().minutesEarned).toBe(15);
    expect(b.json().minutesEarned).toBe(0);
  });

  it("keeps the parent area behind the PIN", async () => {
    expect((await app.inject({ method: "GET", url: "/api/parent/settings" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/parent/login", payload: { pin: "0000" } })).statusCode).toBe(401);
    const login = await app.inject({ method: "POST", url: "/api/parent/login", payload: { pin: "2468" } });
    const cookie = login.cookies.find((c) => c.name === "parent")!;
    const settings = await app.inject({ method: "GET", url: "/api/parent/settings", cookies: { parent: cookie.value } });
    expect(settings.statusCode).toBe(200);
    expect(settings.body).not.toContain("sk-ant");
  });
});
