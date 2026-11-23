import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api, type ChildActivity, type ChildUnit, type Wallet } from "@/lib/api";
import { Robot } from "@/components/robot/Robot";
import { useRobot } from "@/components/robot/RobotProvider";
import { SpeechBubble } from "@/components/robot/SpeechBubble";
import { AskSparky } from "@/components/ask/AskSparky";
import { WalletBar } from "@/components/WalletBar";
import { celebrate } from "@/components/rewards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { WordHunter } from "./WordHunter";
import { WritingTask } from "./WritingTask";
import { Question } from "./unit/Question";
import { OpenStep } from "./unit/OpenStep";
import { GapFill } from "./unit/GapFill";
import { SelfCheck } from "./unit/SelfCheck";
import { Kicker, StepCard } from "./unit/shared";

/** The PYP inquiry cycle, as in the Inquirer's Journal. */
const PHASES = [
  { name: "Tune in", icon: "📡" },
  { name: "Find out", icon: "📖" },
  { name: "Sort out", icon: "🧩" },
  { name: "Go further", icon: "🚀" },
  { name: "Reflect", icon: "🪞" },
  { name: "Take action", icon: "⛰️" },
] as const;

type Step =
  | { t: "intro"; ph: 0 }
  | { t: "tune"; ph: 0 }
  | { t: "activity"; ph: number; a: ChildActivity; label: string }
  | { t: "story"; ph: 1 }
  | { t: "reflect"; ph: 4 }
  | { t: "writing"; ph: 5 }
  | { t: "self"; ph: 5 }
  | { t: "done"; ph: 5 };

function buildSteps(u: ChildUnit): Step[] {
  const s: Step[] = [];
  if (u.inquiry) s.push({ t: "intro", ph: 0 }, { t: "tune", ph: 0 });
  if (u.warmup) s.push({ t: "activity", ph: 0, a: u.warmup, label: "Warm-up" });
  if (u.passage) s.push({ t: "story", ph: 1 });
  u.vocab.forEach((a, i) => s.push({ t: "activity", ph: 2, a, label: `Sort out · word detective ${i + 1} of ${u.vocab.length}` }));
  u.questions.forEach((a, i) => s.push({ t: "activity", ph: 2, a, label: `Sort out · question ${i + 1} of ${u.questions.length}` }));
  if (u.gapFill) s.push({ t: "activity", ph: 2, a: u.gapFill, label: "Sort out · fill the gaps" });
  u.corner.forEach((a) => s.push({ t: "activity", ph: 3, a, label: a.kind === "maths" ? "Go further · maths" : "Go further · inquiry" }));
  if (u.inquiry) s.push({ t: "reflect", ph: 4 });
  s.push({ t: "writing", ph: 5 });
  if (u.inquiry) s.push({ t: "self", ph: 5 });
  s.push({ t: "done", ph: 5 });
  return s;
}

export function UnitPlayer(props: { unit: ChildUnit; firstName: string; robotName: string; parts: string[]; wallet: Wallet; onWallet: (w: Wallet) => void; onDone: () => void }) {
  const { unit } = props;
  const steps = useMemo(() => buildSteps(unit), [unit]);
  const [i, setI] = useState(0);
  const [minutes, setMinutes] = useState<number | null>(null);
  const robot = useRobot();
  const step = steps[i]!;
  const next = () => setI((n) => Math.min(n + 1, steps.length - 1));
  const usedPhases = new Set(steps.map((s) => s.ph));

  async function finish() {
    const r = await api.completeUnit(unit.id);
    props.onWallet(r.wallet);
    setMinutes(r.minutesEarned);
    setI(steps.length - 1);
    void celebrate(true);
    robot.say(r.minutesEarned ? `Unit complete, ${props.firstName}! You earned ${r.minutesEarned} play minutes!` : `Unit complete! Brilliant work, ${props.firstName}!`, "cheer");
  }

  const afterWriting = () => (steps[i + 1]?.t === "self" ? next() : void finish());

  return (
    <AskSparky unitId={unit.id} robotName={props.robotName} parts={props.parts} onWallet={props.onWallet}>
      <div className="mx-auto max-w-5xl px-5 pb-28 pt-5" style={{ ["--unit" as string]: unit.color ?? "var(--primary)" }}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="lg" onClick={props.onDone} aria-label="Back to base">✕</Button>
          <span className="truncate font-display text-xl text-[var(--unit)] [filter:brightness(1.6)]">{unit.title}</span>
          <div className="ml-auto"><WalletBar wallet={props.wallet} /></div>
        </div>

        {/* Phase rail: where he is in the inquiry cycle. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {PHASES.map((p, k) => usedPhases.has(k) && (
            <motion.span key={p.name} layout
              className={cn("flex items-center gap-1.5 rounded-full border-2 px-3 py-1 font-display text-base",
                k === step.ph ? "border-transparent bg-[var(--unit)] font-semibold text-white shadow-[0_0_18px_var(--unit)]" : k < step.ph ? "border-[var(--unit)] text-foreground" : "border-white/15 text-muted-foreground")}>
              <span>{k < step.ph ? "✓" : p.icon}</span>{p.name}
            </motion.span>
          ))}
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full rounded-full bg-[var(--unit)] [filter:brightness(1.4)]" animate={{ width: `${(i / (steps.length - 1)) * 100}%` }} transition={{ type: "spring", stiffness: 60, damping: 14 }} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_210px]">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.25 }}>
              {step.t === "intro" && unit.inquiry && <Intro unit={unit} onNext={next} />}
              {step.t === "tune" && unit.inquiry && (
                <OpenStep unitId={unit.id} kind="tune-in" label="Tune in · before you read" prompt={unit.inquiry.tuneIn} optional onWallet={props.onWallet} onNext={next} />
              )}
              {step.t === "story" && unit.passage && <WordHunter passage={unit.passage} onWallet={props.onWallet} onNext={next} />}
              {step.t === "activity" && <ActivityStep key={step.a.id} unit={unit} a={step.a} label={step.label} onWallet={props.onWallet} onNext={next} />}
              {step.t === "reflect" && unit.inquiry && (
                <OpenStep unitId={unit.id} kind="reflect" label={`Reflect · as a ${unit.inquiry.learnerProfile}`} prompt={unit.inquiry.reflect} onWallet={props.onWallet} onNext={next} />
              )}
              {step.t === "writing" && <WritingTask task={unit.writing} onUnlocked={afterWriting} />}
              {step.t === "self" && <SelfCheck unitId={unit.id} onWallet={props.onWallet} onNext={() => void finish()} />}
              {step.t === "done" && (
                <Card className="items-center py-10 text-center">
                  <h1 className="text-5xl text-glow">Unit complete!</h1>
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

          <div className="order-first flex items-end gap-3 lg:order-none lg:flex-col lg:items-center">
            <Robot size={step.t === "done" ? 200 : 150} parts={props.parts} />
            <SpeechBubble name={props.robotName} className="text-base" />
          </div>
        </div>
      </div>
    </AskSparky>
  );
}

function ActivityStep({ unit, a, label, onWallet, onNext }: { unit: ChildUnit; a: ChildActivity; label: string; onWallet: (w: Wallet) => void; onNext: () => void }) {
  switch (a.kind) {
    case "open":
      return <OpenStep unitId={unit.id} activityId={a.id} kind="open" label={label} prompt={a.prompt} onWallet={onWallet} onNext={onNext} />;
    case "gap-fill":
      return <GapFill unitId={unit.id} activity={a} onWallet={onWallet} onNext={onNext} />;
    case "writing":
      return null;
    default:
      return <Question unitId={unit.id} activity={a} label={label} story={unit.passage?.text} onWallet={onWallet} onNext={onNext} />;
  }
}

/** The unit's big idea, concepts and learner profile, shown like a mission briefing. */
function Intro({ unit, onNext }: { unit: ChildUnit; onNext: () => void }) {
  const robot = useRobot();
  const inq = unit.inquiry!;
  return (
    <StepCard>
      <Kicker>Tune in · {inq.pypTheme}</Kicker>
      <h1 className="font-display text-5xl leading-tight">{unit.title}</h1>
      <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => robot.say(`Our big idea: ${inq.centralIdea}`, "happy")}
        className="cursor-pointer rounded-2xl bg-[var(--unit)]/20 px-5 py-4 text-left">
        <span className="block font-display text-sm font-semibold uppercase tracking-[0.14em] text-[var(--unit)] [filter:brightness(1.6)]">Our big idea 🔊</span>
        <span className="text-2xl italic leading-snug">{inq.centralIdea}</span>
      </motion.button>
      <div className="flex flex-wrap gap-2">
        {inq.keyConcepts.map((k) => (
          <span key={k} className="rounded-full border-2 border-[var(--unit)] px-4 py-1 font-display text-lg">🔑 {k}</span>
        ))}
        <span className="rounded-full border-2 border-primary bg-primary/15 px-4 py-1 font-display text-lg text-primary">⭐ Be a {inq.learnerProfile}</span>
      </div>
      <Button size="kid" variant="success" className="w-fit" onClick={onNext}>Let's go ➜</Button>
    </StepCard>
  );
}
