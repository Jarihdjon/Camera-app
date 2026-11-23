import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMotionValue, type MotionValue } from "motion/react";
import { onSpeech, say as speak } from "@/lib/speech";
import { mouthTimeline } from "./lipsync";

export type Mood = "idle" | "happy" | "thinking" | "cheer" | "encourage" | "sleepy" | "wave";

interface RobotApi {
  mood: Mood;
  setMood: (m: Mood) => void;
  /** Speak a line: voice, lip-sync and speech bubble together. `bubble` shows different text (e.g. hide a listening sentence). */
  say: (text: string, mood?: Mood, bubble?: string) => void;
  speaking: boolean;
  /** 0 closed .. 1 open, driven by the lip-sync. */
  mouth: MotionValue<number>;
  bubble: string | null;
  /** Last place he tapped, in page coordinates, so the eyes can follow it. */
  lastTap: { x: number; y: number } | null;
}

const RobotContext = createContext<RobotApi | null>(null);

/** Moods that play once and settle back to idle. */
const TRANSIENT: Partial<Record<Mood, number>> = { cheer: 2600, wave: 2200, encourage: 3000 };

export function RobotProvider({ children }: { children: ReactNode }) {
  const [mood, setMoodState] = useState<Mood>("idle");
  const [speaking, setSpeaking] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [lastTap, setLastTap] = useState<{ x: number; y: number } | null>(null);
  const mouth = useMotionValue(0);
  const timers = useRef<number[]>([]);
  const moodTimer = useRef<number>(undefined);
  const fallback = useRef<number>(undefined);
  const gotWord = useRef(false);

  const clearMouth = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(
    () =>
      onSpeech((e) => {
        if (e.type === "start") {
          setSpeaking(true);
          gotWord.current = false;
          // Some voices never send word boundaries: fall back to a gentle talking loop.
          window.clearInterval(fallback.current);
          fallback.current = window.setInterval(() => {
            if (!gotWord.current) mouth.set(mouth.get() > 0.3 ? 0.1 : 0.4 + Math.random() * 0.5);
          }, 130);
        } else if (e.type === "word") {
          gotWord.current = true;
          clearMouth();
          for (const f of mouthTimeline(e.word)) timers.current.push(window.setTimeout(() => mouth.set(f.open), f.at));
        } else {
          setSpeaking(false);
          window.clearInterval(fallback.current);
          clearMouth();
          mouth.set(0);
        }
      }),
    [mouth],
  );

  useEffect(() => {
    const onDown = (e: PointerEvent) => setLastTap({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  const setMood = useCallback((m: Mood) => {
    window.clearTimeout(moodTimer.current);
    setMoodState(m);
    const ms = TRANSIENT[m];
    if (ms) moodTimer.current = window.setTimeout(() => setMoodState("idle"), ms);
  }, []);

  const say = useCallback(
    (text: string, m?: Mood, bubbleText?: string) => {
      if (m) setMood(m);
      setBubble(bubbleText ?? text);
      speak(text);
    },
    [setMood],
  );

  const api = useMemo(() => ({ mood, setMood, say, speaking, mouth, bubble, lastTap }), [mood, setMood, say, speaking, mouth, bubble, lastTap]);
  return <RobotContext.Provider value={api}>{children}</RobotContext.Provider>;
}

export function useRobot(): RobotApi {
  const ctx = useContext(RobotContext);
  if (!ctx) throw new Error("useRobot must be used inside <RobotProvider>");
  return ctx;
}
