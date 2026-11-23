import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { UnitSchema, type Unit } from "@yav/shared";
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
export function forChild(unit: Unit) {
  const strip = (a: Unit["questions"][number]) => {
    switch (a.kind) {
      case "short-answer": {
        const { accept: _accept, ...rest } = a;
        return rest;
      }
      case "multiple-choice": {
        const { correctIndex: _c, ...rest } = a;
        return rest;
      }
      case "maths": {
        const { expression: _e, ...rest } = a;
        return rest;
      }
      default:
        return a;
    }
  };
  return { ...unit, warmup: strip(unit.warmup), questions: unit.questions.map(strip) };
}
