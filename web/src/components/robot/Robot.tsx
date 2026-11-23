import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { pivot } from "./pivot";
import { Eyes } from "./Eyes";
import { Mouth } from "./Mouth";
import { useRobot, type Mood } from "./RobotProvider";

/**
 * The robot companion: an original design with a cream TV-style head, orange bolt ears,
 * a bulb antenna, a teal face screen, a round orange body with a chest light and a
 * hover booster underneath. Parts unlock as he learns (phase 1).
 */
const C = {
  shell: "#f6ecda",
  shellShade: "#e2cfb0",
  trim: "#ff8a3d",
  trimDark: "#d9622a",
  screen: "#0d3a44",
  screenEdge: "#082a31",
  bulb: "#7cf0d8",
};

export function Robot({ size = 160, className, mood: moodOverride, parts = [] }: { size?: number; className?: string; mood?: Mood; parts?: string[] }) {
  const robot = useRobot();
  const mood = moodOverride ?? robot.mood;
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });

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

  const bob = reduce
    ? {}
    : mood === "cheer"
      ? { y: [0, -26, 0, -18, 0], rotate: [0, -4, 4, -2, 0] }
      : mood === "sleepy"
        ? { y: [0, 3, 0] }
        : { y: [0, -7, 0] };
  const bobTransition = mood === "cheer" ? { duration: 1.1, repeat: Infinity } : { duration: mood === "sleepy" ? 4 : 3, repeat: Infinity, ease: "easeInOut" as const };
  const headTilt = mood === "thinking" ? 7 : mood === "encourage" ? -5 : 0;
  const boosting = mood === "cheer";

  return (
    <div ref={ref} className={cn("relative inline-block", className)} style={{ width: size, height: size * 1.1 }}>
      <svg viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label="Your robot" overflow="visible">
        <defs>
          <filter id="eyeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="shell" cx="35%" cy="25%" r="80%">
            <stop offset="0%" stopColor="#fffaf0" />
            <stop offset="70%" stopColor={C.shell} />
            <stop offset="100%" stopColor={C.shellShade} />
          </radialGradient>
          <radialGradient id="body" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffb27a" />
            <stop offset="100%" stopColor={C.trimDark} />
          </radialGradient>
          <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12505c" />
            <stop offset="100%" stopColor={C.screen} />
          </linearGradient>
          <radialGradient id="flame" cx="50%" cy="0%" r="100%">
            <stop offset="0%" stopColor="#fff6c2" />
            <stop offset="45%" stopColor="#ffb340" />
            <stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ground shadow shrinks as he rises. */}
        <motion.ellipse cx={100} cy={214} rx={46} ry={6} fill="#000" opacity={0.35} animate={reduce ? {} : { scaleX: mood === "cheer" ? [1, 0.6, 1, 0.75, 1] : [1, 0.85, 1] }} transition={bobTransition} style={pivot(100, 214)} />

        <motion.g animate={bob} transition={bobTransition}>
          {/* Hover booster, or wheels once unlocked. */}
          {parts.includes("wheels") ? (
            <g>{[72, 128].map((x) => <circle key={x} cx={x} cy={192} r={13} fill="#2b2f45" stroke={C.trim} strokeWidth={4} />)}</g>
          ) : (
            <g>
              <AnimatePresence>
                {boosting && (
                  <motion.path d="M84 190 Q100 250 116 190 Z" fill="url(#flame)" initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: [0.8, 1.2, 0.9, 1.1], opacity: 1 }} exit={{ scaleY: 0, opacity: 0 }}
                    transition={{ duration: 0.3, repeat: Infinity, repeatType: "mirror" }} style={pivot(100, 190)} />
                )}
              </AnimatePresence>
              <path d="M78 180 L122 180 L114 194 L86 194 Z" fill="#3a3f5c" />
              <motion.ellipse cx={100} cy={194} rx={14} ry={3.5} fill={C.bulb} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.6, repeat: Infinity }} filter="url(#eyeGlow)" />
            </g>
          )}

          {/* Jetpack tanks (unlockable). */}
          {parts.includes("jetpack") && [56, 144].map((x) => <rect key={x} x={x - 9} y={138} width={18} height={36} rx={8} fill="#9aa3c7" stroke="#5d6690" strokeWidth={3} />)}

          {/* Arms: the left one waves. */}
          <motion.g style={pivot(58, 146)} animate={mood === "wave" ? { rotate: [0, -50, -20, -50, -20, 0] } : mood === "cheer" ? { rotate: -120 } : { rotate: 0 }} transition={{ duration: mood === "wave" ? 1.6 : 0.4 }}>
            <path d="M58 146 Q40 156 38 172" stroke={C.shellShade} strokeWidth={9} strokeLinecap="round" fill="none" />
            <circle cx={38} cy={176} r={9} fill="url(#shell)" stroke={C.trim} strokeWidth={3} />
          </motion.g>
          <motion.g style={pivot(142, 146)} animate={mood === "cheer" ? { rotate: 120 } : { rotate: 0 }} transition={{ duration: 0.4 }}>
            <path d="M142 146 Q160 156 162 172" stroke={C.shellShade} strokeWidth={9} strokeLinecap="round" fill="none" />
            <circle cx={162} cy={176} r={9} fill="url(#shell)" stroke={C.trim} strokeWidth={3} />
          </motion.g>

          {/* Body with a chest light that pulses like a heartbeat. */}
          <ellipse cx={100} cy={156} rx={44} ry={32} fill="url(#body)" stroke={C.trimDark} strokeWidth={3} />
          <rect x={84} y={146} width={32} height={20} rx={7} fill={C.screenEdge} />
          <motion.path d="M100 162 l-7 -7 a4.2 4.2 0 0 1 7 -4.5 a4.2 4.2 0 0 1 7 4.5 z" fill="#ff6f91" animate={reduce ? {} : { scale: [1, 1.18, 1] }} transition={{ duration: 1.2, repeat: Infinity }} style={pivot(100, 156)} />

          {/* Head group tilts with mood. */}
          <motion.g animate={{ rotate: headTilt }} transition={{ type: "spring", stiffness: 120, damping: 12 }} style={pivot(100, 120)}>
            {/* Spring antenna with a glowing bulb. */}
            <motion.g style={pivot(100, 40)} animate={reduce ? {} : { rotate: mood === "cheer" ? [-18, 18, -18] : [-6, 6, -6] }} transition={{ duration: mood === "cheer" ? 0.5 : 2.4, repeat: Infinity, ease: "easeInOut" }}>
              <path d="M100 40 q-5 -4 0 -8 q5 -4 0 -8 q-5 -4 0 -8" stroke={C.trimDark} strokeWidth={3} fill="none" strokeLinecap="round" />
              <motion.circle cx={100} cy={11} r={7} fill={C.bulb} filter="url(#eyeGlow)" animate={{ opacity: robot.speaking ? [0.6, 1, 0.6] : [0.75, 1, 0.75] }} transition={{ duration: robot.speaking ? 0.4 : 2, repeat: Infinity }} />
            </motion.g>

            {/* Bolt ears. */}
            {[34, 166].map((x) => (
              <g key={x}>
                <circle cx={x} cy={82} r={13} fill={C.trim} stroke={C.trimDark} strokeWidth={3} />
                <motion.g style={pivot(x, 82)} animate={reduce ? {} : { rotate: robot.speaking ? 360 : 0 }} transition={{ duration: 2, repeat: robot.speaking ? Infinity : 0, ease: "linear" }}>
                  <path d={`M${x - 5} 82 h10 M${x} 77 v10`} stroke={C.trimDark} strokeWidth={3} strokeLinecap="round" />
                </motion.g>
              </g>
            ))}

            {/* TV-style head and face screen. */}
            <rect x={40} y={38} width={120} height={90} rx={32} fill="url(#shell)" stroke={C.trim} strokeWidth={5} />
            <rect x={54} y={52} width={92} height={62} rx={20} fill="url(#screen)" stroke={C.screenEdge} strokeWidth={3} />
            <path d="M62 60 Q80 54 100 56" stroke="#ffffff" strokeOpacity={0.18} strokeWidth={4} strokeLinecap="round" fill="none" />

            <Eyes mood={mood} look={look} />
            <Mouth mood={mood} speaking={robot.speaking} open={robot.mouth} />

            {/* Cheeks glow when happy. */}
            {(mood === "happy" || mood === "cheer" || mood === "wave") && [66, 134].map((x) => <circle key={x} cx={x} cy={98} r={5} fill="#ff6f91" opacity={0.55} />)}
          </motion.g>
        </motion.g>

        {mood === "sleepy" && (
          <motion.text x={150} y={40} fill="#cfd6ff" fontSize={20} fontWeight={700} animate={{ y: [40, 20], opacity: [0, 1, 0] }} transition={{ duration: 2.2, repeat: Infinity }}>z</motion.text>
        )}
      </svg>
    </div>
  );
}
