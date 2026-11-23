import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { api, type ChildActivity, type Wallet } from "@/lib/api";
import { useRobot } from "@/components/robot/RobotProvider";
import { useAsk } from "@/components/ask/AskSparky";
import { celebrate, pointFrom, useFlyReward } from "@/components/rewards";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Feedback, Kicker, StepCard } from "./shared";

type Gaps = Extract<ChildActivity, { kind: "gap-fill" }>;

/** Tap a word, then tap its blank (or the other way round). Two words are decoys. */
export function GapFill({ unitId, activity, onWallet, onNext }: { unitId: string; activity: Gaps; onWallet: (w: Wallet) => void; onNext: () => void }) {
  const [placed, setPlaced] = useState<(number | null)[]>(activity.sentences.map(() => null));
  const [word, setWord] = useState<number | null>(null);
  const [blank, setBlank] = useState<number | null>(null);
  const [misses, setMisses] = useState<number[]>(activity.sentences.map(() => 0));
  const [wobble, setWobble] = useState<{ w: number; b: number; n: number } | null>(null);
  const robot = useRobot();
  const ask = useAsk();
  const fly = useFlyReward();
  useEffect(() => ask.setScreen({ activityId: activity.id, prompt: activity.prompt }), [activity.id, activity.prompt, ask]);

  const used = placed.filter((p): p is number => p !== null);
  const allDone = placed.every((p) => p !== null);

  async function tryPlace(w: number, b: number, el: Element | null) {
    setWord(null);
    setBlank(null);
    const r = await api.attempt({ unitId, activityId: activity.id, answer: activity.bank[w]!, blank: b, tryNumber: misses[b]! + 1 });
    onWallet(r.wallet);
    if (r.correct) {
      const next = placed.map((p, i) => (i === b ? w : p));
      setPlaced(next);
      fly("blocks", pointFrom(el));
      if (next.every((p) => p !== null)) {
        void celebrate();
        robot.say("All the gaps are filled! The leftover words were the tricky decoys.", "cheer");
      } else robot.say("Yes, that fits!", "happy");
    } else {
      setMisses((m) => m.map((x, i) => (i === b ? x + 1 : x)));
      setWobble({ w, b, n: Date.now() });
      robot.say(`Hmm, "${activity.bank[w]}" doesn't fit there. Read the sentence with it. Does it make sense?`, "encourage");
    }
  }

  return (
    <StepCard>
      <Kicker>Sort out · fill the gaps</Kicker>
      <h2 className="font-display text-3xl">{activity.prompt}</h2>
      <p className="text-lg text-muted-foreground">Tap a word, then tap its gap. Two words are decoys and don't fit anywhere.</p>

      <div className="flex flex-wrap gap-3">
        {activity.bank.map((w, i) => {
          const isUsed = used.includes(i);
          return (
            <motion.button
              key={w}
              type="button"
              disabled={isUsed || allDone}
              animate={wobble?.w === i ? { x: [0, -8, 8, -5, 5, 0] } : {}}
              transition={{ duration: 0.4 }}
              whileTap={{ scale: 0.92 }}
              onClick={(e) => (blank !== null ? void tryPlace(i, blank, e.currentTarget) : setWord(word === i ? null : i))}
              className={cn(
                "min-h-14 cursor-pointer rounded-2xl border-2 px-5 font-display text-2xl font-semibold transition",
                word === i ? "border-[var(--unit)] bg-[var(--unit)] text-white shadow-[0_0_20px_var(--unit)]" : "border-[var(--unit)]/70 bg-white/5",
                isUsed && "border-dashed opacity-30",
              )}
            >
              {w}
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-col">
        {activity.sentences.map((s, i) => {
          const [before, after] = s.text.split("___");
          const p = placed[i];
          return (
            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 py-3 text-2xl leading-relaxed">
              <span>{before}</span>
              {p !== null && p !== undefined ? (
                <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="rounded-xl border-2 border-success bg-success/15 px-4 py-1 font-display font-semibold text-success">{activity.bank[p]}</motion.span>
              ) : (
                <motion.button
                  type="button"
                  aria-label={`Gap ${i + 1}`}
                  animate={wobble?.b === i ? { x: [0, -8, 8, -5, 5, 0] } : {}}
                  onClick={(e) => (word !== null ? void tryPlace(word, i, e.currentTarget) : setBlank(blank === i ? null : i))}
                  className={cn("h-12 min-w-36 cursor-pointer rounded-xl border-[3px] border-dashed bg-black/30", blank === i ? "border-[var(--unit)] bg-[var(--unit)]/20" : "border-muted-foreground/60")}
                />
              )}
              <span>{after}</span>
            </div>
          );
        })}
      </div>

      {allDone && (
        <>
          <Feedback tone="good">All {activity.sentences.length} fit! The leftover words were the decoys.</Feedback>
          <Button size="kid" variant="success" className="w-fit" onClick={onNext}>Next ➜</Button>
        </>
      )}
    </StepCard>
  );
}
