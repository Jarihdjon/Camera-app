import type { DB } from "./db.js";

/** Defaults from the "Open decisions" section of the build plan. All editable in the parent area. */
export const DEFAULT_SETTINGS = {
  minutesPerUnit: 15,
  dailyUnitCap: 2,
  freeBuildMinutes: 5,
  monthlySpendCapAud: 20,
  claudeModel: "claude-opus-5-5",
  /** Rough AUD per USD for the spend counter. Adjust if the rate moves. */
  audPerUsd: 1.55,
  parentPinHash: "",
  pinnedSkills: [] as string[],
  pinnedTopics: [] as string[],
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export function getSetting<K extends SettingKey>(db: DB, key: K): Settings[K] {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as Settings[K]) : DEFAULT_SETTINGS[key];
}

export function setSetting<K extends SettingKey>(db: DB, key: K, value: Settings[K]): void {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, JSON.stringify(value));
}
