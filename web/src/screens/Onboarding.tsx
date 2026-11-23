import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import { Robot } from "@/components/robot/Robot";
import { useRobot } from "@/components/robot/RobotProvider";
import { SpeechBubble } from "@/components/robot/SpeechBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Centre } from "../App";
import { celebrate } from "@/components/rewards";

/** Day one: a grown-up types his first name, then the robot powers on and he names it. */
export function Onboarding({ onDone, hasName }: { onDone: () => void; hasName: boolean }) {
  const [value, setValue] = useState("");
  const [powered, setPowered] = useState(!hasName);
  const robot = useRobot();
  const step = hasName ? "robot" : "name";

  useEffect(() => {
    if (step === "robot" && !powered) {
      const t = window.setTimeout(() => {
        setPowered(true);
        robot.say("Beep boop! I just woke up. What's my name?", "wave");
      }, 900);
      return () => window.clearTimeout(t);
    }
  }, [step, powered, robot]);

  // The robot reacts as he types its name.
  useEffect(() => {
    if (step === "robot" && powered && value.length > 0) robot.setMood("happy");
  }, [value, step, powered, robot]);

  async function save() {
    const v = value.trim();
    if (!v) return;
    await api.setChild(step === "name" ? { firstName: v } : { robotName: v });
    if (step === "robot") {
      void celebrate(true);
      robot.say(`${v}! I love it! Let's go on an adventure!`, "cheer");
      await new Promise((r) => setTimeout(r, 1800));
    }
    setValue("");
    onDone();
  }

  return (
    <Centre>
      <motion.div
        initial={{ opacity: 0, scale: 0.6, filter: "brightness(0.2)" }}
        animate={powered ? { opacity: 1, scale: 1, filter: "brightness(1)" } : { opacity: 0.6, scale: 0.9, filter: "brightness(0.35)" }}
        transition={{ type: "spring", stiffness: 120, damping: 12 }}
      >
        <Robot size={220} mood={powered ? undefined : "sleepy"} />
      </motion.div>
      {step === "robot" && powered && <SpeechBubble />}
      <h1 className="text-4xl text-glow">{step === "name" ? "Who is learning today?" : "Give your robot a name!"}</h1>
      <p className="text-muted-foreground">{step === "name" ? "Grown-ups: type his first name. Only the first name is ever used." : "You can pick any name you like."}</p>
      <Input className="h-16 max-w-md rounded-2xl text-center font-display text-3xl" value={value} onChange={(e) => setValue(e.target.value)} maxLength={30} autoFocus
        onKeyDown={(e) => e.key === "Enter" && void save()} />
      <Button size="kid" onClick={() => void save()} disabled={!value.trim()}>{step === "name" ? "Next" : "That's the name!"}</Button>
    </Centre>
  );
}
