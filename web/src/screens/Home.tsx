import { useEffect, useRef, useState } from "react";
import { api, type ChildUnit, type Wallet } from "../lib/api";
import { say } from "../lib/speech";
import { Robot } from "./Robot";
import { WalletBar } from "./WalletBar";

export function Home(props: {
  firstName: string;
  robotName: string;
  wallet: Wallet;
  onStartUnit: (u: ChildUnit) => void;
  onBuild: () => void;
  onParent: () => void;
}) {
  const [units, setUnits] = useState<ChildUnit[] | null>(null);
  const holdTimer = useRef<number>(undefined);

  useEffect(() => {
    api.today().then((t) => setUnits(t.units)).catch(() => setUnits([]));
  }, []);

  const greet = () => say(`Hi ${props.firstName}! It's ${props.robotName}. Ready for today's mission?`);

  return (
    <div className="screen">
      <WalletBar wallet={props.wallet} />
      <div className="hero" onClick={greet}>
        <Robot size={160} mood="happy" />
        <div className="bubble">Hi {props.firstName}! Ready for today's mission?</div>
      </div>
      <h2>Today's mission</h2>
      <div className="cards">
        {units === null && <p className="muted">Loading…</p>}
        {units?.map((u, i) => (
          <button key={u.id} className="card" onClick={() => props.onStartUnit(u)}>
            <span className="tag">Unit {String.fromCharCode(65 + i)}</span>
            <strong>{u.title}</strong>
            <span className="muted">{u.theme}</span>
          </button>
        ))}
        <button className="card build" onClick={props.onBuild}>
          <span className="tag">Build</span>
          <strong>My world</strong>
          <span className="muted">{props.wallet.blocks} blocks to spend</span>
        </button>
      </div>
      {/* Parent area: press and hold the corner for two seconds, then enter the PIN. */}
      <div className="parent-corner" aria-label="Grown-ups"
        onPointerDown={() => { holdTimer.current = window.setTimeout(props.onParent, 2000); }}
        onPointerUp={() => window.clearTimeout(holdTimer.current)}
        onPointerLeave={() => window.clearTimeout(holdTimer.current)} />
    </div>
  );
}
