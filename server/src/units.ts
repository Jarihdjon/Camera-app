import { UnitSchema, type Activity, type Unit } from "@yav/shared";
import type { DB } from "./db/db.js";

/** Units come from the database (generated ahead) first, then the content bank. */
export function findUnit(db: DB, bank: Unit[], id: string): Unit | undefined {
  const row = db.prepare("SELECT body FROM unit WHERE id = ?").get(id) as { body: string } | undefined;
  if (row) return UnitSchema.parse(JSON.parse(row.body));
  return bank.find((u) => u.id === id);
}

export function findActivity(unit: Unit, activityId: string): Activity | undefined {
  return [unit.warmup, ...unit.questions, unit.writing].find((a) => a.id === activityId);
}

/** Today's two units: ready generated units first, then bank units he has not completed. */
export function pickTodaysUnits(db: DB, bank: Unit[], count = 2): Unit[] {
  const ready = (db.prepare("SELECT body FROM unit WHERE status IN ('ready','served') ORDER BY created_at LIMIT ?").all(count) as { body: string }[])
    .map((r) => UnitSchema.parse(JSON.parse(r.body)));
  if (ready.length >= count) return ready;
  const done = new Set(
    (db.prepare("SELECT id FROM unit WHERE status = 'completed'").all() as { id: string }[]).map((r) => r.id),
  );
  const fromBank = bank.filter((u) => !done.has(u.id) && !ready.some((r) => r.id === u.id));
  // When the bank is exhausted, cycle it rather than show nothing.
  const pool = fromBank.length ? fromBank : bank;
  return [...ready, ...pool].slice(0, count);
}
