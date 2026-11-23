import { useState } from "react";
import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { PART_SLOTS, ROBOT_PARTS, resolveLook, type PartSlot } from "@yav/shared/robotParts";
import { api, type RobotState } from "@/lib/api";
import { Robot } from "@/components/robot/Robot";
import { useRobot } from "@/components/robot/RobotProvider";
import { SpeechBubble } from "@/components/robot/SpeechBubble";
import { celebrate } from "@/components/rewards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SLOT_LABEL: Record<PartSlot, string> = { cape: "Capes", visor: "Visors", boots: "Boots" };
const ICON: Record<string, string> = {
  "cape-orange": "🧡", "cape-stars": "⭐", "cape-lightning": "⚡",
  "visor-teal": "🟦", "visor-galaxy": "🌌", "visor-matrix": "🟩",
  "boots-hover": "🥾", "boots-rocket": "🚀", "boots-wheels": "🛞",
};

/** The robot workshop: wear any part he has unlocked with word gems. Locked parts show how close he is. */
export function Workshop({ robotState, onChange, onBack }: { robotState: RobotState; onChange: (r: RobotState) => void; onBack: () => void }) {
  const robot = useRobot();
  const [busy, setBusy] = useState(false);
  const wearing = resolveLook(robotState.parts);

  async function wear(partId: string, label: string) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.equip(partId);
      onChange(r.robot);
      void celebrate();
      robot.say(`Ooh, ${label}! How do I look?`, "cheer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-12 pt-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="lg" onClick={onBack}>← Back</Button>
        <h1 className="text-4xl text-glow">{robotState.name}'s workshop</h1>
      </div>

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <button type="button" onClick={() => robot.say(`I'm ${robotState.name}! Earn gems by tapping words to unlock new parts.`, "wave")}>
            <Robot size={240} parts={robotState.parts} />
          </button>
          <SpeechBubble name={robotState.name ?? undefined} fallback="Tap a part to try it on!" />
          <p className="font-display text-xl">💎 {robotState.gemsEarned} gems earned</p>
        </div>

        <div className="flex flex-col gap-5">
          {PART_SLOTS.map((slot) => (
            <Card key={slot} className="gap-3 p-5">
              <h2 className="text-2xl">{SLOT_LABEL[slot]}</h2>
              <div className="grid grid-cols-3 gap-3">
                {ROBOT_PARTS.filter((p) => p.slot === slot).map((p, i) => {
                  const unlocked = robotState.unlocked.includes(p.id);
                  const on = wearing[slot] === p.id;
                  const toGo = p.gems - robotState.gemsEarned;
                  return (
                    <motion.button
                      key={p.id}
                      type="button"
                      disabled={!unlocked || on}
                      onClick={() => void wear(p.id, p.label)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      whileTap={unlocked ? { scale: 0.94 } : {}}
                      className={cn(
                        "relative flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 bg-white/5 p-4 text-center",
                        on ? "border-primary bg-primary/15 shadow-[0_0_20px_rgba(255,201,77,0.35)]" : "border-white/10",
                        !unlocked && "cursor-default opacity-60",
                      )}
                    >
                      <span className={cn("text-4xl", !unlocked && "grayscale")}>{ICON[p.id]}</span>
                      <span className="font-display text-lg leading-tight">{p.label}</span>
                      {on ? <span className="text-sm font-bold text-primary">Wearing</span>
                        : unlocked ? <span className="text-sm text-success">Tap to wear</span>
                        : <span className="flex items-center gap-1 text-sm text-muted-foreground"><Lock className="size-3.5" /> {toGo} more 💎</span>}
                    </motion.button>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
