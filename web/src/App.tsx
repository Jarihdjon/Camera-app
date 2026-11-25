import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api, type ChildUnit, type Levels, type Wallet } from "@/lib/api";
import { RobotProvider } from "@/components/robot/RobotProvider";
import { RewardsProvider } from "@/components/rewards";
import { Starfield } from "@/components/Starfield";
import { Robot } from "@/components/robot/Robot";
import { Button } from "@/components/ui/button";
import { Onboarding } from "./screens/Onboarding";
import { UnitPlayer, type StageInfo } from "./screens/UnitPlayer";
import { Parent } from "./screens/Parent";
import { Build } from "./screens/Build";
import { Workshop } from "./screens/Workshop";
import { Hub } from "./screens/Hub";

// The 3D game is loaded only when it opens, so the first load stays small.
const Game = lazy(() => import("./game/Game").then((m) => ({ default: m.Game })));
const Arcade = lazy(() => import("./arcade/Arcade").then((m) => ({ default: m.Arcade })));
import { ChapterMap } from "./screens/ChapterMap";

type Screen =
  | { name: "game" }
  | { name: "hub"; unlocked?: string | null }
  | { name: "chapter"; id: string; justUnlocked?: string | null }
  | { name: "unit"; unit: ChildUnit; stage?: StageInfo; initial?: { step: number; state: Record<string, unknown> } | null; levels?: Levels }
  | { name: "build" }
  | { name: "parent" }
  | { name: "workshop" }
  | { name: "arcade" };
type Child = Awaited<ReturnType<typeof api.child>>;

export function App() {
  return (
    <RobotProvider>
      <RewardsProvider>
        <Starfield />
        <Shell />
      </RewardsProvider>
    </RobotProvider>
  );
}

function Shell() {
  const [child, setChild] = useState<Child | null>(null);
  const [error, setError] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: "game" });

  const refresh = useCallback(() => api.child().then(setChild).catch(() => setError(true)), []);
  useEffect(() => void refresh(), [refresh]);
  const setWallet = (wallet: Wallet) => setChild((c) => (c ? { ...c, wallet } : c));

  if (error)
    return (
      <Centre>
        <Robot mood="sleepy" size={180} />
        <h1 className="text-3xl">Can't reach the home computer</h1>
        <p className="text-muted-foreground">Is it switched on?</p>
        <Button size="kid" onClick={() => { setError(false); void refresh(); }}>Try again</Button>
      </Centre>
    );
  if (!child) return <Centre><Robot mood="thinking" size={160} /></Centre>;
  if (!child.firstName || !child.robot.name) return <Onboarding onDone={refresh} hasName={Boolean(child.firstName)} />;

  const openStage = async (chapterId: string, stageId: string) => {
    const r = await api.stage(chapterId, stageId);
    setScreen({ name: "unit", unit: r.unit, stage: { chapterId, stageId, kind: r.kind, part: r.part, tier: r.tier, progressId: r.progressId }, initial: r.progress, levels: r.levels });
  };
  const home = () => setScreen({ name: "game" });

  const key = screen.name === "unit" ? `unit-${screen.unit.id}` : screen.name === "chapter" ? `chapter-${screen.id}` : screen.name;
  return (
    <AnimatePresence mode="wait">
      <motion.div key={key} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
        {screen.name === "game" ? (
          <Suspense fallback={<Centre><Robot mood="thinking" size={160} /><p className="font-display text-2xl">Loading Sky Dock…</p></Centre>}>
            <Game firstName={child.firstName} robotName={child.robot.name} wallet={child.wallet} onWallet={setWallet}
              onWorkshop={() => setScreen({ name: "workshop" })} onArcade={() => setScreen({ name: "arcade" })} onParent={() => setScreen({ name: "parent" })} />
          </Suspense>
        ) : screen.name === "arcade" ? (
          <Suspense fallback={<Centre><Robot mood="thinking" size={160} /><p className="font-display text-2xl">Opening the Arcade…</p></Centre>}>
            <Arcade robotName={child.robot.name ?? "Sparky"} wallet={child.wallet} onWallet={setWallet} onBack={home} />
          </Suspense>
        ) : screen.name === "unit" ? (
          <UnitPlayer unit={screen.unit} firstName={child.firstName} robotName={child.robot.name} parts={child.robot.parts} wallet={child.wallet}
            stage={screen.stage} initial={screen.initial} levels={screen.levels} onWallet={setWallet}
            onDone={(result) => {
              void refresh();
              const st = screen.stage;
              if (!st) return home();
              if (result?.unlockedChapter) return setScreen({ name: "hub", unlocked: result.unlockedChapter.id });
              setScreen({ name: "chapter", id: st.chapterId, justUnlocked: result?.unlockedStage ?? null });
            }} />
        ) : screen.name === "chapter" ? (
          <ChapterMap chapterId={screen.id} robotName={child.robot.name} parts={child.robot.parts} justUnlocked={screen.justUnlocked}
            onStage={(c, s) => void openStage(c, s)} onBack={home} />
        ) : screen.name === "build" ? (
          <Build wallet={child.wallet} onBack={home} />
        ) : screen.name === "workshop" ? (
          <Workshop robotState={child.robot} onChange={(robot) => setChild((c) => (c ? { ...c, robot } : c))} onBack={home} />
        ) : screen.name === "parent" ? (
          <Parent onBack={home} />
        ) : (
          <Hub firstName={child.firstName} robotName={child.robot.name} parts={child.robot.parts} wallet={child.wallet} unlocked={screen.unlocked}
            onChapter={(c) => setScreen({ name: "chapter", id: c.id })}
            onResume={(c, s) => void openStage(c, s)}
            onWorkshop={() => setScreen({ name: "workshop" })} onBuild={() => setScreen({ name: "build" })} onParent={() => setScreen({ name: "parent" })} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export function Centre({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">{children}</div>;
}
