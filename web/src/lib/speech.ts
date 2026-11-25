import { wordAt } from "@/components/robot/lipsync";
import { NARRATOR_VOICE, SPARKY_VOICE, type VoicePick } from "@yav/shared/game";

/**
 * Speech using the device's built-in voices.
 *
 * Reads like a person rather than a machine:
 * - text is spoken sentence by sentence, with a short pause after each sentence and a
 *   longer one between paragraphs (one long utterance sounds flat and rushed);
 * - the best installed voice is chosen: "Enhanced", "Premium" or "Natural" voices first,
 *   Australian English first, and novelty voices are never used;
 * - "narrator" style (stories, questions) is calm and natural; "robot" style (Sparky's chat)
 *   is a little brighter.
 *
 * Listeners get start / word / end events so the robot can lip-sync. `stop()` stops at once.
 */
/** `who` says which character is talking (undefined = Sparky), so only their mouth moves. */
export type SpeechEvent = { type: "start"; who?: string } | { type: "word"; word: string; who?: string } | { type: "end"; who?: string };
export interface VoiceTune { pitch: number; rate: number }
export type SpeechStyle = "robot" | "narrator";
type Listener = (e: SpeechEvent) => void;

const listeners = new Set<Listener>();
const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;
let voice: SpeechSynthesisVoice | undefined;

/** Novelty voices that sound silly for reading (Apple's character voices and similar). */
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|pipe organ|fred|junior|ralph|kathy|grandma|grandpa|rocko|shelley|flo|reed|sandy|eddy/i;

/** Higher is better. Exported for tests. */
export function voiceScore(v: { name: string; lang: string; localService?: boolean }): number {
  if (!/^en/i.test(v.lang) || NOVELTY.test(v.name)) return -1;
  let s = 0;
  if (/premium/i.test(v.name)) s += 30;
  if (/enhanced|neural|natural|online/i.test(v.name)) s += 20;
  if (/siri/i.test(v.name)) s += 15;
  if (/en[-_]AU/i.test(v.lang)) s += 10;
  else if (/en[-_](GB|NZ|IE)/i.test(v.lang)) s += 6;
  else if (/en[-_]US/i.test(v.lang)) s += 3;
  if (/compact|espeak/i.test(v.name)) s -= 10;
  return s;
}

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  voice = [...voices].sort((a, b) => voiceScore(b) - voiceScore(a)).find((v) => voiceScore(v) >= 0);
}
if (hasSpeech) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function onSpeech(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
function emit(e: SpeechEvent) {
  for (const l of listeners) l(e);
}

// Sentence splitting is shared with the server, so lines it makes ahead of time match exactly.
import { splitForSpeech, type Chunk } from "@yav/shared/childHelpers";
export { splitForSpeech, type Chunk };

let token = 0;
let timer: number | undefined;
let active = false;
let currentWho: string | undefined;

/** Stop speaking straight away. */
export function stop() {
  token++;
  window.clearTimeout(timer);
  if (hasSpeech) speechSynthesis.cancel();
  if (source) {
    try { source.stop(); } catch { /* already stopped */ }
    source = null;
  }
  if (active) {
    active = false;
    emit({ type: "end", who: currentWho });
  }
}

export function isSpeaking() {
  return active;
}

// ---------- the natural voice made on the PC (see server/src/tts.ts) ----------

let serverVoice = false;
async function checkServerVoice() {
  try {
    const r = await fetch("/api/tts/status");
    const j = (await r.json()) as { state: string };
    serverVoice = j.state === "ready";
    // Still loading on the PC: look again shortly.
    if (j.state === "loading") window.setTimeout(checkServerVoice, 5000);
  } catch {
    serverVoice = false;
  }
}
let audioCtx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
if (typeof window !== "undefined") {
  void checkServerVoice();
  // iPad Safari only lets sound start after a tap: wake the audio on the first one.
  const wake = () => {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx && AC) audioCtx = new AC();
    void audioCtx?.resume();
  };
  window.addEventListener("pointerdown", wake, { capture: true });
}
export const usingNaturalVoice = () => serverVoice;

function fetchLine(text: string, pick: VoicePick): Promise<AudioBuffer> {
  const url = `/api/tts?v=${encodeURIComponent(pick.voice)}&s=${pick.speed}&t=${encodeURIComponent(text)}`;
  const timeout = new Promise<never>((_, rej) => window.setTimeout(() => rej(new Error("slow")), 12000));
  const load = fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.arrayBuffer();
  }).then((b) => audioCtx!.decodeAudioData(b));
  return Promise.race([load, timeout]);
}

/**
 * Say something. `pick` chooses the natural voice (defaults: the narrator for stories,
 * Sparky's voice for chat); `tune` adjusts the iPad's own voice when that is used instead.
 */
export function say(text: string, style: SpeechStyle = "robot", tune?: VoiceTune, who?: string, pick?: VoicePick) {
  stop();
  const my = ++token;
  const chunks = splitForSpeech(text);
  if (!chunks.length) return;
  active = true;
  currentWho = who;
  emit({ type: "start", who });

  if (serverVoice && audioCtx) {
    const voice = pick ?? (style === "narrator" ? NARRATOR_VOICE : SPARKY_VOICE);
    const lines: Promise<AudioBuffer>[] = [];
    const get = (i: number) => (lines[i] ??= fetchLine(chunks[i]!.text, voice));
    const playChunk = (i: number) => {
      if (my !== token) return;
      if (i >= chunks.length) {
        active = false;
        emit({ type: "end", who });
        return;
      }
      // Ask for the next sentence while this one plays.
      if (i + 1 < chunks.length) void get(i + 1).catch(() => {});
      get(i).then((buf) => {
        if (my !== token) return;
        const src = audioCtx!.createBufferSource();
        src.buffer = buf;
        src.connect(audioCtx!.destination);
        src.onended = () => {
          if (my !== token) return;
          timer = window.setTimeout(() => playChunk(i + 1), chunks[i]!.pause);
        };
        source = src;
        src.start();
      }).catch(() => {
        // The PC voice stumbled: carry on with the iPad's own voice from here.
        if (my !== token) return;
        deviceSpeak(chunks, i, my, style, tune, who);
      });
    };
    playChunk(0);
    return;
  }
  deviceSpeak(chunks, 0, my, style, tune, who);
}

function deviceSpeak(chunks: Chunk[], from: number, my: number, style: SpeechStyle, tune: VoiceTune | undefined, who: string | undefined) {
  if (!hasSpeech) {
    // No voice available: still animate, for about as long as the line would take.
    const length = chunks.slice(from).reduce((n, c) => n + c.text.length, 0);
    timer = window.setTimeout(() => {
      if (my === token) { active = false; emit({ type: "end", who }); }
    }, Math.min(8000, length * 60));
    return;
  }
  const speakChunk = (i: number) => {
    if (my !== token) return;
    if (i >= chunks.length) {
      active = false;
      emit({ type: "end", who });
      return;
    }
    const c = chunks[i]!;
    const u = new SpeechSynthesisUtterance(c.text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else u.lang = "en-AU";
    // Narration: a touch slower than conversation, natural pitch. Sparky's chat: a little brighter.
    u.rate = tune?.rate ?? (style === "narrator" ? 0.88 : 0.96);
    u.pitch = tune?.pitch ?? (style === "narrator" ? 1.0 : 1.08);
    u.onboundary = (ev) => {
      if (my !== token || (ev.name && ev.name !== "word")) return;
      emit({ type: "word", word: wordAt(c.text, ev.charIndex, ev.charLength), who });
    };
    const next = () => {
      if (my !== token) return;
      timer = window.setTimeout(() => speakChunk(i + 1), c.pause);
    };
    u.onend = next;
    u.onerror = (e) => {
      // "interrupted" / "canceled" come from stop(); anything else, just carry on.
      if (e.error === "interrupted" || e.error === "canceled") return;
      next();
    };
    speechSynthesis.speak(u);
  };
  speakChunk(from);
}
