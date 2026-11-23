/** The iPad's built-in voice. Prefers an Australian English voice when one is installed. */
let voice: SpeechSynthesisVoice | undefined;

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  voice = voices.find((v) => v.lang === "en-AU") ?? voices.find((v) => v.lang.startsWith("en"));
}
if (typeof speechSynthesis !== "undefined") {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function say(text: string) {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 0.95;
  u.pitch = 1.15;
  speechSynthesis.speak(u);
}
