import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";

/**
 * A natural reading voice, made on this computer.
 *
 * Uses Kokoro, a small free open-source neural voice (Apache-2.0), through `kokoro-js`.
 * The voice model (about 90 MB) downloads once from Hugging Face the first time the server
 * starts, then everything runs offline: no text leaves the house.
 *
 * Audio is cached on disk by (voice, speed, text), so each line is only ever made once.
 * One line is made at a time; lines asked for by the iPad jump ahead of background warm-up.
 * If the package or model isn't available the iPad falls back to its own voice.
 */

export const VOICES = ["af_heart", "af_bella", "af_nicole", "af_sky", "af_sarah", "am_michael", "am_puck", "am_echo", "am_onyx", "am_fenrir", "bf_emma", "bf_isabella", "bf_lily", "bm_george", "bm_lewis", "bm_fable", "bm_daniel"] as const;
export type Voice = (typeof VOICES)[number];

/** Makes the audio for one line. The real one runs Kokoro in a worker thread (ttsWorker.mjs). */
export interface Engine {
  generate(text: string, voice: string, speed: number): Promise<ArrayBuffer>;
}

function workerEngine(): Promise<Engine> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./ttsWorker.mjs", import.meta.url));
    worker.unref();
    const waiting = new Map<number, { resolve: (b: ArrayBuffer) => void; reject: (e: Error) => void }>();
    let next = 0;
    worker.on("message", (m: { ready?: true; failed?: string; id?: number; wav?: ArrayBuffer; error?: string }) => {
      if (m.ready) resolve({
        generate: (text, voice, speed) => new Promise((res, rej) => {
          const id = next++;
          waiting.set(id, { resolve: res, reject: rej });
          worker.postMessage({ id, text, voice, speed });
        }),
      });
      else if (m.failed) reject(new Error(m.failed));
      else if (m.id !== undefined) {
        const w = waiting.get(m.id);
        waiting.delete(m.id);
        if (m.wav) w?.resolve(m.wav);
        else w?.reject(new Error(m.error ?? "voice failed"));
      }
    });
    worker.on("error", reject);
  });
}

type Job = { key: string; text: string; voice: Voice; speed: number; resolve: (b: Buffer) => void; reject: (e: unknown) => void };

export class Tts {
  state: "off" | "loading" | "ready" | "failed" = "off";
  error = "";
  private engine: Engine | null = null;
  private urgent: Job[] = [];
  private background: Job[] = [];
  private busy = false;
  private pending = new Map<string, Promise<Buffer>>();

  /** `makeEngine` is for tests; normally the Kokoro worker. */
  constructor(private cacheDir: string, private makeEngine: () => Promise<Engine> = workerEngine) {}

  /** Load the model in the background. Safe to call more than once. */
  start() {
    if (this.state !== "off") return;
    this.state = "loading";
    void (async () => {
      try {
        this.engine = await this.makeEngine();
        this.state = "ready";
        this.pump();
      } catch (e) {
        this.state = "failed";
        this.error = e instanceof Error ? e.message : String(e);
      }
    })();
  }

  key(text: string, voice: Voice, speed: number) {
    return createHash("sha1").update(`${voice}|${speed.toFixed(2)}|${text}`).digest("hex");
  }

  private file(key: string) {
    return path.join(this.cacheDir, `${key}.wav`);
  }

  cached(text: string, voice: Voice, speed: number): Buffer | null {
    const f = this.file(this.key(text, voice, speed));
    return existsSync(f) ? readFileSync(f) : null;
  }

  /** The audio for a line. `urgent` lines (the iPad is waiting) go before warm-up lines. */
  speak(text: string, voice: Voice, speed = 1, urgent = true): Promise<Buffer> {
    const key = this.key(text, voice, speed);
    const hit = this.cached(text, voice, speed);
    if (hit) return Promise.resolve(hit);
    const inFlight = this.pending.get(key);
    if (inFlight) {
      // Someone is waiting now: move a queued warm-up job to the front.
      if (urgent) {
        const i = this.background.findIndex((j) => j.key === key);
        if (i >= 0) this.urgent.push(...this.background.splice(i, 1));
      }
      return inFlight;
    }
    const p = new Promise<Buffer>((resolve, reject) => (urgent ? this.urgent : this.background).push({ key, text, voice, speed, resolve, reject }));
    this.pending.set(key, p);
    p.catch(() => {}).finally(() => this.pending.delete(key));
    this.pump();
    return p;
  }

  /** Make lines ahead of time, quietly, so they play instantly later. */
  warm(lines: { text: string; voice: Voice; speed?: number }[]) {
    for (const l of lines) {
      if (!this.cached(l.text, l.voice, l.speed ?? 1)) void this.speak(l.text, l.voice, l.speed ?? 1, false).catch(() => {});
    }
  }

  get queued() {
    return this.urgent.length + this.background.length;
  }

  private pump() {
    if (this.busy || this.state !== "ready" || !this.engine) return;
    const job = this.urgent.shift() ?? this.background.shift();
    if (!job) return;
    this.busy = true;
    void (async () => {
      try {
        const buf = Buffer.from(await this.engine!.generate(job.text, job.voice, job.speed));
        mkdirSync(this.cacheDir, { recursive: true });
        writeFileSync(this.file(job.key), buf);
        job.resolve(buf);
      } catch (e) {
        job.reject(e);
      } finally {
        this.busy = false;
        // Let the server breathe between lines.
        setImmediate(() => this.pump());
      }
    })();
  }
}
