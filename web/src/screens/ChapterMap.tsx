import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { api, type ChapterView } from "@/lib/api";
import { Robot } from "@/components/robot/Robot";
import { useRobot } from "@/components/robot/RobotProvider";
import { SpeechBubble } from "@/components/robot/SpeechBubble";
import { Planet } from "@/components/Planet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICON = { story: "📖", review: "💎", challenge: "🏆" } as const;

/** Pad positions zig-zag down the map, as % of its width and px from the top. */
function padSpot(i: number) {
  return { x: [22, 72, 30, 76, 40, 70, 26, 62][i % 8]!, y: 70 + i * 150 };
}

/**
 * A chapter's stage path. Stages unlock one after another; the robot stands on the
 * next open stage, and hops there when a new one opens.
 */
export function ChapterMap(props: { chapterId: string; robotName: string; parts: string[]; justUnlocked?: string | null; onStage: (chapterId: string, stageId: string) => void; onBack: () => void }) {
  const [chapter, setChapter] = useState<ChapterView | null>(null);
  const robot = useRobot();

  useEffect(() => {
    api.hub().then((h) => {
      const c = h.chapters.find((x) => x.id === props.chapterId) ?? null;
      setChapter(c);
      if (!c) return;
      const next = c.stages.find((s) => s.status === "open");
      if (props.justUnlocked && next) robot.say(`New stage unlocked: ${next.title}! Hop on!`, "cheer");
      else if (next) robot.say(`Welcome to ${c.title}! Next stop: ${next.title}.`, "wave");
      else robot.say(`You finished every stage in ${c.title}! Replay any stage to collect more stars.`, "cheer");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.chapterId]);

  if (!chapter) return null;
  const current = Math.max(0, chapter.stages.findIndex((s) => s.status === "open"));
  const here = padSpot(current === -1 ? chapter.stages.length - 1 : current);
  const height = padSpot(chapter.stages.length - 1).y + 140;
  const pathD = chapter.stages.map((_, i) => {
    const p = padSpot(i);
    if (i === 0) return `M ${p.x} ${p.y}`;
    const q = padSpot(i - 1);
    return `C ${q.x} ${(q.y + p.y) / 2}, ${p.x} ${(q.y + p.y) / 2}, ${p.x} ${p.y}`;
  }).join(" ");

  return (
    <div className="mx-auto max-w-3xl px-5 pb-10 pt-5" style={{ ["--unit" as string]: chapter.color }}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="lg" onClick={props.onBack}>← Star Station</Button>
      </div>
      <div className="mt-2 flex items-center gap-5">
        <Planet colors={chapter.planet} ring={chapter.ring} size={110} glow />
        <div>
          <p className="font-display text-base uppercase tracking-[0.14em] text-muted-foreground">Chapter {chapter.number}</p>
          <h1 className="font-display text-4xl text-glow">{chapter.emoji} {chapter.title}</h1>
          <div className="mt-2 h-3 w-56 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${(chapter.stars / chapter.maxStars) * 100}%` }} transition={{ duration: 1 }} />
          </div>
          <p className="mt-1 text-lg text-primary">⭐ {chapter.stars} of {chapter.maxStars} stars</p>
        </div>
      </div>
      <div className="mt-3"><SpeechBubble name={props.robotName} /></div>

      <div className="relative mt-4 w-full" style={{ height }}>
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
          <path d={pathD} fill="none" stroke="var(--unit)" strokeOpacity="0.35" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="0.1 4" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 14 }} />
        </svg>

        {chapter.stages.map((s, i) => {
          const p = padSpot(i);
          const locked = s.status === "locked";
          const isNext = i === current && s.status === "open";
          return (
            <motion.button
              key={s.id}
              type="button"
              aria-label={`${s.title}${locked ? " (locked)" : ""}`}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center gap-1"
              style={{ left: `${p.x}%`, top: p.y }}
              initial={{ scale: 0 }}
              animate={{ scale: props.justUnlocked === s.id ? [0, 1.3, 1] : 1 }}
              transition={{ delay: i * 0.08, type: "spring" }}
              whileTap={locked ? {} : { scale: 0.92 }}
              onClick={() => (locked ? robot.say("That stage is still locked. Finish the one before it first!", "thinking") : props.onStage(chapter.id, s.id))}
            >
              <motion.span
                animate={isNext ? { boxShadow: ["0 0 0px var(--unit)", "0 0 32px var(--unit)", "0 0 0px var(--unit)"] } : {}}
                transition={{ duration: 1.6, repeat: Infinity }}
                className={cn(
                  "grid size-24 place-items-center rounded-full border-4 text-4xl",
                  s.status === "done" ? "border-success bg-success/25" : locked ? "border-white/15 bg-black/40" : "border-[var(--unit)] bg-[var(--unit)]/35",
                )}
              >
                {locked ? <Lock className="size-9 text-white/50" /> : s.status === "done" ? "✓" : ICON[s.kind]}
              </motion.span>
              <span className={cn("max-w-44 rounded-full bg-black/45 px-3 py-0.5 text-center font-display text-lg leading-tight", locked && "text-muted-foreground")}>{s.title}</span>
              <span className="text-xl tracking-wider">{[0, 1, 2].map((k) => <span key={k} className={k < s.stars ? "" : "opacity-25 grayscale"}>⭐</span>)}</span>
            </motion.button>
          );
        })}

        {/* The robot hops to the next open stage. */}
        <motion.div className="pointer-events-none absolute -translate-x-1/2" initial={false}
          animate={{ left: `calc(${here.x}% + 70px)`, top: here.y - 110 }} transition={{ type: "spring", stiffness: 80, damping: 12 }}>
          <motion.div animate={{ y: [0, -14, 0] }} transition={{ duration: 0.9, repeat: 2 }}>
            <Robot size={90} parts={props.parts} />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
