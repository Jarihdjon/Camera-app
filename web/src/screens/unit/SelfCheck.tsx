import { useState } from "react";
import { motion } from "motion/react";
import { SELF_CHECK_ITEMS } from "@yav/shared/childHelpers";
import { api, type Wallet } from "@/lib/api";
import { useRobot } from "@/components/robot/RobotProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Kicker, StepCard } from "./shared";

const CHOICES = [
  { label: "Yes!", emoji: "😃" },
  { label: "Getting there", emoji: "🙂" },
  { label: "Not yet", emoji: "🤔" },
];

/** How did I do? Three statements, three friendly choices. Saved for the parent area. */
export function SelfCheck({ unitId, onWallet, onNext }: { unitId: string; onWallet: (w: Wallet) => void; onNext: () => void }) {
  const [picks, setPicks] = useState<(number | null)[]>(SELF_CHECK_ITEMS.map(() => null));
  const robot = useRobot();
  const all = picks.every((p) => p !== null);

  async function finish() {
    const text = SELF_CHECK_ITEMS.map((s, i) => `${s} ${CHOICES[picks[i]!]!.label}`).join("\n");
    const r = await api.respond({ unitId, kind: "self-check", text });
    onWallet(r.wallet);
    onNext();
  }

  return (
    <StepCard>
      <Kicker>Take action · how did I do?</Kicker>
      <h2 className="font-display text-3xl">How did I do?</h2>
      {SELF_CHECK_ITEMS.map((s, i) => (
        <div key={s} className="flex flex-col gap-3 border-b border-white/10 pb-4">
          <button type="button" className="cursor-pointer text-left text-2xl" onClick={() => robot.say(s)}>{s} 🔊</button>
          <div className="flex flex-wrap gap-3">
            {CHOICES.map((c, j) => (
              <motion.button key={c.label} type="button" whileTap={{ scale: 0.93 }}
                onClick={() => setPicks((p) => p.map((x, k) => (k === i ? j : x)))}
                className={cn("flex min-h-14 cursor-pointer items-center gap-2 rounded-full border-2 px-5 text-xl", picks[i] === j ? "border-[var(--unit)] bg-[var(--unit)] font-semibold text-white" : "border-white/15 bg-white/5")}>
                <span className="text-2xl">{c.emoji}</span>{c.label}
              </motion.button>
            ))}
          </div>
        </div>
      ))}
      <Button size="kid" variant="success" className="w-fit" disabled={!all} onClick={() => void finish()}>Finish the unit 🚀</Button>
    </StepCard>
  );
}
