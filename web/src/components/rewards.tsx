import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

/**
 * Rewards that fly from where he earned them into the wallet pill, so every gem
 * and block feels physical. Wallet pills register their position with data-wallet="gems" etc.
 */
type Kind = "gems" | "blocks" | "minutes";
const ICON: Record<Kind, string> = { gems: "💎", blocks: "🧱", minutes: "⏱️" };

interface Flyer { id: number; kind: Kind; from: { x: number; y: number }; to: { x: number; y: number } }
const Ctx = createContext<(kind: Kind, from: { x: number; y: number }, count?: number) => void>(() => {});

export function RewardsProvider({ children }: { children: ReactNode }) {
  const [flyers, setFlyers] = useState<Flyer[]>([]);

  const fly = useCallback((kind: Kind, from: { x: number; y: number }, count = 1) => {
    const target = document.querySelector(`[data-wallet="${kind}"]`)?.getBoundingClientRect();
    const to = target ? { x: target.left + target.width / 2, y: target.top + target.height / 2 } : { x: window.innerWidth - 60, y: 40 };
    const items = Array.from({ length: Math.min(count, 6) }, (_, i) => ({ id: Date.now() + Math.random() + i, kind, from, to }));
    setFlyers((f) => [...f, ...items]);
  }, []);

  return (
    <Ctx.Provider value={fly}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-50">
        <AnimatePresence>
          {flyers.map((f, i) => (
            <motion.span
              key={f.id}
              className="absolute text-3xl drop-shadow-[0_0_10px_rgba(255,220,120,0.9)]"
              initial={{ x: f.from.x - 16, y: f.from.y - 16, scale: 0.4, opacity: 0 }}
              animate={{
                x: [f.from.x - 16, (f.from.x + f.to.x) / 2 - 16 + (i % 2 ? 40 : -40), f.to.x - 16],
                y: [f.from.y - 16, Math.min(f.from.y, f.to.y) - 120, f.to.y - 16],
                scale: [0.4, 1.4, 0.7],
                opacity: [0, 1, 1],
              }}
              transition={{ duration: 0.9, delay: (i % 6) * 0.08, ease: "easeInOut" }}
              onAnimationComplete={() => setFlyers((all) => all.filter((x) => x.id !== f.id))}
            >
              {ICON[f.kind]}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useFlyReward = () => useContext(Ctx);

export function pointFrom(e: { clientX: number; clientY: number } | Element | null): { x: number; y: number } {
  if (!e) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  if ("clientX" in e) return { x: e.clientX, y: e.clientY };
  const r = e.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Confetti is loaded only when first needed, to keep the first load small. */
export async function celebrate(big = false) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#ffc94d", "#7cf0d8", "#ff8a3d", "#ff6f91", "#b69cff"];
  if (!big) {
    void confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 }, colors, scalar: 1.1 });
    return;
  }
  const end = Date.now() + 1200;
  (function frame() {
    void confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors });
    void confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
