import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Square, Volume2 } from "lucide-react";
import type { Passage } from "@yav/shared";
import { paragraphs } from "@yav/shared/childHelpers";
import { api, type Wallet } from "@/lib/api";
import { useRobot } from "@/components/robot/RobotProvider";
import { useAsk } from "@/components/ask/AskSparky";
import { pointFrom, useFlyReward } from "@/components/rewards";
import { onSpeech } from "@/lib/speech";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Kicker, StepCard } from "./unit/shared";

const clean = (s: string) => s.toLowerCase().replace(/[^a-z'-]/g, "").replace(/^'+|'+$/g, "");

/**
 * Find out: the story. Every word is tappable, and asking always earns a gem.
 * Workbook words are explained from the glossary; any other word is explained
 * by the robot using the sentence it's in, so the meaning fits the story.
 */
export function WordHunter({ passage, initial, onState, onWallet, onNext }: { passage: Passage; initial?: string[]; onState?: (tapped: string[]) => void; onWallet: (w: Wallet) => void; onNext: () => void }) {
  const [tapped, setTapped] = useState<Set<string>>(new Set(initial ?? []));
  useEffect(() => onState?.([...tapped]), [tapped, onState]);
  const [reading, setReading] = useState<number | null>(null);
  const [looking, setLooking] = useState<string | null>(null);
  const glossary = new Map(passage.glossary.map((g) => [g.word.toLowerCase(), g.meaning]));
  const paras = paragraphs(passage.text);
  const robot = useRobot();
  const ask = useAsk();
  const fly = useFlyReward();
  const readToken = useRef(0);

  useEffect(() => ask.setScreen({ prompt: passage.text }), [passage.text, ask]);
  useEffect(() => () => {
    readToken.current++;
    robot.stop();
    // Stop reading when leaving the story.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Read the story aloud in the narrator voice, highlighting each paragraph; tap again to stop. */
  function readAloud() {
    if (reading !== null) {
      readToken.current++;
      setReading(null);
      robot.stop();
      return;
    }
    const token = ++readToken.current;
    const next = (i: number) => {
      if (token !== readToken.current) return;
      if (i >= paras.length) return setReading(null);
      setReading(i);
      const off = onSpeech((e) => {
        if (e.type === "end") {
          off();
          window.setTimeout(() => next(i + 1), 600);
        }
      });
      robot.read(paras[i]!);
    };
    next(0);
  }

  async function tap(raw: string, sentence: string, el: Element) {
    const word = clean(raw);
    if (!word || looking) return;
    setTapped((s) => new Set(s).add(word));
    fly("gems", pointFrom(el));
    const meaning = glossary.get(word);
    const display = raw.replace(/[^A-Za-z'-]/g, "");
    if (meaning) {
      robot.say(`${display}. ${meaning}`, "happy");
    } else {
      setLooking(word);
      robot.setMood("thinking");
      try {
        robot.say(`${display}. ${await ask.explainWord(display, sentence)}`, "happy");
      } catch {
        robot.say(`${display}! Great word to ask about. I've saved it in your Word Vault.`, "happy");
      } finally {
        setLooking(null);
      }
    }
    onWallet((await api.tapWord(word, meaning)).wallet);
  }

  return (
    <StepCard>
      <Kicker>Find out · read the story</Kicker>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-4xl">{passage.title}</h2>
        <Button variant="secondary" size="lg" onClick={readAloud}>
          {reading !== null ? <><Square /> Stop</> : <><Volume2 /> Read it to me</>}
        </Button>
      </div>
      <p className="text-lg text-muted-foreground">Tap any word you're not sure about. Asking always earns a 💎</p>

      <div className="flex flex-col gap-4 rounded-2xl bg-black/30 p-6">
        {paras.map((p, pi) => {
          const sentences = p.match(/[^.!?]+[.!?”"]*\s*/g) ?? [p];
          return (
            <motion.p key={pi} animate={{ backgroundColor: reading === pi ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0)" }}
              className="-mx-3 rounded-xl px-3 py-1 text-[1.6rem] leading-[2.1]">
              {sentences.map((sentence, si) =>
                sentence.split(/(\s+)/).map((tok, i) => {
                  if (!tok || /^\s+$/.test(tok)) return tok;
                  const w = clean(tok);
                  return (
                    <motion.span
                      key={`${si}-${i}`}
                      whileTap={{ scale: 1.25 }}
                      onClick={(e) => void tap(tok, sentence.trim(), e.currentTarget)}
                      className={cn(
                        "cursor-pointer rounded-lg px-0.5 transition-colors",
                        tapped.has(w) && "bg-primary/25 text-primary shadow-[0_0_14px_rgba(255,201,77,0.45)]",
                        looking === w && "animate-pulse",
                      )}
                    >
                      {tok}
                    </motion.span>
                  );
                }),
              )}
            </motion.p>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <span className="font-display text-lg text-muted-foreground">{tapped.size ? `${tapped.size} word${tapped.size > 1 ? "s" : ""} hunted 💎` : ""}</span>
        <Button size="kid" variant="success" onClick={onNext}>I've read it ➜</Button>
      </div>
    </StepCard>
  );
}
