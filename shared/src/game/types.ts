/**
 * Game types shared by the server and the iPad. No dependencies, so the iPad
 * bundle stays small.
 */

/** The seven gates every level has, always in this order. */
export const GATES = ["listen", "read", "word", "number", "science", "puzzle", "write"] as const;
export type GateType = (typeof GATES)[number];

export const GATE_INFO: Record<GateType, { name: string; icon: string; strand: "reading" | "writing" | "maths" | "inquiry" }> = {
  listen: { name: "Listen", icon: "👂", strand: "reading" },
  read: { name: "Read", icon: "📖", strand: "reading" },
  word: { name: "Word", icon: "🔤", strand: "reading" },
  number: { name: "Number", icon: "🔢", strand: "maths" },
  science: { name: "Science", icon: "🔬", strand: "inquiry" },
  puzzle: { name: "Puzzle", icon: "🧩", strand: "maths" },
  write: { name: "Write", icon: "✏️", strand: "writing" },
};

/** Difficulty band: 1 easier, 2 middle, 3 harder. */
export type Band = 1 | 2 | 3;

export type Perk = "shield" | "jet" | "hint" | "magnet";
export const PERK_INFO: Record<Perk, { name: string; icon: string; about: string }> = {
  shield: { name: "Shield", icon: "🛡️", about: "One wrong answer without warping back" },
  jet: { name: "Jet boost", icon: "🚀", about: "Jump again in mid-air to reach secret places" },
  hint: { name: "Hint battery", icon: "🔋", about: "A free hint at any gate" },
  magnet: { name: "Gem magnet", icon: "🧲", about: "Pulls nearby gems to you" },
};

/** What the iPad receives for a gate. The answer stays on the PC. */
export type GateQuestion =
  | { id: string; gate: GateType; band: Band; kind: "choice"; prompt: string; say?: string; options: string[] }
  | { id: string; gate: GateType; band: Band; kind: "number"; prompt: string; say?: string; unit?: string }
  | { id: string; gate: GateType; band: Band; kind: "tiles"; prompt: string; say?: string; tiles: string[] }
  | { id: string; gate: GateType; band: Band; kind: "letters"; prompt: string; say: string; letters: string[]; length: number };

export interface GateResult {
  correct: boolean;
  /** The right answer, shown kindly after a miss. */
  answer: string;
  /** He had a shield: no warp, and a fresh question at the same gate. */
  shielded: boolean;
  checkpoint: number;
  shields: number;
}

export interface LevelSummary {
  id: string;
  name: string;
  emoji: string;
  /** Null until a topic pack exists for it ("coming soon"). */
  packId: string | null;
  completed: boolean;
  gems: number;
  gemsTotal: number;
  eggs: number;
  eggsTotal: number;
  checkpoint: number;
}

export interface RealmSummary {
  id: string;
  name: string;
  emoji: string;
  color: string;
  sky: [string, string];
  levels: LevelSummary[];
}

export interface GameState {
  realms: RealmSummary[];
  perks: { shield: number; jet: boolean; hint: number; magnet: boolean };
  gems: number;
}

export interface Palette {
  /** Top of the path blocks. */
  top: string;
  /** Sides and the earth below. */
  side: string;
  accent: string;
  /** Props: trees, houses, rocks. */
  prop: string;
  prop2: string;
  sky: [string, string];
  fog: string;
  props: "jungle" | "town" | "beach" | "moon" | "castle";
}

/** The parts of a topic pack the iPad needs to draw and narrate a level. */
export interface PackView {
  id: string;
  title: string;
  emoji: string;
  palette: Palette;
  passage: { title: string; text: string };
  glossary: { word: string; meaning: string }[];
  /** Perk for each easter egg, in layout order. */
  eggs: Perk[];
}
