import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Volume2 } from "lucide-react";
import type { MissionCharacter, MissionLine } from "@yav/shared/game";
import { say, stop } from "@/lib/speech";
import { Button } from "@/components/ui/button";
import { PORTRAIT } from "../Npc";

/**
 * A story conversation: one line at a time, with the speaker's portrait and name, read
 * aloud in their own voice. Tap Next (or anywhere on the box) to go on.
 */
export function Dialogue({ lines, characters, robotName, firstName, onDone }: {
  lines: MissionLine[];
  characters: MissionCharacter[];
  robotName: string;
  firstName: string;
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const line = lines[i];
  const who = line ? characters.find((c) => c.id === line.who) : undefined;
  // Lines are written about "Sparky"; use the robot's real name, and the child's name for {name}.
  const text = line ? line.line.replaceAll("Sparky", robotName).replaceAll("{name}", firstName) : "";
  const speak = () => {
    if (!line) return;
    if (who) say(text, "narrator", who.voice, who.id);
    else say(text, "robot", undefined, "sparky");
  };
  useEffect(() => {
    speak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  useEffect(() => () => stop(), []);
  if (!line) return null;
  const next = () => {
    if (i + 1 < lines.length) setI(i + 1);
    else {
      stop();
      onDone();
    }
  };
  const name = who?.name ?? robotName;
  const portrait = who ? PORTRAIT[who.kind] : PORTRAIT.sparky;
  const color = who?.color ?? "#ff8a3d";
  return (
    <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
      className="pointer-events-auto fixed inset-x-4 bottom-6 z-50 mx-auto max-w-3xl" role="dialog" data-dialogue aria-label={`${name} says`}>
      <div className="flex items-end gap-3">
        <motion.div key={`p${i}`} initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }}
          className="grid size-24 shrink-0 place-items-center rounded-3xl border-4 bg-[#fff7e6] text-6xl shadow-xl" style={{ borderColor: color }}>
          {portrait}
        </motion.div>
        <div className="flex-1 cursor-pointer rounded-[1.75rem] border-4 bg-[#fff7e6] p-5 text-[#2b2140] shadow-2xl" style={{ borderColor: color }} onClick={next}>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full px-3 py-0.5 font-display text-lg text-white" style={{ background: color }}>{name}</span>
            <span className="ml-auto text-sm text-[#2b2140]/60">{i + 1} / {lines.length}</span>
          </div>
          <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[1.45rem] leading-snug">{text}</motion.p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" size="lg" onClick={speak}><Volume2 /> Again</Button>
        <Button size="kid" variant="success" onClick={next}>{i + 1 < lines.length ? "Next ➜" : "OK! ➜"}</Button>
      </div>
    </motion.div>
  );
}
