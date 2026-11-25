import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { openDb } from "../src/db/db.js";
import { setSetting } from "../src/db/settings.js";
import { hashPin } from "../src/auth.js";
import { loadContentBank } from "../src/content.js";
import { buildApp } from "../src/app.js";
import { loadGameContent } from "../src/game/engine.js";
import { parseGameLink, safeEntry, unpackH5p } from "../src/arcade/arcade.js";

const HOSTS = ["educaplay.com", "wordwall.net"];

describe("game links", () => {
  it("takes the address out of an embed code, or uses a plain share link", () => {
    expect(parseGameLink('<iframe width="795" height="690" src="https://www.educaplay.com/game/123-sums.html" frameborder="0"></iframe>', HOSTS))
      .toEqual({ url: "https://www.educaplay.com/game/123-sums.html" });
    expect(parseGameLink("  https://wordwall.net/embed/abc?themeId=1&amp;templateId=2  ", HOSTS))
      .toEqual({ url: "https://wordwall.net/embed/abc?themeId=1&templateId=2" });
  });

  it("refuses insecure links, untrusted sites and nonsense", () => {
    expect(parseGameLink("http://wordwall.net/embed/abc", HOSTS)).toHaveProperty("error");
    expect(parseGameLink("https://evil.example.com/game", HOSTS)).toHaveProperty("error");
    expect(parseGameLink("https://wordwall.net.evil.com/x", HOSTS)).toHaveProperty("error");
    expect(parseGameLink("not a link", HOSTS)).toHaveProperty("error");
  });
});

const sampleH5p = (extra: Record<string, Uint8Array> = {}) => zipSync({
  "h5p.json": strToU8(JSON.stringify({ title: "Test Sums", mainLibrary: "H5P.SparkySums", preloadedDependencies: [{ machineName: "H5P.SparkySums", majorVersion: 1, minorVersion: 0 }] })),
  "content/content.json": strToU8("{}"),
  "H5P.SparkySums-1.0/library.json": strToU8("{}"),
  ...extra,
});

describe("H5P files", () => {
  it("unpacks a game and reports its title", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "h5p-"));
    expect(unpackH5p(sampleH5p(), dir)).toEqual({ title: "Test Sums", mainLibrary: "H5P.SparkySums", missing: [] });
    expect(existsSync(path.join(dir, "content", "content.json"))).toBe(true);
  });

  it("says which game-type libraries are missing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "h5p-"));
    const zip = zipSync({ "h5p.json": strToU8(JSON.stringify({ mainLibrary: "H5P.Memory", preloadedDependencies: [{ machineName: "H5P.MemoryGame", majorVersion: 1, minorVersion: 3 }] })) });
    expect(unpackH5p(zip, dir).missing).toEqual(["H5P.MemoryGame-1.3"]);
  });

  it("refuses files that would land outside the game's folder", () => {
    expect(safeEntry("../../evil.js")).toBeNull();
    expect(safeEntry("content/../../evil.js")).toBeNull();
    expect(safeEntry("/etc/passwd")).toBeNull();
    expect(safeEntry("C:/Windows/evil")).toBeNull();
    expect(safeEntry("content/content.json")).toBe("content/content.json");
    const dir = mkdtempSync(path.join(tmpdir(), "h5p-"));
    expect(() => unpackH5p(sampleH5p({ "../escape.txt": strToU8("x") }), dir)).toThrow(/unsafe/i);
    expect(existsSync(path.join(dir, "..", "escape.txt"))).toBe(false);
  });

  it("refuses a zip that isn't an H5P game", () => {
    expect(() => unpackH5p(zipSync({ "readme.txt": strToU8("hi") }), mkdtempSync(path.join(tmpdir(), "h5p-")))).toThrow(/h5p\.json/);
  });
});

describe("Arcade API", () => {
  const db = openDb(":memory:");
  const h5pRoot = mkdtempSync(path.join(tmpdir(), "h5proot-"));
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookie = "";
  beforeAll(async () => {
    setSetting(db, "parentPinHash", hashPin("2468"));
    app = await buildApp({ db, bank: loadContentBank(), serveWeb: false, askModel: null, gameContent: loadGameContent(), h5pRoot });
    const login = await app.inject({ method: "POST", url: "/api/parent/login", payload: { pin: "2468" } });
    cookie = String(login.headers["set-cookie"]).split(";")[0]!;
  });
  const post = (url: string, payload: Record<string, unknown> = {}) => app.inject({ method: "POST", url, payload });
  const age = (playId: string, seconds: number) => db.prepare("UPDATE arcade_play SET started_at = datetime('now', ?) WHERE id = ?").run(`-${seconds} seconds`, playId);

  it("starts with the built-in sample game, served from the PC", async () => {
    const shelf = (await app.inject({ method: "GET", url: "/api/arcade" })).json();
    expect(shelf).toEqual([expect.objectContaining({ id: "sample-number-sums", kind: "h5p", category: "numbers", plays: 0 })]);
    const file = await app.inject({ method: "GET", url: "/api/h5p-content/sample-number-sums/h5p.json" });
    expect(file.statusCode).toBe(200);
    expect(file.json().mainLibrary).toBe("H5P.SparkySums");
    expect((await app.inject({ method: "GET", url: "/api/h5p-player/frame.bundle.js" })).statusCode).toBe(200);
  });

  it("a score earns gems and minutes, counts towards the skill, and only rewards once a day", async () => {
    const before = (db.prepare("SELECT COUNT(*) AS n FROM attempt WHERE activity_id LIKE 'arcade:%'").get() as { n: number }).n;
    const { playId } = (await post("/api/arcade/sample-number-sums/start")).json();
    const r = (await post(`/api/arcade/play/${playId}/finish`, { score: 5, max: 6 })).json();
    expect(r).toMatchObject({ reason: "score", gems: 7 });
    expect(r.minutes).toBeGreaterThan(0);
    expect((db.prepare("SELECT COUNT(*) AS n FROM attempt WHERE activity_id LIKE 'arcade:%'").get() as { n: number }).n).toBe(before + 1);
    expect((await post(`/api/arcade/play/${playId}/finish`, { score: 6, max: 6 })).statusCode).toBe(409);
    const again = (await post("/api/arcade/sample-number-sums/start")).json();
    expect((await post(`/api/arcade/play/${again.playId}/finish`, { score: 6, max: 6 })).json()).toMatchObject({ reason: "already-today", gems: 0 });
    const shelf = (await app.inject({ method: "GET", url: "/api/arcade" })).json();
    expect(shelf[0]).toMatchObject({ plays: 2, best: 1, rewardedToday: true });
  });

  it("parent-only: adding games needs the PIN", async () => {
    expect((await post("/api/parent/arcade", { link: "https://wordwall.net/embed/x", title: "Pairs", category: "words" })).statusCode).toBe(401);
  });

  it("an online game: added by link, 'I finished!' only pays after two minutes, and messages are logged", async () => {
    const add = await app.inject({ method: "POST", url: "/api/parent/arcade", headers: { cookie }, payload: { link: '<iframe src="https://wordwall.net/embed/abc123"></iframe>', title: "Match the animals", category: "words" } });
    expect(add.statusCode).toBe(200);
    const id = add.json().id;
    const bad = await app.inject({ method: "POST", url: "/api/parent/arcade", headers: { cookie }, payload: { link: "https://random.example.org/game", title: "X", category: "words" } });
    expect(bad.statusCode).toBe(400);

    const quick = (await post(`/api/arcade/${id}/start`)).json();
    expect((await post(`/api/arcade/play/${quick.playId}/finish`)).json()).toMatchObject({ reason: "too-quick", gems: 0 });
    const real = (await post(`/api/arcade/${id}/start`)).json();
    age(real.playId, 150);
    expect((await post(`/api/arcade/play/${real.playId}/finish`)).json()).toMatchObject({ reason: "finished", gems: 2, minutes: 0 });

    await post(`/api/arcade/${id}/message`, { origin: "https://wordwall.net", data: '{"event":"done"}' });
    const parent = (await app.inject({ method: "GET", url: "/api/parent/arcade", headers: { cookie } })).json();
    expect(parent.messages[0]).toMatchObject({ title: "Match the animals", origin: "https://wordwall.net" });

    // Hidden games leave the shelf; deleted games are gone.
    await app.inject({ method: "PATCH", url: `/api/parent/arcade/${id}`, headers: { cookie }, payload: { hidden: true } });
    expect((await app.inject({ method: "GET", url: "/api/arcade" })).json().some((g: { id: string }) => g.id === id)).toBe(false);
    expect((await app.inject({ method: "DELETE", url: `/api/parent/arcade/${id}`, headers: { cookie } })).statusCode).toBe(200);
  });

  it("the parent can add a trusted site", async () => {
    const r = await app.inject({ method: "PUT", url: "/api/parent/arcade/hosts", headers: { cookie }, payload: { hosts: ["wordwall.net", "LearningApps.org"] } });
    expect(r.json().hosts).toEqual(["wordwall.net", "learningapps.org"]);
  });
});
