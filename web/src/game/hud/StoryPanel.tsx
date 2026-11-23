import { motion } from "motion/react";
import { Volume2, X } from "lucide-react";
import { paragraphs } from "@yav/shared/childHelpers";
import type { PackView } from "@yav/shared/game";
import { useRobot } from "@/components/robot/RobotProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const clean = (s: string) => s.toLowerCase().replace(/[^a-z'-]/g, "");

/** The Story Stone: the level's reading passage. Tap any word to hear it; topic words get their meaning. */
export function StoryPanel({ pack, onClose }: { pack: PackView; onClose: () => void }) {
  const robot = useRobot();
  const gloss = new Map(pack.glossary.map((g) => [g.word.toLowerCase(), g.meaning]));
  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="pointer-events-auto fixed inset-x-4 top-6 bottom-6 z-50 mx-auto flex max-w-3xl flex-col gap-3 overflow-hidden rounded-[2rem] border-2 border-amber-200/50 bg-[#2b2140]/95 p-6 shadow-2xl">
      <div className="flex items-center gap-3">
        <span className="text-4xl">📖</span>
        <h2 className="flex-1 font-display text-3xl">{pack.passage.title}</h2>
        <Button variant="secondary" size="lg" onClick={() => robot.say(pack.passage.text, "happy")}><Volume2 /> Read it to me</Button>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X /></Button>
      </div>
      <p className="text-base text-muted-foreground">Tap any word you're not sure about. The Read gate will ask about this story.</p>
      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl bg-black/25 p-5 text-[1.55rem] leading-[2.1]">
        {paragraphs(pack.passage.text).map((p, i) => (
          <p key={i}>
            {p.split(/(\s+)/).map((tok, k) => {
              if (/^\s*$/.test(tok)) return tok;
              const m = gloss.get(clean(tok));
              return (
                <span key={k} onClick={() => robot.say(m ? `${tok.replace(/[^A-Za-z'-]/g, "")}. ${m}` : tok.replace(/[^A-Za-z'-]/g, ""), "happy")}
                  className={cn("cursor-pointer rounded px-0.5", m && "bg-amber-300/20 text-amber-200 underline decoration-dotted")}>
                  {tok}
                </span>
              );
            })}
          </p>
        ))}
      </div>
      <Button size="kid" variant="success" className="w-fit self-end" onClick={onClose}>Let's go! ➜</Button>
    </motion.div>
  );
}
