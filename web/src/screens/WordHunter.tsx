import { useState } from "react";
import { motion } from "motion/react";
import { Volume2 } from "lucide-react";
import type { Passage } from "@yav/shared";
import { api, type Wallet } from "@/lib/api";
import { useRobot } from "@/components/robot/RobotProvider";
import { pointFrom, useFlyReward } from "@/components/rewards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const clean = (s: string) => s.toLowerCase().replace(/[^a-z'-]/g, "");

/**
 * Word Hunter: every word is tappable. Tapping always earns a gem and never
 * costs anything, so asking about words becomes the winning move.
 */
export function WordHunter({ passage, onWallet, onNext }: { passage: Passage; onWallet: (w: Wallet) => void; onNext: () => void }) {
  const [tapped, setTapped] = useState<Set<string>>(new Set());
  const glossary = new Map(passage.glossary.map((g) => [g.word.toLowerCase(), g.meaning]));
  const robot = useRobot();
  const fly = useFlyReward();

  async function tap(raw: string, el: Element) {
    const word = clean(raw);
    if (!word) return;
    const meaning = glossary.get(word);
    const display = raw.replace(/[^A-Za-z'-]/g, "");
    robot.say(meaning ? `${display}. ${meaning}` : `${display}! Great word to ask about. I've saved it in your Word Vault.`, meaning ? "happy" : "thinking");
    setTapped((s) => new Set(s).add(word));
    fly("gems", pointFrom(el));
    onWallet((await api.tapWord(word, meaning)).wallet);
  }

  return (
    <Card className="gap-5 p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl">{passage.title}</h2>
        <Button variant="secondary" size="lg" onClick={() => robot.say(passage.text, "happy")}><Volume2 /> Read it to me</Button>
      </div>
      <p className="text-lg text-muted-foreground">Tap any word you're not sure about. Every tap earns a 💎</p>
      <p className="rounded-2xl bg-black/30 p-6 text-[1.6rem] leading-[2.2]">
        {passage.text.split(/(\s+)/).map((tok, i) => {
          if (/\s+/.test(tok)) return tok;
          const w = clean(tok);
          const isTapped = tapped.has(w);
          return (
            <motion.span
              key={i}
              whileTap={{ scale: 1.25 }}
              onClick={(e) => void tap(tok, e.currentTarget)}
              className={cn("cursor-pointer rounded-lg px-0.5 transition-colors", isTapped && "bg-primary/25 text-primary shadow-[0_0_14px_rgba(255,201,77,0.45)]")}
            >
              {tok}
            </motion.span>
          );
        })}
      </p>
      <div className="flex items-center justify-between">
        <span className="font-display text-lg text-muted-foreground">{tapped.size ? `${tapped.size} word${tapped.size > 1 ? "s" : ""} hunted 💎` : ""}</span>
        <Button size="kid" variant="success" onClick={onNext}>I've read it ➜</Button>
      </div>
    </Card>
  );
}
