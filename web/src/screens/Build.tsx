import { motion } from "motion/react";
import type { Wallet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Centre } from "../App";

/** Phase 1 builds the block world here, after the week-one iPad performance test. */
export function Build({ wallet, onBack }: { wallet: Wallet; onBack: () => void }) {
  return (
    <Centre>
      <motion.span className="text-8xl" animate={{ rotate: [0, 8, -8, 0], y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity }}>🛰️</motion.span>
      <Card className="max-w-lg items-center text-center">
        <h1 className="text-4xl text-glow">My space base</h1>
        <p className="text-xl">You have <strong className="text-primary">{wallet.blocks}</strong> blocks saved up!</p>
        <p className="text-muted-foreground">The block builder is being built right now. Keep earning blocks!</p>
        <Button size="kid" onClick={onBack}>Back to base</Button>
      </Card>
    </Centre>
  );
}
