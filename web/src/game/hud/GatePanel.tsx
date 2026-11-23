import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Delete, Volume2 } from "lucide-react";
import { GATE_INFO, type GateQuestion, type GateResult } from "@yav/shared/game";
import { useRobot } from "@/components/robot/RobotProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The challenge hologram at a gate. Every answer is a tap: choices, a number pad,
 * word tiles or letter tiles. After answering it shows what happened, then hands back.
 */
export function GatePanel({ question, onAnswer, onDone, onReadStory }: {
  question: GateQuestion;
  onAnswer: (answer: string | number) => Promise<GateResult>;
  /** Called when he taps on after the result. `warp` is true after a miss without a shield. */
  onDone: (result: GateResult) => void;
  onReadStory: () => void;
}) {
  const robot = useRobot();
  const info = GATE_INFO[question.gate];
  const [result, setResult] = useState<GateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [num, setNum] = useState("");
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    setResult(null);
    setNum("");
    setPicked([]);
    // Listening gates say the sentence first, then the question; others just read the question.
    // Listening and spelling must be heard, not read: the bubble never shows those words.
    if (question.gate === "listen" && question.say) robot.say(`Listen carefully. ${question.say} ... ${question.prompt}`, "thinking", "👂 Listen carefully…");
    else if (question.kind === "letters") robot.say(question.say, "thinking", "👂 Listen, then spell the word.");
    else robot.say(question.prompt, "thinking");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  async function submit(a: string | number) {
    if (busy || result) return;
    setBusy(true);
    try {
      const r = await onAnswer(a);
      setResult(r);
      robot.say(r.correct ? "Yes! The gate is open!" : r.shielded ? `Your shield saved you! The answer was ${r.answer}. Here's a new one.` : `Not quite. The answer was ${r.answer}. Back to the checkpoint, you can do it!`, r.correct ? "cheer" : "encourage");
    } finally {
      setBusy(false);
    }
  }

  const tiles = question.kind === "tiles" ? question.tiles : question.kind === "letters" ? question.letters : [];
  const built = picked.map((i) => tiles[i]!);
  const ready = question.kind === "tiles" ? picked.length === tiles.length : question.kind === "letters" ? picked.length === question.length : false;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.85, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
      className="pointer-events-auto fixed inset-x-4 top-20 z-40 mx-auto max-w-2xl rounded-[2rem] border-2 border-glow/60 bg-[oklch(0.2_0.06_260/0.92)] p-6 shadow-[0_0_60px_rgba(124,240,216,0.35)] backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="grid size-14 place-items-center rounded-2xl bg-glow/20 text-4xl">{info.icon}</span>
        <div className="flex-1">
          <p className="font-display text-sm uppercase tracking-[0.16em] text-glow">{info.name} gate</p>
          <button type="button" className="cursor-pointer text-left font-display text-2xl leading-snug" onClick={() => robot.say(question.prompt)}>
            {question.prompt} <Volume2 className="inline size-5 opacity-70" />
          </button>
        </div>
      </div>

      {(question.gate === "listen" || question.kind === "letters" || question.kind === "tiles") && question.say && (
        <Button variant="secondary" size="lg" className="mt-4" onClick={() => robot.say(question.say!, "happy", question.gate === "listen" || question.kind === "letters" ? "👂 Listen carefully…" : undefined)}><Volume2 /> {question.gate === "listen" ? "Hear it again" : "Hear it"}</Button>
      )}
      {question.gate === "read" && <Button variant="secondary" size="lg" className="ml-2 mt-4" onClick={onReadStory}>📖 Read the story</Button>}

      <div className="mt-5">
        {question.kind === "choice" && (
          <div className="grid gap-3">
            {question.options.map((o, i) => (
              <Button key={o} variant="secondary" size="kid" disabled={busy || !!result} onClick={() => void submit(i)}
                className={cn("justify-start whitespace-normal text-left", result && result.correct && result.answer === o && "bg-success text-success-foreground")}>
                <span className="mr-2 grid size-9 shrink-0 place-items-center rounded-full bg-white/10 font-display">{"ABC"[i]}</span>{o}
              </Button>
            ))}
          </div>
        )}
        {question.kind === "number" && (
          <div className="flex flex-col items-center gap-3">
            <div className="min-h-16 w-64 rounded-2xl border-2 border-white/20 bg-black/30 py-2 text-center font-display text-5xl">{num || <span className="text-muted-foreground">?</span>}</div>
            {!result && (
              <div className="grid w-72 grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"].map((k) =>
                  k === "del" ? <Button key={k} variant="secondary" size="lg" className="h-14" onClick={() => setNum(num.slice(0, -1))} aria-label="Delete"><Delete /></Button>
                  : k === "ok" ? <Button key={k} size="lg" className="h-14" disabled={!num || busy} onClick={() => void submit(num)}>Go!</Button>
                  : <Button key={k} variant="secondary" size="lg" className="h-14 font-display text-2xl" onClick={() => num.length < 4 && setNum(num + k)}>{k}</Button>)}
              </div>
            )}
          </div>
        )}
        {(question.kind === "tiles" || question.kind === "letters") && (
          <div className="flex flex-col gap-4">
            <div className={cn("flex min-h-16 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-white/25 bg-black/30 p-3 font-display text-2xl", question.kind === "letters" && "justify-center tracking-widest")}>
              {built.length === 0 ? <span className="text-muted-foreground">Tap the tiles in order</span> : built.map((w, k) => (
                <button key={k} type="button" className="cursor-pointer rounded-xl bg-primary/25 px-3 py-1" onClick={() => !result && setPicked(picked.filter((_, j) => j !== k))}>{w}</button>
              ))}
            </div>
            {!result && (
              <div className="flex flex-wrap gap-2">
                {tiles.map((w, i) => (
                  <Button key={`${w}-${i}`} variant="secondary" size="lg" disabled={picked.includes(i)} className={cn("font-display text-2xl", picked.includes(i) && "opacity-30")}
                    onClick={() => setPicked([...picked, i])}>{w}</Button>
                ))}
              </div>
            )}
            {!result && <Button size="kid" disabled={!ready || busy} className="w-fit" onClick={() => void submit(question.kind === "letters" ? built.join("") : built.join(" "))}>Go!</Button>}
          </div>
        )}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className={cn("font-display text-2xl", result.correct ? "text-success" : "text-primary")}>
              {result.correct ? "✨ Gate open!" : result.shielded ? `🛡️ Shield saved you! (It was: ${result.answer})` : `💫 It was: ${result.answer}`}
            </p>
            <Button size="kid" variant={result.correct ? "success" : "default"} onClick={() => onDone(result)}>
              {result.correct ? "Go! ➜" : result.shielded ? "New question" : "Back to checkpoint"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
