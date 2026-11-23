import { networkInterfaces } from "node:os";
import { openDb } from "./db/db.js";
import { getSetting, setSetting } from "./db/settings.js";
import { hashPin } from "./auth.js";
import { loadContentBank } from "./content.js";
import { buildApp } from "./app.js";
import { config, paths } from "./config.js";

const db = openDb(paths.db());
if (!getSetting(db, "parentPinHash")) setSetting(db, "parentPinHash", hashPin(config.initialPin));

const bank = loadContentBank();
const app = await buildApp({ db, bank });
await app.listen({ port: config.port, host: config.host });

const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => `http://${n!.address}:${config.port}`);
app.log.info(`Content bank: ${bank.length} units. Claude: ${config.anthropicKey ? "configured" : "not configured (bank only)"}`);
app.log.info(`Open on the iPad: ${lanAddresses.join("  ") || "(no LAN address found)"}`);
