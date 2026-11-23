import { wordAt } from "@/components/robot/lipsync";

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
export type SpeechEvent = { type: "start" } | { type: "word"; word: string } | { type: "end" };
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

export interface Chunk {
  text: string;
  /** Pause after this chunk, in milliseconds. */
  pause: number;
}

/**
 * Split text into sentence-sized pieces with natural pauses: about a third of a second
 * after a sentence, longer after a paragraph or a "...", and a beat after a question.
 */
export function splitForSpeech(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  paras.forEach((para, pi) => {
    // " ... " marks a deliberate pause (e.g. between a listening sentence and its question).
    const parts = para.split(/\s*\.\.\.\s*/).filter(Boolean);
    parts.forEach((part, ki) => {
      const sentences = part.match(/[^.!?]+(?:[.!?]+["”’']?|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [part];
      sentences.forEach((s, si) => {
        const lastInPart = si === sentences.length - 1;
        const lastInPara = lastInPart && ki === parts.length - 1;
        let pause = /\?["”’']?$/.test(s) ? 450 : /!["”’']?$/.test(s) ? 380 : 320;
        if (lastInPart && !lastInPara) pause = 700;
        if (lastInPara && pi < paras.length - 1) pause = 800;
        if (lastInPara && pi === paras.length - 1) pause = 0;
        chunks.push({ text: s, pause });
      });
    });
  });
  return chunks;
}

let token = 0;
let timer: number | undefined;
let active = false;

/** Stop speaking straight away. */
export function stop() {
  token++;
  window.clearTimeout(timer);
  if (hasSpeech) speechSynthesis.cancel();
  if (active) {
    active = false;
    emit({ type: "end" });
  }
}

export function isSpeaking() {
  return active;
}

export function say(text: string, style: SpeechStyle = "robot") {
  stop();
  const my = ++token;
  const chunks = splitForSpeech(text);
  if (!chunks.length) return;
  active = true;
  emit({ type: "start" });

  if (!hasSpeech) {
    // No voice available: still animate, for about as long as the line would take.
    timer = window.setTimeout(() => {
      if (my === token) { active = false; emit({ type: "end" }); }
    }, Math.min(8000, text.length * 60));
    return;
  }

  const speakChunk = (i: number) => {
    if (my !== token) return;
    if (i >= chunks.length) {
      active = false;
      emit({ type: "end" });
      return;
    }
    const c = chunks[i]!;
    const u = new SpeechSynthesisUtterance(c.text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else u.lang = "en-AU";
    // Narration: a touch slower than conversation, natural pitch. Sparky's chat: a little brighter.
    u.rate = style === "narrator" ? 0.88 : 0.96;
    u.pitch = style === "narrator" ? 1.0 : 1.08;
    u.onboundary = (ev) => {
      if (my !== token || (ev.name && ev.name !== "word")) return;
      emit({ type: "word", word: wordAt(c.text, ev.charIndex, ev.charLength) });
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
  speakChunk(0);
}
