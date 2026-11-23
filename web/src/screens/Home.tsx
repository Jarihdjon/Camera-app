import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { api, type ChildUnit, type Wallet } from "@/lib/api";
import { themeStyle } from "@/lib/themes";
import { Robot } from "@/components/robot/Robot";
import { useRobot } from "@/components/robot/RobotProvider";
import { SpeechBubble } from "@/components/robot/SpeechBubble";
import { WalletBar } from "@/components/WalletBar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Home(props: {
  firstName: string;
  robotName: string;
  parts: string[];
  wallet: Wallet;
  onStartUnit: (u: ChildUnit) => void;
  onBuild: () => void;
  onWorkshop: () => void;
  onParent: () => void;
}) {
  const [units, setUnits] = useState<ChildUnit[] | null>(null);
  const holdTimer = useRef<number>(undefined);
  const robot = useRobot();

  useEffect(() => {
    api.today().then((t) => setUnits(t.units)).catch(() => setUnits([]));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => robot.say(`Hi ${props.firstName}! Ready for today's mission?`, "wave"), 500);
    return () => window.clearTimeout(t);
    // Greet once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-5 pb-12 pt-5">
      <WalletBar wallet={props.wallet} />

      <div className="my-6 flex items-center gap-4">
        <button type="button" onClick={() => robot.say(`Hi ${props.firstName}! It's me, ${props.robotName}!`, "happy")} aria-label={`Talk to ${props.robotName}`}>
          <Robot size={190} parts={props.parts} />
        </button>
        <SpeechBubble name={props.robotName} className="max-w-md" />
      </div>

      <h2 className="mb-4 text-3xl text-glow">Today's mission</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {units === null && [0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-3xl bg-white/5" />)}
        {units?.map((u, i) => {
          const t = themeStyle(u.theme);
          return (
            <MissionCard key={u.id} delay={i * 0.12} glow={t.glow} onClick={() => props.onStartUnit(u)}>
              <Badge>Unit {String.fromCharCode(65 + i)}</Badge>
              <span className="text-5xl">{t.emoji}</span>
              <span className="font-display text-2xl font-semibold leading-tight">{u.title}</span>
              <span className="text-base text-muted-foreground">{t.label}</span>
            </MissionCard>
          );
        })}
        <MissionCard delay={0.3} glow="before:from-emerald-400/40 before:to-teal-300/10" onClick={props.onBuild}>
          <Badge variant="success">Build</Badge>
          <span className="text-5xl">🛰️</span>
          <span className="font-display text-2xl font-semibold">My space base</span>
          <span className="text-base text-muted-foreground">{props.wallet.blocks} blocks to spend</span>
        </MissionCard>
        <MissionCard delay={0.42} glow="before:from-orange-400/40 before:to-amber-300/10" onClick={props.onWorkshop}>
          <Badge>Workshop</Badge>
          <span className="text-5xl">🔧</span>
          <span className="font-display text-2xl font-semibold">Upgrade {props.robotName}</span>
          <span className="text-base text-muted-foreground">Capes, visors and boots</span>
        </MissionCard>
      </div>

      {/* Parent area: press and hold the corner for two seconds, then enter the PIN. */}
      <div className="fixed left-0 top-0 size-16" aria-label="Grown-ups"
        onPointerDown={() => { holdTimer.current = window.setTimeout(props.onParent, 2000); }}
        onPointerUp={() => window.clearTimeout(holdTimer.current)}
        onPointerLeave={() => window.clearTimeout(holdTimer.current)} />
    </div>
  );
}

function MissionCard({ children, delay, glow, onClick }: { children: React.ReactNode; delay: number; glow: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: [0, -6, 0] }}
      transition={{ opacity: { delay }, y: { delay, duration: 4, repeat: Infinity, ease: "easeInOut" } }}
      whileTap={{ scale: 0.95, rotate: -1.5 }}
      className={cn(
        "relative flex min-h-48 cursor-pointer flex-col items-start gap-2 overflow-hidden rounded-3xl border border-white/15 bg-card p-6 text-left shadow-2xl backdrop-blur-md",
        "before:absolute before:inset-0 before:-z-10 before:bg-gradient-to-br before:content-['']", glow,
      )}
    >
      {children}
    </motion.button>
  );
}
