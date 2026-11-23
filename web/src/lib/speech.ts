import { wordAt } from "@/components/robot/lipsync";

/**
 * The iPad's built-in voice. Prefers an Australian English voice when one is installed.
 * Listeners get start / word / end events so the robot can lip-sync.
 */
export type SpeechEvent = { type: "start" } | { type: "word"; word: string } | { type: "end" };
type Listener = (e: SpeechEvent) => void;

let voice: SpeechSynthesisVoice | undefined;
const listeners = new Set<Listener>();

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  voice = voices.find((v) => v.lang === "en-AU") ?? voices.find((v) => v.lang.startsWith("en"));
}
const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;
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

export function say(text: string) {
  if (!hasSpeech) {
    // No voice available: still animate, for about as long as the line would take.
    emit({ type: "start" });
    setTimeout(() => emit({ type: "end" }), Math.min(6000, text.length * 60));
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 0.95;
  u.pitch = 1.15;
  u.onstart = () => emit({ type: "start" });
  u.onboundary = (ev) => {
    if (ev.name && ev.name !== "word") return;
    emit({ type: "word", word: wordAt(text, ev.charIndex, ev.charLength) });
  };
  u.onend = () => emit({ type: "end" });
  u.onerror = () => emit({ type: "end" });
  speechSynthesis.speak(u);
}
