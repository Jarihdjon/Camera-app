import type { CharacterKind, MissionCharacter } from "./types.js";

/**
 * Which natural voice reads what (Kokoro voice names; see server/src/tts.ts). Shared so the
 * server can make lines ahead of time with exactly the voice the iPad will ask for.
 */
export const NARRATOR_VOICE = { voice: "af_heart", speed: 0.95 } as const;
export const SPARKY_VOICE = { voice: "am_puck", speed: 1.05 } as const;
const BY_KIND: Record<CharacterKind, string> = {
  koala: "af_bella", bird: "af_sky", stone: "am_onyx", wombat: "bm_george", owl: "bm_fable",
  turtle: "bf_emma", crab: "am_echo", alien: "af_nova", dragon: "bf_lily",
};

export interface VoicePick { voice: string; speed: number }

/** A story animal's voice: its kind sets the voice, its script's rate sets the pace. */
export function characterVoice(c: Pick<MissionCharacter, "kind" | "voice">): VoicePick {
  const speed = Math.round(Math.min(1.15, Math.max(0.8, c.voice?.rate ?? 1)) * 100) / 100;
  return { voice: BY_KIND[c.kind], speed };
}
