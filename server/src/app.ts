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
import { config } from "./config.js";

export interface AppDeps {
  db: DB;
  bank: Unit[];
  serveWeb?: boolean;
}

export async function buildApp({ db, bank, serveWeb = true }: AppDeps) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? (process.env.VITEST ? "silent" : "info") } });
  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, { limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

  app.get("/api/health", async () => ({ ok: true, time: new Date().toISOString() }));
  await app.register(childRoutes, { prefix: "/api", db, bank });
  await app.register(uploadRoutes, { prefix: "/api", db });
  await app.register(parentRoutes, { prefix: "/api/parent", db });

  if (serveWeb && existsSync(config.webDist)) {
    await app.register(fastifyStatic, { root: config.webDist });
    // Client-side routes fall back to the app shell.
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/") ? reply.code(404).send({ error: "not found" }) : reply.sendFile("index.html"),
    );
  }
  return app;
}
