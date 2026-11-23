import { useCallback, useEffect, useState } from "react";
import { api, type ChildUnit, type Wallet } from "./lib/api";
import { Onboarding } from "./screens/Onboarding";
import { Home } from "./screens/Home";
import { UnitPlayer } from "./screens/UnitPlayer";
import { Parent } from "./screens/Parent";
import { Build } from "./screens/Build";

type Screen = { name: "home" } | { name: "unit"; unit: ChildUnit } | { name: "build" } | { name: "parent" };

export function App() {
  const [child, setChild] = useState<Awaited<ReturnType<typeof api.child>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });

  const refresh = useCallback(() => api.child().then(setChild).catch((e: Error) => setError(e.message)), []);
  useEffect(() => void refresh(), [refresh]);

  const setWallet = (wallet: Wallet) => setChild((c) => (c ? { ...c, wallet } : c));

  if (error) return <div className="centre"><p>Can't reach the home computer. Is it on?</p><button onClick={() => { setError(null); void refresh(); }}>Try again</button></div>;
  if (!child) return <div className="centre"><p>Loading…</p></div>;
  if (!child.firstName || !child.robot.name) return <Onboarding onDone={refresh} hasName={Boolean(child.firstName)} />;

  switch (screen.name) {
    case "unit":
      return <UnitPlayer unit={screen.unit} robotName={child.robot.name} onWallet={setWallet} onDone={() => { setScreen({ name: "home" }); void refresh(); }} />;
    case "build":
      return <Build wallet={child.wallet} onBack={() => setScreen({ name: "home" })} />;
    case "parent":
      return <Parent onBack={() => setScreen({ name: "home" })} />;
    default:
      return (
        <Home
          firstName={child.firstName}
          robotName={child.robot.name}
          wallet={child.wallet}
          onStartUnit={(unit) => setScreen({ name: "unit", unit })}
          onBuild={() => setScreen({ name: "build" })}
          onParent={() => setScreen({ name: "parent" })}
        />
      );
  }
}
