import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Volume2 } from "lucide-react";
import { useRobot } from "@/components/robot/RobotProvider";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const PRAISE = ["Yes! Great thinking!", "Brilliant!", "You got it!", "Super smart!", "Awesome work!", "Spot on!"];
export const ENCOURAGE = ["Nearly! Let's look again.", "Good try! Here's a clue.", "Ooh, close! Try this hint."];
export const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]!;

/** Small uppercase label in the unit's colour, e.g. "Sort out · question 2 of 7". */
export function Kicker({ children }: { children: ReactNode }) {
  return <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-[var(--unit)]">{children}</p>;
}

/** A question line he can tap to hear. */
export function Prompt({ text, className }: { text: string; className?: string }) {
  const robot = useRobot();
  return (
    <button type="button" className={cn("flex cursor-pointer items-start gap-3 text-left font-display text-3xl font-medium leading-snug", className)} onClick={() => robot.say(text, "thinking")}>
      <span className="flex-1">{text}</span>
      <Volume2 className="mt-1 size-7 shrink-0 text-[var(--unit)]" />
    </button>
  );
}

export function StepCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn("gap-6 border-t-4 border-t-[var(--unit)] p-7", className)}>{children}</Card>;
}

/** Feedback strip: mint when right, warm and gentle otherwise. Never red. */
export function Feedback({ tone, children }: { tone: "good" | "try"; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-2xl px-5 py-3 text-xl", tone === "good" ? "bg-success/15 font-semibold text-success" : "border-2 border-dashed border-primary/60 bg-primary/10")}>
      {children}
    </motion.div>
  );
}

/** "Look again at paragraph 2", with the paragraph itself, so he never has to scroll back. */
export function Peek({ n, text }: { n: number; text: string }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="rounded-2xl border-l-[6px] border-[var(--unit)] bg-white/5 px-5 py-4 text-xl leading-relaxed">
      <p className="mb-1 font-display text-base font-semibold text-[var(--unit)]">Look again at paragraph {n + 1}</p>
      {text}
    </motion.div>
  );
}
