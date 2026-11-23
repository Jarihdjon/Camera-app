import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api, type ChildUnit, type Wallet } from "@/lib/api";
import { RobotProvider } from "@/components/robot/RobotProvider";
import { RewardsProvider } from "@/components/rewards";
import { Starfield } from "@/components/Starfield";
import { Robot } from "@/components/robot/Robot";
import { Button } from "@/components/ui/button";
import { Onboarding } from "./screens/Onboarding";
import { Home } from "./screens/Home";
import { UnitPlayer } from "./screens/UnitPlayer";
import { Parent } from "./screens/Parent";
import { Build } from "./screens/Build";

type Screen = { name: "home" } | { name: "unit"; unit: ChildUnit } | { name: "build" } | { name: "parent" };
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
  const [screen, setScreen] = useState<Screen>({ name: "home" });

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

  const key = screen.name === "unit" ? `unit-${screen.unit.id}` : screen.name;
  return (
    <AnimatePresence mode="wait">
      <motion.div key={key} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
        {screen.name === "unit" ? (
          <UnitPlayer unit={screen.unit} firstName={child.firstName} robotName={child.robot.name} parts={child.robot.parts} wallet={child.wallet} onWallet={setWallet}
            onDone={() => { setScreen({ name: "home" }); void refresh(); }} />
        ) : screen.name === "build" ? (
          <Build wallet={child.wallet} onBack={() => setScreen({ name: "home" })} />
        ) : screen.name === "parent" ? (
          <Parent onBack={() => setScreen({ name: "home" })} />
        ) : (
          <Home firstName={child.firstName} robotName={child.robot.name} parts={child.robot.parts} wallet={child.wallet}
            onStartUnit={(unit) => setScreen({ name: "unit", unit })} onBuild={() => setScreen({ name: "build" })} onParent={() => setScreen({ name: "parent" })} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export function Centre({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">{children}</div>;
}
