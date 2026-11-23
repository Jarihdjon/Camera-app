import { INTEREST_THEMES, STAGE_PARTS, type ChapterDef, type Theme, type Unit } from "@yav/shared";
import type { DB } from "../db/db.js";
import { allChapters, chapterViews, learnerNow } from "../engine/chapters.js";
import { learnerSummary } from "../engine/learner.js";
import { planNextUnit, type UnitPlan } from "../engine/picker.js";
import { generateUnit, type UnitModel } from "./claude.js";
import { underCap } from "./spend.js";

/** Original planet names and colours for each interest theme. */
const PLANETS: Record<string, { title: string; emoji: string; color: string; planet: [string, string]; ring: boolean }> = {
  minecraft: { title: "Blocky Peaks", emoji: "⛏️", color: "#2E7D32", planet: ["#8bd36b", "#3c6b2a"], ring: false },
  "astro-bot": { title: "Gearworks Moon", emoji: "🤖", color: "#1565C0", planet: ["#9cc9ff", "#2a4f8f"], ring: true },
  space: { title: "Comet Cove", emoji: "☄️", color: "#5E35B1", planet: ["#c3a6ff", "#3b2280"], ring: true },
  lego: { title: "Brick Canyon", emoji: "🧱", color: "#C62828", planet: ["#ff9b8a", "#8a2a22"], ring: false },
  robots: { title: "Circuit City", emoji: "🔧", color: "#EF6C00", planet: ["#ffc38a", "#9a4a12"], ring: true },
};

/**
 * Keeps the next planet ready. When he starts his last unlocked chapter, Claude writes a new
 * chapter of two story units pitched at his level; review and challenge stages are added by code.
 * One job at a time, and nothing runs once the monthly spend cap is reached.
 */
export class GenerationQueue {
  running = false;
  lastError: string | null = null;

  constructor(
    private db: DB,
    private bank: Unit[],
    private bankChapters: ChapterDef[],
    private model: UnitModel | null,
    private unitsPerChapter = 2,
  ) {}

  /** True when every chapter is already unlocked, so there is nothing new waiting for him. */
  needed(): boolean {
    const views = chapterViews(this.db, this.bank, allChapters(this.db, this.bankChapters));
    return !views.some((c) => c.status === "locked");
  }

  /** Start a run in the background if one is needed; never blocks the request. */
  kick(): void {
    if (!this.running && this.model && this.needed() && underCap(this.db)) void this.run();
  }

  async run(): Promise<"created" | "not-needed" | "busy" | "no-model" | "cap" | "failed"> {
    if (this.running) return "busy";
    if (!this.model) return "no-model";
    if (!this.needed()) return "not-needed";
    if (!underCap(this.db)) return "cap";
    this.running = true;
    try {
      const chapters = allChapters(this.db, this.bankChapters);
      const snap = learnerNow(this.db, this.bank, chapters);
      const theme = this.pickTheme(chapters, snap.themePrefs.map((t) => t.theme));
      const firstName = (this.db.prepare("SELECT first_name FROM child WHERE id = 1").get() as { first_name: string } | undefined)?.first_name ?? "friend";
      const pins = (JSON.parse((this.db.prepare("SELECT value FROM settings WHERE key = 'pinnedSkills'").get() as { value: string } | undefined)?.value ?? "[]") as string[]);
      const learner = learnerSummary(snap);
      const n = chapters.length + 1;

      const units: Unit[] = [];
      for (let k = 0; k < this.unitsPerChapter; k++) {
        const plan: UnitPlan = {
          ...planNextUnit({
            strands: snap.strands,
            dueReviewSkills: snap.missedSkills.map((m) => m.skill),
            pinnedSkills: pins,
            lastFormat: null,
            recentThemes: [],
          }),
          theme,
        };
        // One retry per unit: the checks are strict, and a second draft usually passes.
        // Writing alternates: short sentences first, one Story Mountain to end the chapter.
        const writing = k === this.unitsPerChapter - 1 ? "story-mountain" : "sentences";
        let r = await generateUnit(this.db, this.model, firstName, plan, learner, writing);
        if (!r.ok && (r.reason === "invalid" || r.reason === "quality")) r = await generateUnit(this.db, this.model, firstName, plan, learner, writing);
        if (!r.ok) {
          this.lastError = r.reason;
          if (r.reason === "monthly-cap-reached" || r.reason === "no-api-key") break;
          continue;
        }
        units.push({ ...r.value, id: `gen-ch${n}-${k + 1}`, theme });
      }
      if (units.length < this.unitsPerChapter) return "failed";

      const look = PLANETS[theme] ?? PLANETS.space!;
      const chapter: ChapterDef = {
        id: `gen-ch${n}`,
        title: look.title,
        emoji: look.emoji,
        color: look.color,
        planet: look.planet,
        ring: look.ring,
        stages: [
          ...units.flatMap((u, k) => STAGE_PARTS.map((part) => ({ id: `story-${k + 1}-${part}`, kind: "story" as const, unitId: u.id, part }))),
          { id: "review", kind: "review" as const },
          { id: "challenge", kind: "challenge" as const },
        ],
      };
      const insertUnit = this.db.prepare("INSERT OR REPLACE INTO unit (id, source, theme, body, status) VALUES (?, 'claude', ?, ?, 'chapter')");
      for (const u of units) insertUnit.run(u.id, u.theme, JSON.stringify(u));
      this.db.prepare("INSERT INTO chapter (id, position, body) VALUES (?, ?, ?)").run(chapter.id, n, JSON.stringify(chapter));
      this.lastError = null;
      return "created";
    } catch (err) {
      this.lastError = String(err);
      return "failed";
    } finally {
      this.running = false;
    }
  }

  /** His favourite interest theme that wasn't used for the last generated planet. */
  private pickTheme(chapters: ChapterDef[], prefs: string[]): Theme {
    const used = chapters.map((c) => Object.entries(PLANETS).find(([, p]) => p.title === c.title)?.[0]).filter(Boolean) as string[];
    const last = used[used.length - 1];
    const ordered = [...prefs.filter((t) => (INTEREST_THEMES as readonly string[]).includes(t)), ...INTEREST_THEMES];
    const unused = ordered.find((t) => !used.includes(t));
    return (unused ?? ordered.find((t) => t !== last) ?? "space") as Theme;
  }
}
