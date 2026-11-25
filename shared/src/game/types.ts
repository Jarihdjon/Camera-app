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
/** Each gate is a round of this many questions; all must be right to open it. */
export const QUESTIONS_PER_GATE = 3;

/** `step` of `steps`: which question of the gate's round this is (the last is a band harder). */
interface GateQuestionBase { id: string; gate: GateType; band: Band; prompt: string; step: number; steps: number }
export type GateQuestion =
  | (GateQuestionBase & { kind: "choice"; say?: string; options: string[] })
  | (GateQuestionBase & { kind: "number"; say?: string; unit?: string })
  | (GateQuestionBase & { kind: "tiles"; say?: string; tiles: string[] })
  | (GateQuestionBase & { kind: "letters"; say: string; letters: string[]; length: number });

export interface GateResult {
  correct: boolean;
  /** The right answer, shown kindly after a miss. */
  answer: string;
  /** He had a shield: no warp, and a fresh question at the same gate. */
  shielded: boolean;
  checkpoint: number;
  shields: number;
  /** Right answers so far in this gate's round, out of how many are needed. */
  progress: number;
  needed: number;
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
  /** The realm's quest: pieces returned so far, out of how many. */
  quest?: { name: string; emoji: string; pieces: number; total: number };
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
  /** The level's story mission, if it has one. */
  mission?: Mission;
}

/** What a right answer does in the world, for each story beat. */
export const BEAT_EFFECTS = ["fly", "signpost", "door", "bridge", "vine", "chest", "vault"] as const;
export type BeatEffect = (typeof BEAT_EFFECTS)[number];

/** Original story animals and characters, drawn in code. */
export const CHARACTER_KINDS = ["koala", "bird", "wombat", "stone", "owl"] as const;
export type CharacterKind = (typeof CHARACTER_KINDS)[number];

export interface MissionCharacter { id: string; name: string; kind: CharacterKind; color: string; voice?: { pitch: number; rate: number } }
export interface MissionLine { who: string; line: string }
export interface MissionBeat {
  who: string;
  /** Said when he reaches the beat, before the challenge. */
  setup: string;
  success: string;
  fail: string;
  effect: BeatEffect;
  /** The clue he earns for the treasure map. */
  clue: string;
  clueIcon: string;
}
export interface Mission {
  title: string;
  /** One line for the mission tracker. */
  goal: string;
  treasure: { name: string; emoji: string };
  characters: MissionCharacter[];
  intro: MissionLine[];
  beats: MissionBeat[];
  finale: MissionLine[];
}
