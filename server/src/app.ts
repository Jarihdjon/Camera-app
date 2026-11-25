import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import { existsSync } from "node:fs";
import type { DB } from "./db/db.js";
import type { Unit } from "@yav/shared";
import { childRoutes } from "./routes/child.js";
import { parentRoutes } from "./routes/parent.js";
import { uploadRoutes } from "./routes/uploads.js";
import { askRoutes } from "./routes/ask.js";
import { chapterRoutes } from "./routes/chapters.js";
import { loadBankChapters } from "./engine/chapters.js";
import type { ChapterDef } from "@yav/shared";
import { gameRoutes } from "./game/routes.js";
import { loadGameContent, type GameContent } from "./game/engine.js";
import { claudeAskModel, type AskModel } from "./ai/ask.js";
import { config } from "./config.js";
import { ttsRoutes } from "./routes/tts.js";
import { arcadeParentRoutes, arcadeRoutes } from "./arcade/routes.js";
import path from "node:path";
import type { Tts } from "./tts.js";

export interface AppDeps {
  db: DB;
  bank: Unit[];
  serveWeb?: boolean;
  /** Override the Claude call (tests). Defaults to the real model when a key is set. */
  askModel?: AskModel | null;
  bankChapters?: ChapterDef[];
  onLastChapterStarted?: () => void;
  isGenerating?: () => boolean;
  gameContent?: GameContent;
  /** The natural reading voice (null: the iPad uses its own voice). */
  tts?: Tts | null;
  /** Where H5P games are unpacked (tests use a temporary folder). */
  h5pRoot?: string;
}

export async function buildApp({ db, bank, serveWeb = true, askModel, bankChapters, onLastChapterStarted, isGenerating, gameContent, tts = null, h5pRoot = path.join(config.dataDir, "h5p") }: AppDeps) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? (process.env.VITEST ? "silent" : "info") } });
  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, { limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

  app.get("/api/health", async () => ({ ok: true, time: new Date().toISOString() }));
  await app.register(childRoutes, { prefix: "/api", db, bank });
  await app.register(uploadRoutes, { prefix: "/api", db });
  await app.register(askRoutes, { prefix: "/api", db, bank, model: askModel === undefined ? claudeAskModel(db) : askModel });
  const chapters = bankChapters ?? loadBankChapters(bank);
  await app.register(chapterRoutes, { prefix: "/api", db, bank, bankChapters: chapters, onLastChapterStarted, isGenerating });
  await app.register(gameRoutes, { prefix: "/api/game", db, content: gameContent ?? loadGameContent() });
  await app.register(ttsRoutes, { prefix: "/api", tts });
  await app.register(arcadeRoutes, { prefix: "/api", db, h5pRoot });
  await app.register(arcadeParentRoutes, { prefix: "/api/parent/arcade", db, h5pRoot });
  await app.register(parentRoutes, { prefix: "/api/parent", db, bank, bankChapters: chapters, isGenerating });

  if (serveWeb && existsSync(config.webDist)) {
    await app.register(fastifyStatic, { root: config.webDist });
    // Client-side routes fall back to the app shell.
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/") ? reply.code(404).send({ error: "not found" }) : reply.sendFile("index.html"),
    );
  }
  return app;
}
