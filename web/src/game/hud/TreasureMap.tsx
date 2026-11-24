import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Mission } from "@yav/shared/game";

/**
 * Kip's treasure map. Each cleared beat puts its clue on the map; the dotted trail leads
 * to the X. Tap it to open the map and read every clue found so far.
 */
export function TreasureMap({ mission, found }: { mission: Mission; found: number }) {
  const [open, setOpen] = useState(false);
  const beats = mission.beats;
  // Clue spots wind down the map like a trail.
  const spots = beats.map((_, i) => ({ x: 14 + (i % 2 ? 46 : 0) + i * 3, y: 10 + i * 11 }));
  const map = (big: boolean) => (
    <svg viewBox="0 0 100 100" className={big ? "w-full" : "size-full"} aria-hidden>
      <defs>
        <linearGradient id="parch" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe7b5" />
          <stop offset="1" stopColor="#e9c98a" />
        </linearGradient>
      </defs>
      <path d="M4 6 L30 3 L55 7 L80 3 L96 6 L94 50 L97 94 L70 97 L45 93 L20 97 L3 94 L6 50 Z" fill="url(#parch)" stroke="#a8743f" strokeWidth="1.5" />
      <polyline points={[...spots, { x: 78, y: 90 }].map((s) => `${s.x},${s.y}`).join(" ")} fill="none" stroke="#a8743f" strokeWidth="1.2" strokeDasharray="2 2.5" />
      {spots.map((s, i) => (
        <g key={i}>
          <circle cx={s.x} cy={s.y} r={big ? 5 : 6} fill={i < found ? "#fff7e6" : "#d9b778"} stroke="#a8743f" strokeWidth="0.8" />
          {i < found ? (
            <text x={s.x} y={s.y + 2.4} fontSize={big ? 6.5 : 7.5} textAnchor="middle">{beats[i]!.clueIcon}</text>
          ) : (
            <text x={s.x} y={s.y + 2.2} fontSize="6" textAnchor="middle" fill="#a8743f">?</text>
          )}
        </g>
      ))}
      <text x="78" y="94" fontSize="16" textAnchor="middle" fill={found >= beats.length ? "#e0402a" : "#b08a5a"} fontWeight="bold">✕</text>
    </svg>
  );
  return (
    <>
      <button className="pointer-events-auto relative size-24 drop-shadow-xl" onClick={() => setOpen(true)} aria-label={`Treasure map: ${found} of ${beats.length} clues`}>
        {map(false)}
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2 font-display text-sm text-white">{found}/{beats.length}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-auto fixed inset-x-4 top-8 z-[55] mx-auto max-w-2xl rounded-[2rem] border-4 border-[#a8743f] bg-[#fbe7b5] p-5 text-[#3a2a1a] shadow-2xl"
            onClick={() => setOpen(false)}>
            <h2 className="font-display text-3xl">🗺️ {mission.title}</h2>
            <p className="mb-3 text-lg">{mission.goal}</p>
            <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
              <div>{map(true)}</div>
              <ol className="space-y-2 text-lg">
                {beats.map((b, i) => (
                  <li key={i} className={i < found ? "" : "opacity-40"}>
                    <span className="mr-2 text-2xl">{i < found ? b.clueIcon : "❔"}</span>
                    {i < found ? b.clue : "Clue still hidden…"}
                  </li>
                ))}
              </ol>
            </div>
            <p className="mt-3 text-right text-sm opacity-70">Tap to close</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
