import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lightbulb, Volume2 } from "lucide-react";
import { api, type ChildActivity, type ChildUnit, type Wallet } from "@/lib/api";
import { Robot } from "@/components/robot/Robot";
import { useRobot } from "@/components/robot/RobotProvider";
import { SpeechBubble } from "@/components/robot/SpeechBubble";
import { WalletBar } from "@/components/WalletBar";
import { celebrate, pointFrom, useFlyReward } from "@/components/rewards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WordHunter } from "./WordHunter";
import { WritingTask } from "./WritingTask";

type Step = { kind: "activity"; activity: ChildActivity } | { kind: "passage" } | { kind: "writing" } | { kind: "done" };

const PRAISE = ["Yes! Great thinking!", "Brilliant!", "You got it!", "Super smart!", "Awesome work!"];
const ENCOURAGE = ["Nearly! Let's look again.", "Good try! Here's a clue.", "Ooh, close! Try this hint."];
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]!;

export function UnitPlayer(props: { unit: ChildUnit; firstName: string; robotName: string; parts: string[]; wallet: Wallet; onWallet: (w: Wallet) => void; onDone: () => void }) {
  const { unit } = props;
  const steps: Step[] = [
    { kind: "activity", activity: unit.warmup },
    ...(unit.passage ? [{ kind: "passage" } as const] : []),
    ...unit.questions.map((activity) => ({ kind: "activity", activity }) as const),
    { kind: "writing" },
    { kind: "done" },
  ];
  const [i, setI] = useState(0);
  const [minutes, setMinutes] = useState<number | null>(null);
  const robot = useRobot();
  const step = steps[i]!;
  const next = () => setI((n) => n + 1);

  async function finish() {
    const r = await api.completeUnit(unit.id);
    props.onWallet(r.wallet);
    setMinutes(r.minutesEarned);
    next();
    void celebrate(true);
    robot.say(r.minutesEarned ? `Mission complete, ${props.firstName}! You earned ${r.minutesEarned} play minutes!` : `Mission complete! Brilliant work, ${props.firstName}!`, "cheer");
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-12 pt-5">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="lg" onClick={props.onDone} aria-label="Back to base">✕</Button>
        <RocketTrack value={i / (steps.length - 1)} />
      </div>
      <div className="mt-3"><WalletBar wallet={props.wallet} /></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_220px]">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.25 }}>
            {step.kind === "activity" && <ActivityView unitId={unit.id} activity={step.activity} onWallet={props.onWallet} onNext={next} />}
            {step.kind === "passage" && unit.passage && <WordHunter passage={unit.passage} onWallet={props.onWallet} onNext={next} />}
            {step.kind === "writing" && <WritingTask task={unit.writing} onUnlocked={() => void finish()} />}
            {step.kind === "done" && (
              <Card className="items-center py-10 text-center">
                <h1 className="text-5xl text-glow">Mission complete!</h1>
                {minutes ? (
                  <motion.p initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ delay: 0.4 }} className="font-display text-4xl text-primary">+{minutes} play minutes</motion.p>
                ) : (
                  <p className="text-lg text-muted-foreground">You've reached today's play minutes, but your blocks and gems still count!</p>
                )}
                <Button size="kid" variant="success" onClick={props.onDone}>Back to base 🚀</Button>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* The robot keeps him company and reacts to every answer. */}
        <div className="order-first flex items-end gap-3 lg:order-none lg:flex-col lg:items-center">
          <Robot size={step.kind === "done" ? 200 : 150} parts={props.parts} />
          <SpeechBubble name={props.robotName} className="text-base" />
        </div>
      </div>
    </div>
  );
}

function RocketTrack({ value }: { value: number }) {
  return (
    <div className="relative h-4 flex-1 rounded-full bg-white/10">
      <motion.div className="h-full rounded-full bg-gradient-to-r from-glow via-success to-primary" animate={{ width: `${value * 100}%` }} transition={{ type: "spring", stiffness: 60, damping: 14 }} />
      <motion.span className="absolute -top-4 text-4xl" animate={{ left: `calc(${value * 100}% - 20px)`, rotate: [40, 50, 40] }} transition={{ left: { type: "spring", stiffness: 60, damping: 14 }, rotate: { duration: 0.6, repeat: Infinity } }}>🚀</motion.span>
      <span className="absolute -right-2 -top-4 text-4xl">🪐</span>
    </div>
  );
}

function ActivityView({ unitId, activity, onWallet, onNext }: { unitId: string; activity: ChildActivity; onWallet: (w: Wallet) => void; onNext: () => void }) {
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [state, setState] = useState<"asking" | "right" | "wrong">("asking");
  const [tries, setTries] = useState(0);
  const [shake, setShake] = useState(0);
  const shownAt = useRef(Date.now());
  const robot = useRobot();
  const fly = useFlyReward();

  if (activity.kind === "writing") return null;

  async function submit(value: string | number, from: Element | null) {
    const r = await api.attempt({ unitId, activityId: activity.id, answer: value, usedHint: hint !== null, msTaken: Date.now() - shownAt.current });
    if (r.correct) {
      setState("right");
      fly("blocks", pointFrom(from), 2);
      void celebrate();
      robot.say(pick(PRAISE), "cheer");
    } else {
      setTries((t) => t + 1);
      setState("wrong");
      setHint(r.hint);
      setShake((s) => s + 1);
      robot.say(`${pick(ENCOURAGE)} ${r.hint ?? ""}`, "encourage");
    }
    onWallet(r.wallet);
  }

  return (
    <Card className="gap-6 p-7">
      <button type="button" className="flex cursor-pointer items-start gap-3 text-left font-display text-3xl font-medium leading-snug" onClick={() => robot.say(activity.prompt, "thinking")}>
        <span className="flex-1">{activity.prompt}</span>
        <Volume2 className="mt-1 size-7 shrink-0 text-glow" />
      </button>

      <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}>
        {activity.kind === "multiple-choice" ? (
          <div className="grid gap-3">
            {activity.options.map((o, idx) => (
              <motion.div key={o} whileTap={{ scale: 0.97 }}>
                <Button variant="secondary" size="kid" className="w-full justify-start whitespace-normal text-left" disabled={state === "right"}
                  onClick={(e) => void submit(idx, e.currentTarget)}>
                  <span className="mr-2 grid size-9 shrink-0 place-items-center rounded-full bg-white/10 font-display">{String.fromCharCode(65 + idx)}</span>{o}
                </Button>
              </motion.div>
            ))}
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (answer.trim()) void submit(answer.trim(), e.currentTarget); }} className="flex flex-wrap gap-3">
            <Input className="h-16 max-w-sm flex-1 rounded-2xl font-display text-3xl" value={answer} onChange={(e) => { setAnswer(e.target.value); if (state === "asking") robot.setMood("thinking"); }}
              disabled={state === "right"} inputMode={activity.kind === "maths" ? "numeric" : "text"} autoComplete="off" autoCorrect="off" autoFocus />
            {state !== "right" && <Button size="kid" type="submit">Check</Button>}
          </form>
        )}
      </motion.div>

      <AnimatePresence>
        {state === "wrong" && hint && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0 }} className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/10 p-4 text-lg">
            <Lightbulb className="size-6 shrink-0 text-primary" /> {hint}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attempt limit: after three tries he moves on, so nobody gets stuck. */}
      {(state === "right" || tries >= 3) && (
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Button size="kid" variant="success" onClick={onNext}>Next ➜</Button>
        </motion.div>
      )}
    </Card>
  );
}
