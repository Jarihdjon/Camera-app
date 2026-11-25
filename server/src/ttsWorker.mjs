// Runs the Kokoro voice off the main thread, so making audio never slows the game server.
// Messages in: { id, text, voice, speed }. Out: { ready } | { failed } | { id, wav } | { id, error }.
import { parentPort } from "node:worker_threads";

let engine = null;
try {
  const { KokoroTTS } = await import("kokoro-js");
  engine = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
  parentPort.postMessage({ ready: true });
} catch (e) {
  parentPort.postMessage({ failed: e instanceof Error ? e.message : String(e) });
}

parentPort.on("message", async ({ id, text, voice, speed }) => {
  try {
    const audio = await engine.generate(text, { voice, speed });
    const wav = audio.toWav();
    parentPort.postMessage({ id, wav }, [wav]);
  } catch (e) {
    parentPort.postMessage({ id, error: e instanceof Error ? e.message : String(e) });
  }
});
