import type { Wallet } from "../lib/api";

/** Phase 1 builds the three.js block world here, after the week-one iPad performance test. */
export function Build({ wallet, onBack }: { wallet: Wallet; onBack: () => void }) {
  return (
    <div className="centre stack">
      <h1>My space base</h1>
      <p>You have {wallet.blocks} blocks.</p>
      <p className="muted">The block builder is coming next.</p>
      <button onClick={onBack}>Back</button>
    </div>
  );
}
