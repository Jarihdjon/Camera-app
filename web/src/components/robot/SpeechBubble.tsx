import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useRobot } from "./RobotProvider";

/** Shows whatever the robot last said, popping in like a comic bubble. */
export function SpeechBubble({ name, className, fallback }: { name?: string; className?: string; fallback?: string }) {
  const { bubble, say } = useRobot();
  const text = bubble ?? fallback;
  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.button
          key={text}
          type="button"
          onClick={() => say(text)}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className={cn(
            "relative cursor-pointer rounded-3xl border border-white/15 bg-white/95 px-5 py-4 text-left text-lg font-semibold leading-snug text-slate-800 shadow-xl",
            "before:absolute before:-left-2 before:top-8 before:size-4 before:rotate-45 before:bg-white/95",
            className,
          )}
        >
          {name && <span className="mb-0.5 block font-display text-sm font-semibold uppercase tracking-wider text-orange-500">{name}</span>}
          {text}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
