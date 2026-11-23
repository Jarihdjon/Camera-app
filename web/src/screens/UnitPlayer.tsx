import { useRef, useState } from "react";
import { api, type ChildActivity, type ChildUnit, type Wallet } from "../lib/api";
import { say } from "../lib/speech";
import { Robot } from "./Robot";
import { WordHunter } from "./WordHunter";
import { WritingTask } from "./WritingTask";

type Step = { kind: "activity"; activity: ChildActivity } | { kind: "passage" } | { kind: "writing" } | { kind: "done" };

export function UnitPlayer({ unit, robotName, onWallet, onDone }: { unit: ChildUnit; robotName: string; onWallet: (w: Wallet) => void; onDone: () => void }) {
  const steps: Step[] = [
    { kind: "activity", activity: unit.warmup },
    ...(unit.passage ? [{ kind: "passage" } as const] : []),
    ...unit.questions.map((activity) => ({ kind: "activity", activity }) as const),
    { kind: "writing" },
    { kind: "done" },
  ];
  const [i, setI] = useState(0);
  const [result, setResult] = useState<{ minutesEarned: number } | null>(null);
  const step = steps[i]!;
  const next = () => setI((n) => n + 1);

  async function finish() {
    const r = await api.completeUnit(unit.id);
    onWallet(r.wallet);
    setResult(r);
    say(r.minutesEarned ? `Mission complete! You earned ${r.minutesEarned} minutes.` : "Mission complete! Brilliant work.");
    next();
  }

  return (
    <div className="screen">
      <div className="progress"><div style={{ width: `${(i / (steps.length - 1)) * 100}%` }} /></div>
      {step.kind === "activity" && <ActivityView key={step.activity.id} unitId={unit.id} activity={step.activity} onWallet={onWallet} onNext={next} />}
      {step.kind === "passage" && unit.passage && <WordHunter passage={unit.passage} robotName={robotName} onWallet={onWallet} onNext={next} />}
      {step.kind === "writing" && <WritingTask task={unit.writing} onUnlocked={() => void finish()} />}
      {step.kind === "done" && (
        <div className="centre stack">
          <Robot size={180} mood="cheer" />
          <h1>Mission complete!</h1>
          {result?.minutesEarned ? <p className="big">+{result.minutesEarned} play minutes</p> : <p>You've reached today's minutes, but your blocks and gems still count!</p>}
          <button className="primary" onClick={onDone}>Back to base</button>
        </div>
      )}
    </div>
  );
}

function ActivityView({ unitId, activity, onWallet, onNext }: { unitId: string; activity: ChildActivity; onWallet: (w: Wallet) => void; onNext: () => void }) {
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [state, setState] = useState<"asking" | "right" | "wrong">("asking");
  const [tries, setTries] = useState(0);
  const shownAt = useRef(Date.now());

  if (activity.kind === "writing") return null;

  async function submit(value: string | number) {
    const r = await api.attempt({ unitId, activityId: activity.id, answer: value, usedHint: hint !== null, msTaken: Date.now() - shownAt.current });
    onWallet(r.wallet);
    if (r.correct) {
      setState("right");
      say("Yes! Great thinking.");
    } else {
      setTries((t) => t + 1);
      setState("wrong");
      setHint(r.hint);
      say(r.hint ?? "Have another go.");
    }
  }

  return (
    <div className="stack activity">
      <p className="prompt" onClick={() => say(activity.prompt)}>{activity.prompt} <span aria-hidden>🔊</span></p>
      {activity.kind === "multiple-choice" ? (
        <div className="options">
          {activity.options.map((o, idx) => (
            <button key={o} disabled={state === "right"} onClick={() => void submit(idx)}>{o}</button>
          ))}
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (answer.trim()) void submit(answer.trim()); }} className="stack">
          <input className="big-input" value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={state === "right"}
            inputMode={activity.kind === "maths" ? "numeric" : "text"} autoComplete="off" autoCorrect="off" />
          {state !== "right" && <button className="primary" type="submit">Check</button>}
        </form>
      )}
      {state === "wrong" && hint && <div className="bubble hint">💡 {hint}</div>}
      {/* Attempt limit: after three tries he moves on, so nobody gets stuck. */}
      {(state === "right" || tries >= 3) && <button className="primary" onClick={onNext}>Next</button>}
    </div>
  );
}
