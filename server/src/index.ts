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

const db = openDb(paths.db());
if (!getSetting(db, "parentPinHash")) setSetting(db, "parentPinHash", hashPin(config.initialPin));

const bank = loadContentBank();
const bankChapters = loadBankChapters(bank);
const queue = new GenerationQueue(db, bank, bankChapters, claudeUnitModel(db));
const app = await buildApp({ db, bank, bankChapters, onLastChapterStarted: () => queue.kick(), isGenerating: () => queue.running });

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
