import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Delete, Lightbulb } from "lucide-react";
import { paragraphs } from "@yav/shared/childHelpers";
import { api, type ChildActivity, type Reveal, type Wallet } from "@/lib/api";
import { useRobot } from "@/components/robot/RobotProvider";
import { useAsk } from "@/components/ask/AskSparky";
import { celebrate, pointFrom, useFlyReward } from "@/components/rewards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ENCOURAGE, Feedback, Kicker, Peek, pick, PRAISE, Prompt, StepCard } from "./shared";

type Marked = Extract<ChildActivity, { kind: "short-answer" | "multiple-choice" | "word-meaning" | "maths" }>;

/**
 * One marked question. Two tries: after the first miss he gets the hint and the paragraph
 * to look at; after the second the answer is shown kindly, and he moves on.
 */
export type QuestionState = { answer: string; tries: number; state: "asking" | "right" | "shown"; hint: string | null; reveal: Reveal; wrongPicks: number[] };

export function Question({ unitId, activity, label, story, support = false, peekOnMiss = true, autoRead = false, initial, onState, onMiss, onWallet, onNext }: {
  unitId: string;
  activity: Marked;
  label: string;
  story?: string;
  /** Show the paragraph to look at straight away (his level in this strand is 1 or 2). */
  support?: boolean;
  /** Show the paragraph after a miss (off on harder stages, where only the hint shows). */
  peekOnMiss?: boolean;
  /** Read the question aloud when it appears (easier stages). */
  autoRead?: boolean;
  initial?: QuestionState;
  onState?: (s: QuestionState) => void;
  onMiss?: () => void;
  onWallet: (w: Wallet) => void;
  onNext: () => void;
}) {
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [tries, setTries] = useState(initial?.tries ?? 0);
  const [state, setState] = useState<"asking" | "right" | "shown">(initial?.state ?? "asking");
  const [hint, setHint] = useState<string | null>(initial?.hint ?? null);
  const [reveal, setReveal] = useState<Reveal>(initial?.reveal ?? null);
  const [wrongPicks, setWrongPicks] = useState<number[]>(initial?.wrongPicks ?? []);
  useEffect(() => onState?.({ answer, tries, state, hint, reveal, wrongPicks }), [answer, tries, state, hint, reveal, wrongPicks, onState]);
  const [shake, setShake] = useState(0);
  const shownAt = useRef(Date.now());
  const robot = useRobot();
  const ask = useAsk();
  const fly = useFlyReward();

  const promptText = activity.kind === "word-meaning" ? `Which meaning is closest to "${activity.word}"?` : activity.prompt;
  useEffect(() => ask.setScreen({ activityId: activity.id, prompt: promptText }), [activity.id, promptText, ask]);
  useEffect(() => {
    if (autoRead && !initial) robot.say(promptText, "thinking");
    // Only when the question first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(value: string | number, from: Element | null) {
    const tryNumber = tries + 1;
    const r = await api.attempt({ unitId, activityId: activity.id, answer: value, usedHint: hint !== null, msTaken: Date.now() - shownAt.current, tryNumber });
    onWallet(r.wallet);
    setTries(tryNumber);
    if (r.correct) {
      setState("right");
      setReveal(r.reveal);
      fly("blocks", pointFrom(from), 2);
      void celebrate();
      robot.say(pick(PRAISE), "cheer");
      return;
    }
    if (tryNumber === 1) onMiss?.();
    if (typeof value === "number") setWrongPicks((w) => [...w, value]);
    setShake((s) => s + 1);
    setHint(r.hint);
    if (r.reveal) {
      setState("shown");
      setReveal(r.reveal);
      robot.say(`Good try! ${r.reveal.text ? `The answer is: ${r.reveal.text}.` : ""} Let's keep going!`, "encourage");
    } else {
      robot.say(`${pick(ENCOURAGE)} ${r.hint ?? ""}`, "encourage");
    }
  }

  const para = "para" in activity && activity.para !== undefined && story ? paragraphs(story)[activity.para] : undefined;
  const done = state !== "asking";
  const options = activity.kind === "multiple-choice" || activity.kind === "word-meaning" ? activity.options : null;

  return (
    <StepCard>
      <Kicker>{label}</Kicker>
      {activity.kind === "word-meaning" ? (
        <div className="flex flex-col gap-1">
          <span className="text-lg text-muted-foreground">Word detective: which meaning is closest?</span>
          <button type="button" className="w-fit cursor-pointer font-display text-5xl font-semibold text-[var(--unit)]" onClick={() => robot.say(activity.word)}>{activity.word} 🔊</button>
        </div>
      ) : (
        <Prompt text={activity.prompt} />
      )}

      <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}>
        {options ? (
          <div className="grid gap-3">
            {options.map((o, idx) => {
              const isRight = done && reveal?.correctIndex === idx;
              const isWrong = wrongPicks.includes(idx) && !isRight;
              return (
                <motion.div key={o} whileTap={{ scale: 0.97 }}>
                  <Button variant="secondary" size="kid" disabled={done || isWrong}
                    className={cn("w-full justify-start whitespace-normal text-left", isRight && "bg-success text-success-foreground", isWrong && "opacity-40")}
                    onClick={(e) => void submit(idx, e.currentTarget)}>
                    <span className="mr-2 grid size-9 shrink-0 place-items-center rounded-full bg-white/10 font-display">{"ABCD"[idx]}</span>{o}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        ) : activity.kind === "maths" ? (
          <Keypad value={answer} unit={activity.unit} disabled={done} onChange={setAnswer} onCheck={(el) => answer && void submit(answer, el)} />
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (answer.trim()) void submit(answer.trim(), e.currentTarget); }} className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-3">
              <Input className="h-16 max-w-md flex-1 rounded-2xl font-display text-3xl" value={answer} disabled={done} autoFocus autoComplete="off" autoCorrect="off" spellCheck={false}
                placeholder="Type your answer" onChange={(e) => { setAnswer(e.target.value); if (state === "asking") robot.setMood("thinking"); }} />
              {!done && <Button size="kid" type="submit" disabled={!answer.trim()}>Check</Button>}
            </div>
            {!done && <p className="text-base text-muted-foreground">Spelling doesn't have to be perfect.</p>}
          </form>
        )}
      </motion.div>

      <AnimatePresence>
        {state === "right" && <Feedback tone="good">Yes! {reveal?.text && activity.kind !== "multiple-choice" && activity.kind !== "word-meaning" ? reveal.text : ""}</Feedback>}
        {state === "shown" && <Feedback tone="try">{activity.kind === "maths" ? "Here's how it works: " : "The answer is: "}<b>{reveal?.text}</b>. Good try!</Feedback>}
        {state === "asking" && !hint && support && para && <Peek n={(activity as { para: number }).para} text={para} />}
        {state === "asking" && hint && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
            {/* When the hint is just "look again at paragraph N", the paragraph card says it already. */}
            {!(para && peekOnMiss && /^look again at paragraph/i.test(hint)) && <Feedback tone="try"><Lightbulb className="mr-2 inline size-6 text-primary" />{hint}</Feedback>}
            {para && peekOnMiss && <Peek n={(activity as { para: number }).para} text={para} />}
          </motion.div>
        )}
      </AnimatePresence>

      {done && (
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Button size="kid" variant="success" onClick={onNext}>Next ➜</Button>
        </motion.div>
      )}
    </StepCard>
  );
}

/** Big number keypad for maths, so there's no fiddly keyboard. */
function Keypad({ value, unit, disabled, onChange, onCheck }: { value: string; unit?: string; disabled: boolean; onChange: (v: string) => void; onCheck: (el: Element | null) => void }) {
  const check = useRef<HTMLButtonElement>(null);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"];
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex min-h-20 w-full max-w-md items-baseline justify-center gap-3 rounded-2xl border-2 border-white/15 bg-black/30 px-4 py-3 font-display text-5xl">
        {value || <span className="text-muted-foreground">?</span>}
        {unit && <span className="text-2xl text-muted-foreground">{unit}</span>}
      </div>
      {!disabled && (
        <div className="grid w-full max-w-md grid-cols-3 gap-3">
          {keys.map((k) =>
            k === "del" ? (
              <Button key={k} variant="secondary" size="kid" onClick={() => onChange(value.slice(0, -1))} aria-label="Delete"><Delete className="size-7" /></Button>
            ) : k === "ok" ? (
              <Button key={k} ref={check} size="kid" disabled={!value} onClick={() => onCheck(check.current)}>Check</Button>
            ) : (
              <Button key={k} variant="secondary" size="kid" className="font-display text-3xl" onClick={() => value.length < 4 && onChange(value + k)}>{k}</Button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
