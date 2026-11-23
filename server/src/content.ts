import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { UnitSchema, toChildUnit, type Unit } from "@yav/shared";
import { config } from "./config.js";

/** Loads and validates every unit in content/bank. A bad file stops the server with a clear message. */
export function loadContentBank(dir = config.contentBank): Unit[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return files.map((f) => {
    const raw = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    const parsed = UnitSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`content/bank/${f} is invalid:\n${parsed.error.message}`);
    return parsed.data;
  });
}

/** Strip answer keys before anything goes to the iPad; checking happens on the server. */
export const forChild = toChildUnit;
