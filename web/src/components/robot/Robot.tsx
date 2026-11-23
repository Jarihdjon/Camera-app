import { useId, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { resolveLook } from "@yav/shared/robotParts";
import { cn } from "@/lib/utils";
import { pivot } from "./pivot";
import { Eyes } from "./Eyes";
import { Mouth } from "./Mouth";
import { capeOf, visorOf, type SvgIds } from "./look";
import { useRobot, type Mood } from "./RobotProvider";

/**
 * The robot companion. An original design: a cream TV-style head with orange bolt
 * ears and a bulb antenna, an LED face screen, a round orange body with a heartbeat
 * light, a flowing cape, and hands and feet that float on their own. Cape, visor and
 * boots are swappable parts Yav unlocks with word gems.
 */
const C = {
  shell: "#f6ecda",
  shellShade: "#dcc7a6",
  trim: "#ff8a3d",
  trimDark: "#d9622a",
  bulb: "#7cf0d8",
};

/** Cape outlines share the same commands so motion can morph between them. */
const CAPE = {
  restA: "M80 124 C 70 150, 60 176, 54 198 Q 100 210 146 198 C 140 176, 130 150, 120 124 Z",
  restB: "M80 124 C 68 152, 56 178, 48 196 Q 98 214 142 202 C 138 178, 130 150, 120 124 Z",
  restC: "M80 124 C 72 150, 64 176, 60 200 Q 104 208 152 194 C 142 174, 130 150, 120 124 Z",
  // Streaming out behind him when he jumps or jets off.
  flyA: "M80 124 C 56 134, 26 146, 2 164 Q 14 190 46 200 C 76 180, 104 152, 120 124 Z",
  flyB: "M80 124 C 54 128, 22 136, 0 150 Q 8 178 40 192 C 74 176, 104 150, 120 124 Z",
};

export function Robot({ size = 160, className, mood: moodOverride, parts = [] }: { size?: number; className?: string; mood?: Mood; parts?: string[] }) {
  const robot = useRobot();
  const mood = moodOverride ?? robot.mood;
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids: SvgIds = {
    glow: `${uid}glow`, led: `${uid}led`, shell: `${uid}shell`, body: `${uid}body`,
    screen: `${uid}screen`, flame: `${uid}flame`, cape: `${uid}cape`, screenDots: `${uid}dots`,
  };
  const wear = resolveLook(parts);
  const visor = visorOf(wear);
  const cape = capeOf(wear);

  // Eyes follow his last tap.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !robot.lastTap) return;
    const r = el.getBoundingClientRect();
    const dx = robot.lastTap.x - (r.left + r.width / 2);
    const dy = robot.lastTap.y - (r.top + r.height * 0.35);
    const len = Math.hypot(dx, dy) || 1;
    setLook({ x: (dx / len) * 6, y: (dy / len) * 4 });
    const t = window.setTimeout(() => setLook({ x: 0, y: 0 }), 2500);
    return () => window.clearTimeout(t);
  }, [robot.lastTap]);

  const cheering = mood === "cheer";
  const bob = reduce ? {} : cheering ? { y: [0, -26, 0, -18, 0], rotate: [0, -4, 4, -2, 0] } : mood === "sleepy" ? { y: [0, 3, 0] } : { y: [0, -7, 0] };
  const bobTransition = cheering ? { duration: 1.1, repeat: Infinity } : { duration: mood === "sleepy" ? 4 : 3, repeat: Infinity, ease: "easeInOut" as const };
  const headTilt = mood === "thinking" ? 7 : mood === "encourage" ? -5 : 0;

  // Floating hands: each drifts on its own rhythm; they rise for a cheer and the left one waves.
  const hand = (side: -1 | 1) => {
    const base = side === -1 ? { x: 0, y: 0 } : { x: 0, y: 0 };
    if (reduce) return { animate: base, transition: {} };
    if (cheering) return { animate: { x: side * 10, y: [-56, -64, -56] }, transition: { duration: 0.4, repeat: Infinity } };
    if (mood === "wave" && side === -1) return { animate: { x: [0, -4, 6, -4, 6, 0], y: [0, -58, -54, -58, -54, 0], rotate: [0, -20, 15, -20, 15, 0] }, transition: { duration: 1.8 } };
    return { animate: { y: [0, -5, 0] }, transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const, delay: side === -1 ? 0.2 : 0.9 } };
  };
  const foot = (delay: number) =>
    reduce ? {} : { animate: { y: cheering ? [4, 10, 4] : [0, 3, 0] }, transition: { duration: cheering ? 0.4 : 2.2, repeat: Infinity, ease: "easeInOut" as const, delay } };

  const glowCss = `drop-shadow(0 0 14px ${visor.halo})`;

  return (
    <div ref={ref} className={cn("relative inline-block", className)} style={{ width: size, height: size * 1.1 }}>
      <svg viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label="Your robot" overflow="visible" style={{ filter: glowCss }}>
        <defs>
          <filter id={ids.glow} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
          {/* LED dot matrix for the eyes and mouth. */}
          <pattern id={ids.led} width={2.6} height={2.6} patternUnits="userSpaceOnUse">
            <circle cx={1.3} cy={1.3} r={1.05} fill={visor.led} />
          </pattern>
          <pattern id={ids.screenDots} width={3} height={3} patternUnits="userSpaceOnUse">
            <circle cx={1.5} cy={1.5} r={0.6} fill="#ffffff" opacity={0.09} />
          </pattern>
          <radialGradient id={ids.shell} cx="32%" cy="22%" r="85%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor={C.shell} />
            <stop offset="100%" stopColor={C.shellShade} />
          </radialGradient>
          <radialGradient id={ids.body} cx="32%" cy="25%" r="80%">
            <stop offset="0%" stopColor="#ffc49a" />
            <stop offset="45%" stopColor="#ff8f45" />
            <stop offset="100%" stopColor={C.trimDark} />
          </radialGradient>
          <linearGradient id={ids.screen} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={visor.top} />
            <stop offset="100%" stopColor={visor.bottom} />
          </linearGradient>
          <radialGradient id={ids.flame} cx="50%" cy="0%" r="100%">
            <stop offset="0%" stopColor="#fff6c2" />
            <stop offset="45%" stopColor="#ffb340" />
            <stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" />
          </radialGradient>
          <pattern id={ids.cape} width={200} height={220} patternUnits="userSpaceOnUse">
            <rect width={200} height={220} fill={cape.dark} />
            <rect width={200} height={150} y={110} fill={cape.light} opacity={0.55} />
            {cape.pattern === "stars" &&
              ([[70, 150], [100, 170], [128, 148], [84, 190], [118, 194], [40, 175], [20, 160], [150, 180]] as [number, number][]).map(([x, y]) => (
                <path key={`${x}-${y}`} d={`M${x} ${y - 5} l1.5 3.5 3.8 .3 -2.9 2.5 .9 3.7 -3.3 -2 -3.3 2 .9 -3.7 -2.9 -2.5 3.8 -.3z`} fill={cape.trim} />
              ))}
            {cape.pattern === "lightning" && (
              <path d="M96 132 L84 164 L98 162 L88 196 L114 154 L100 156 L110 132 Z M40 150 L30 172 L40 170 L32 192 L52 164 L42 166 L50 150 Z" fill={cape.trim} />
            )}
          </pattern>
        </defs>

        {/* Ground shadow shrinks as he rises. */}
        <motion.ellipse cx={100} cy={216} rx={44} ry={5.5} fill="#000" opacity={0.35} style={pivot(100, 216)}
          animate={reduce ? {} : { scaleX: cheering ? [1, 0.6, 1, 0.75, 1] : [1, 0.85, 1] }} transition={bobTransition} />

        <motion.g animate={bob} transition={bobTransition}>
          {/* Cape: gentle flutter at rest, streaming out when he jumps. */}
          <motion.path
            d={CAPE.restA}
            fill={`url(#${ids.cape})`}
            stroke={cape.trim}
            strokeWidth={2.5}
            strokeLinejoin="round"
            animate={reduce ? {} : { d: cheering ? [CAPE.flyA, CAPE.flyB, CAPE.flyA] : [CAPE.restA, CAPE.restB, CAPE.restA, CAPE.restC, CAPE.restA] }}
            transition={{ duration: cheering ? 0.5 : 3.2, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Floating feet (or wheels), with booster flames when he jumps. */}
          {[82, 118].map((x, i) => (
            <motion.g key={x} {...foot(i * 0.4)}>
              <AnimatePresence>
                {cheering && wear.boots !== "boots-wheels" && (
                  <motion.path d={`M${x - 7} 206 Q${x} 240 ${x + 7} 206 Z`} fill={`url(#${ids.flame})`} style={pivot(x, 206)}
                    initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: [0.8, 1.25, 0.9, 1.1], opacity: 1 }} exit={{ scaleY: 0, opacity: 0 }}
                    transition={{ duration: 0.25, repeat: Infinity, repeatType: "mirror" }} />
                )}
              </AnimatePresence>
              {wear.boots === "boots-wheels" ? (
                <g>
                  <circle cx={x} cy={200} r={10} fill="#2b2f45" stroke={C.trim} strokeWidth={4} />
                  <motion.path d={`M${x - 5} 200 h10 M${x} 195 v10`} stroke="#9aa3c7" strokeWidth={2.5} strokeLinecap="round" style={pivot(x, 200)}
                    animate={reduce ? {} : { rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
                </g>
              ) : (
                <g>
                  <ellipse cx={x} cy={198} rx={12} ry={9} fill={wear.boots === "boots-rocket" ? `url(#${ids.body})` : `url(#${ids.shell})`} stroke={C.trimDark} strokeWidth={2.5} />
                  <rect x={x - 10} y={203} width={20} height={4} rx={2} fill={wear.boots === "boots-rocket" ? "#9aa3c7" : C.trim} />
                  {wear.boots === "boots-rocket" && <path d={`M${x + (i ? 9 : -9)} 194 l${i ? 7 : -7} -6 v12 z`} fill="#ffd36b" />}
                  <ellipse cx={x - 4} cy={194} rx={3.5} ry={2} fill="#fff" opacity={0.7} />
                  <motion.ellipse cx={x} cy={208} rx={6} ry={1.6} fill={C.bulb} filter={`url(#${ids.glow})`} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3 }} />
                </g>
              )}
            </motion.g>
          ))}

          {/* Body with a chest light that pulses like a heartbeat, and a glossy highlight. */}
          <ellipse cx={100} cy={156} rx={42} ry={31} fill={`url(#${ids.body})`} stroke={C.trimDark} strokeWidth={3} />
          <ellipse cx={84} cy={140} rx={15} ry={6.5} fill="#fff" opacity={0.45} transform="rotate(-18 84 140)" />
          <rect x={84} y={147} width={32} height={20} rx={7} fill={visor.edge} />
          <motion.path d="M100 163 l-7 -7 a4.2 4.2 0 0 1 7 -4.5 a4.2 4.2 0 0 1 7 4.5 z" fill="#ff6f91" style={pivot(100, 157)}
            animate={reduce ? {} : { scale: [1, 1.18, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          {/* Cape clasp. */}
          <circle cx={100} cy={127} r={5} fill={cape.trim} stroke={C.trimDark} strokeWidth={1.5} />

          {/* Floating hands. */}
          {([-1, 1] as const).map((side) => {
            const x = side === -1 ? 46 : 154;
            const h = hand(side);
            return (
              <motion.g key={side} animate={h.animate} transition={h.transition} style={pivot(x, 160)}>
                <circle cx={x} cy={160} r={11} fill={`url(#${ids.shell})`} stroke={C.trim} strokeWidth={3} />
                <ellipse cx={x + side * -8} cy={154} rx={4.5} ry={6} fill={`url(#${ids.shell})`} stroke={C.trim} strokeWidth={2.5} transform={`rotate(${side * 25} ${x + side * -8} 154)`} />
                <circle cx={x - 3.5} cy={156} r={2.8} fill="#fff" opacity={0.8} />
              </motion.g>
            );
          })}

          {/* Head group tilts with mood. */}
          <motion.g animate={{ rotate: headTilt }} transition={{ type: "spring", stiffness: 120, damping: 12 }} style={pivot(100, 120)}>
            {/* Spring antenna with a glowing bulb. */}
            <motion.g style={pivot(100, 40)} animate={reduce ? {} : { rotate: cheering ? [-18, 18, -18] : [-6, 6, -6] }} transition={{ duration: cheering ? 0.5 : 2.4, repeat: Infinity, ease: "easeInOut" }}>
              <path d="M100 40 q-5 -4 0 -8 q5 -4 0 -8 q-5 -4 0 -8" stroke={C.trimDark} strokeWidth={3} fill="none" strokeLinecap="round" />
              <circle cx={100} cy={11} r={10} fill={C.bulb} opacity={0.35} filter={`url(#${ids.glow})`} />
              <motion.circle cx={100} cy={11} r={7} fill={C.bulb} animate={{ opacity: robot.speaking ? [0.6, 1, 0.6] : [0.8, 1, 0.8] }} transition={{ duration: robot.speaking ? 0.4 : 2, repeat: Infinity }} />
              <circle cx={97.5} cy={8.5} r={2.2} fill="#fff" opacity={0.9} />
            </motion.g>

            {/* Bolt ears. */}
            {[34, 166].map((x) => (
              <g key={x}>
                <circle cx={x} cy={82} r={13} fill={`url(#${ids.body})`} stroke={C.trimDark} strokeWidth={3} />
                <motion.g style={pivot(x, 82)} animate={reduce ? {} : { rotate: robot.speaking ? 360 : 0 }} transition={{ duration: 2, repeat: robot.speaking ? Infinity : 0, ease: "linear" }}>
                  <path d={`M${x - 5} 82 h10 M${x} 77 v10`} stroke={C.trimDark} strokeWidth={3} strokeLinecap="round" />
                </motion.g>
              </g>
            ))}

            {/* Glossy TV-style head. */}
            <rect x={40} y={38} width={120} height={90} rx={32} fill={`url(#${ids.shell})`} stroke={C.trim} strokeWidth={5} />
            <rect x={44} y={42} width={112} height={82} rx={28} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={1.5} />
            <ellipse cx={70} cy={46} rx={20} ry={5} fill="#fff" opacity={0.75} transform="rotate(-8 70 46)" />
            <circle cx={147} cy={58} r={3} fill="#fff" opacity={0.7} />

            {/* LED face screen. */}
            <rect x={54} y={52} width={92} height={62} rx={20} fill={`url(#${ids.screen})`} stroke={visor.edge} strokeWidth={3} />
            <rect x={54} y={52} width={92} height={62} rx={20} fill={`url(#${ids.screenDots})`} />
            <path d="M62 60 Q82 54 104 56" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={4} strokeLinecap="round" fill="none" />

            <Eyes mood={mood} look={look} ids={ids} halo={visor.led} />
            <Mouth mood={mood} speaking={robot.speaking} open={robot.mouth} ids={ids} halo={visor.led} />

            {/* Cheeks glow when happy. */}
            {(mood === "happy" || cheering || mood === "wave") && [64, 136].map((x) => <circle key={x} cx={x} cy={99} r={5} fill="#ff6f91" opacity={0.5} filter={`url(#${ids.glow})`} />)}
          </motion.g>
        </motion.g>

        {mood === "sleepy" && (
          <motion.text x={150} y={40} fill="#cfd6ff" fontSize={20} fontWeight={700} animate={{ y: [40, 20], opacity: [0, 1, 0] }} transition={{ duration: 2.2, repeat: Infinity }}>z</motion.text>
        )}
      </svg>
    </div>
  );
}
