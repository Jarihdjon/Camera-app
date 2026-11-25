import { networkInterfaces } from "node:os";
import { openDb } from "./db/db.js";
import { getSetting, setSetting } from "./db/settings.js";
import { hashPin } from "./auth.js";
import { loadContentBank } from "./content.js";
import { buildApp } from "./app.js";
import { config, paths } from "./config.js";
import { loadBankChapters } from "./engine/chapters.js";
import { GenerationQueue } from "./ai/queue.js";
import { claudeUnitModel } from "./ai/claude.js";
import path from "node:path";
import { Tts } from "./tts.js";
import { loadGameContent } from "./game/engine.js";
import { childNames, gameLines } from "./routes/tts.js";

const db = openDb(paths.db());
if (!getSetting(db, "parentPinHash")) setSetting(db, "parentPinHash", hashPin(config.initialPin));

const bank = loadContentBank();
const bankChapters = loadBankChapters(bank);
const queue = new GenerationQueue(db, bank, bankChapters, claudeUnitModel(db));
// The natural reading voice: loads in the background (TTS=off in .env turns it off).
const gameContent = loadGameContent();
const tts = process.env.TTS === "off" ? null : new Tts(path.join(config.dataDir, "tts"));
tts?.start();
const app = await buildApp({ db, bank, bankChapters, onLastChapterStarted: () => queue.kick(), isGenerating: () => queue.running, gameContent, tts });
// Once the voice is ready, quietly make every story line ahead of time so it plays instantly.
if (tts) {
  const wait = setInterval(() => {
    if (tts.state === "loading") return;
    clearInterval(wait);
    if (tts.state === "ready") {
      const lines = gameLines(gameContent, childNames(db));
      tts.warm(lines);
      app.log.info(`Natural voice ready. Preparing ${lines.length} story lines in the background.`);
    } else app.log.warn(`Natural voice not available (${tts.error}). The iPad will use its own voice.`);
  }, 2000);
  wait.unref();
}

// Once a night at 8pm, write the next planet if he is on his last one (and the cap allows).
let lastNightly = "";
setInterval(() => {
  const now = new Date();
  const today = now.toDateString();
  if (now.getHours() === 20 && lastNightly !== today) {
    lastNightly = today;
    queue.kick();
  }
}, 10 * 60 * 1000).unref();
await app.listen({ port: config.port, host: config.host });

const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => `http://${n!.address}:${config.port}`);
app.log.info(`Content bank: ${bank.length} units in ${bankChapters.length} chapters. Claude: ${config.anthropicKey ? "configured" : "not configured (bank only)"}`);
app.log.info(`Open on the iPad: ${lanAddresses.join("  ") || "(no LAN address found)"}`);
