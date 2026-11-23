import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { api, type ChapterView, type HubView, type Wallet } from "@/lib/api";
import { Robot } from "@/components/robot/Robot";
import { useRobot } from "@/components/robot/RobotProvider";
import { SpeechBubble } from "@/components/robot/SpeechBubble";
import { WalletBar } from "@/components/WalletBar";
import { Planet } from "@/components/Planet";
import { celebrate } from "@/components/rewards";
import { Button } from "@/components/ui/button";

/** Where each planet sits around the station, as % of the orbit area. Works for up to 8 chapters. */
const SPOTS = [
  { x: 18, y: 24 }, { x: 50, y: 10 }, { x: 82, y: 24 }, { x: 86, y: 62 },
  { x: 14, y: 62 }, { x: 32, y: 88 }, { x: 68, y: 88 }, { x: 50, y: 50 },
];

/**
 * Star Station: the home screen. His robot stands on the deck; chapter planets orbit
 * around it. Unlocked planets glow, locked ones show a padlock until he finishes the
 * chapter before.
 */
export function Hub(props: {
  firstName: string;
  robotName: string;
  parts: string[];
  wallet: Wallet;
  unlocked?: string | null;
  onChapter: (c: ChapterView) => void;
  onResume: (chapterId: string, stageId: string) => void;
  onWorkshop: () => void;
  onBuild: () => void;
  onParent: () => void;
}) {
  const [hub, setHub] = useState<HubView | null>(null);
  const robot = useRobot();
  const holdTimer = useRef<number>(undefined);

  useEffect(() => {
    api.hub().then((h) => {
      setHub(h);
      const fresh = props.unlocked && h.chapters.find((c) => c.id === props.unlocked);
      if (fresh) {
        void celebrate(true);
        robot.say(`Woohoo! You unlocked a new planet: ${fresh.title}! Let's fly there!`, "cheer");
      } else {
        const next = h.chapters.find((c) => c.status === "open");
        robot.say(h.resume ? `Welcome back, ${props.firstName}! Want to keep going with ${h.resume.title}?` : `Hi ${props.firstName}! Where shall we fly today?${next ? ` ${next.title} is waiting!` : ""}`, "wave");
      }
    }).catch(() => setHub({ chapters: [], resume: null, nextChapterComing: false }));
    // Greet once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allUnlocked = hub && hub.chapters.length > 0 && !hub.chapters.some((c) => c.status === "locked");

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 pb-8 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-glow">Star Station</h1>
        <WalletBar wallet={props.wallet} />
      </div>

      {hub?.resume && (
        <motion.button type="button" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.97 }}
          onClick={() => props.onResume(hub.resume!.chapterId, hub.resume!.stageId)}
          className="mt-4 flex cursor-pointer items-center gap-4 rounded-3xl border-2 border-primary bg-primary/15 px-5 py-3 text-left shadow-[0_0_24px_rgba(255,201,77,0.25)]">
          <span className="text-4xl">▶️</span>
          <span className="flex-1">
            <span className="block font-display text-2xl font-semibold">Keep going: {hub.resume.title}</span>
            {hub.resume.label && <span className="text-lg text-muted-foreground">{hub.resume.label}</span>}
          </span>
        </motion.button>
      )}

      {/* The orbit area: planets around the station deck. */}
      <div className="relative mt-4 aspect-[4/3] w-full">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 75" preserveAspectRatio="none" aria-hidden>
          <ellipse cx="50" cy="40" rx="40" ry="28" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
        </svg>

        {hub?.chapters.map((c, i) => {
          const spot = SPOTS[i % SPOTS.length]!;
          const locked = c.status === "locked";
          const prev = hub.chapters[i - 1];
          return (
            <motion.button
              key={c.id}
              type="button"
              aria-label={`${c.title}${locked ? " (locked)" : ""}`}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center gap-1"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={props.unlocked === c.id ? { scale: [0, 1.4, 1], opacity: 1 } : { scale: 1, opacity: 1, y: [0, -6, 0] }}
              transition={props.unlocked === c.id ? { duration: 1.2 } : { scale: { delay: i * 0.1 }, y: { duration: 4 + i * 0.4, repeat: Infinity, ease: "easeInOut" } }}
              whileTap={{ scale: 0.92 }}
              onClick={() => (locked ? robot.say(`${c.title} is locked. Finish ${prev?.title ?? "the chapter before"} to unlock it!`, "thinking") : props.onChapter(c))}
            >
              <Planet colors={c.planet} ring={c.ring} size={128} locked={locked} glow={c.status === "open"} />
              <span className="rounded-full bg-black/45 px-3 py-0.5 font-display text-lg font-semibold backdrop-blur">{c.emoji} {c.number}. {c.title}</span>
              {!locked && <span className="text-base text-primary">⭐ {c.stars} / {c.maxStars}</span>}
            </motion.button>
          );
        })}

        {allUnlocked && (
          <div className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 opacity-70" style={{ left: `${SPOTS[hub.chapters.length % SPOTS.length]!.x}%`, top: `${SPOTS[hub.chapters.length % SPOTS.length]!.y}%` }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="grid size-28 place-items-center rounded-full border-4 border-dashed border-white/30 font-display text-5xl text-white/60">?</motion.div>
            <span className="rounded-full bg-black/45 px-3 py-0.5 text-base">{hub.nextChapterComing ? "New planet being built…" : "New planet coming soon!"}</span>
          </div>
        )}

        {/* Station deck with his robot in the middle. */}
        <div className="absolute left-1/2 top-[50%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <button type="button" onClick={() => robot.say(`I'm ${props.robotName}! Tap a glowing planet and we'll fly there.`, "happy")} aria-label={`Talk to ${props.robotName}`}>
            <Robot size={150} parts={props.parts} />
          </button>
          <div className="-mt-3 h-6 w-44 rounded-[50%] bg-gradient-to-b from-slate-300/50 to-slate-600/40 shadow-[0_0_30px_rgba(124,240,216,0.4)]" />
        </div>
      </div>

      <div className="mx-auto mt-2 max-w-xl"><SpeechBubble name={props.robotName} /></div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button size="kid" variant="secondary" onClick={props.onWorkshop}>🔧 Upgrade {props.robotName}</Button>
        <Button size="kid" variant="secondary" onClick={props.onBuild}>🛰️ My space base</Button>
      </div>

      {/* Parent area: press and hold the corner for two seconds, then enter the PIN. */}
      <div className="fixed left-0 top-0 size-16" aria-label="Grown-ups"
        onPointerDown={() => { holdTimer.current = window.setTimeout(props.onParent, 2000); }}
        onPointerUp={() => window.clearTimeout(holdTimer.current)}
        onPointerLeave={() => window.clearTimeout(holdTimer.current)} />
    </div>
  );
}
