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
    app = await buildApp({ db, bank, serveWeb: false, askModel: null });
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
    expect(text).not.toContain("\"model\"");
    expect(text).not.toContain("\"working\"");
    expect(text).not.toContain("\"answer\"");
  });

  it("checks a maths answer on the server and rewards blocks", async () => {
    const res = await app.inject({ method: "POST", url: "/api/attempt", payload: { unitId: bank[0]!.id, activityId: "b001-warmup", answer: "24", msTaken: 5000 } });
    expect(res.json()).toMatchObject({ correct: true, wallet: { blocks: 2 } });
  });

  it("marks gap fill per blank and reveals answers only after two tries", async () => {
    const gaps = { unitId: "bank-002-the-lost-lunchbox", activityId: "b002-gaps" };
    expect((await app.inject({ method: "POST", url: "/api/attempt", payload: { ...gaps, blank: 1, answer: "shelf" } })).json().correct).toBe(true);
    const q = { unitId: "bank-002-the-lost-lunchbox", activityId: "b002-q3" };
    const first = (await app.inject({ method: "POST", url: "/api/attempt", payload: { ...q, answer: "the bin", tryNumber: 1 } })).json();
    expect(first).toMatchObject({ correct: false, reveal: null });
    const second = (await app.inject({ method: "POST", url: "/api/attempt", payload: { ...q, answer: "the bin", tryNumber: 2 } })).json();
    expect(second.reveal.text).toBe("behind the door");
  });

  it("saves open answers and returns a model idea", async () => {
    const r = await app.inject({ method: "POST", url: "/api/respond", payload: { unitId: "bank-002-the-lost-lunchbox", activityId: "b002-q7", kind: "open", text: "they bought them at the same shop" } });
    expect(r.json().model).toContain("same shop");
  });

  it("word taps always earn a gem", async () => {
    const res = await app.inject({ method: "POST", url: "/api/word-tap", payload: { word: "Fragile" } });
    expect(res.json().wallet.gems).toBe(1);
  });

  it("unlocks robot parts from gems ever earned, and only equips unlocked ones", async () => {
    const locked = await app.inject({ method: "POST", url: "/api/robot/equip", payload: { partId: "boots-wheels" } });
    expect(locked.statusCode).toBe(403);
    db.prepare("INSERT INTO wallet_entry (currency, amount, reason) VALUES ('gems', 12, 'test')").run();
    const ok = await app.inject({ method: "POST", url: "/api/robot/equip", payload: { partId: "cape-stars" } });
    expect(ok.json().robot.parts).toEqual(["cape-stars"]);
    // Spending gems later never re-locks a part.
    db.prepare("INSERT INTO wallet_entry (currency, amount, reason) VALUES ('gems', -12, 'spent')").run();
    const child = await app.inject({ method: "GET", url: "/api/child" });
    expect(child.json().robot.unlocked).toContain("cape-stars");
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
