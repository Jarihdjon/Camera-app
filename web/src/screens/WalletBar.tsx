import type { Wallet } from "../lib/api";

export function WalletBar({ wallet }: { wallet: Wallet }) {
  return (
    <div className="wallet">
      <span title="Play minutes">⏱ {wallet.minutes} min</span>
      <span title="Blocks">🧱 {wallet.blocks}</span>
      <span title="Word gems">💎 {wallet.gems}</span>
    </div>
  );
}
