import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import type { Wallet } from "@/lib/api";

function Counter({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, delay: 0.7, ease: "easeOut" });
    return () => c.stop();
  }, [mv, value]);
  return <motion.span>{rounded}</motion.span>;
}

const PILLS = [
  { key: "minutes", icon: "⏱️", label: "Play minutes", suffix: " min", ring: "ring-glow/40" },
  { key: "blocks", icon: "🧱", label: "Blocks", suffix: "", ring: "ring-orange-400/40" },
  { key: "gems", icon: "💎", label: "Word gems", suffix: "", ring: "ring-pink/40" },
] as const;

export function WalletBar({ wallet }: { wallet: Wallet }) {
  return (
    <div className="flex justify-end gap-3">
      {PILLS.map((p) => (
        <motion.div
          key={`${p.key}-${wallet[p.key]}`}
          data-wallet={p.key}
          title={p.label}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1, 1.25, 1] }}
          transition={{ duration: 1.2, times: [0, 0.6, 0.8, 1] }}
          className={`flex items-center gap-2 rounded-full bg-black/35 px-4 py-2 font-display text-xl font-semibold ring-2 backdrop-blur ${p.ring}`}
        >
          <span aria-hidden>{p.icon}</span>
          <Counter value={wallet[p.key]} />
          {p.suffix && <span className="text-base text-muted-foreground">{p.suffix.trim()}</span>}
        </motion.div>
      ))}
    </div>
  );
}
