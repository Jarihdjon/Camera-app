import type { DB } from "../db/db.js";
import { getSetting } from "../db/settings.js";

/** USD per million tokens. Update when prices change. */
const PRICES_USD: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export function costAud(db: DB, model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES_USD[model] ?? PRICES_USD["claude-opus-5-5"]!;
  const usd = (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
  return usd * getSetting(db, "audPerUsd");
}

export function spendThisMonthAud(db: DB, now = new Date()): number {
  const month = now.toISOString().slice(0, 7); // YYYY-MM
  const row = db
    .prepare("SELECT COALESCE(SUM(cost_aud), 0) AS total FROM generation_log WHERE substr(created_at, 1, 7) = ?")
    .get(month) as { total: number };
  return row.total;
}

/** The hard monthly cap. Once reached, the app uses the content bank only. */
export function underCap(db: DB, now = new Date()): boolean {
  return spendThisMonthAud(db, now) < getSetting(db, "monthlySpendCapAud");
}
