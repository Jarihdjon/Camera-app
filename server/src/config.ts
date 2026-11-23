import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "../..");

function resolveFromRoot(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(REPO_ROOT, p);
}

export const config = {
  port: Number(process.env.PORT ?? 5174),
  host: process.env.HOST ?? "0.0.0.0",
  dataDir: resolveFromRoot(process.env.DATA_DIR ?? "./data"),
  webDist: path.resolve(REPO_ROOT, "web/dist"),
  contentBank: path.resolve(REPO_ROOT, "content/bank"),
  initialPin: process.env.INITIAL_PARENT_PIN ?? "2468",
  /** Present only on the PC. Never sent to the iPad. */
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
};

export const paths = {
  db: () => path.join(config.dataDir, "yav.sqlite"),
  uploads: () => path.join(config.dataDir, "uploads"),
  clips: () => path.join(config.dataDir, "clips"),
};
