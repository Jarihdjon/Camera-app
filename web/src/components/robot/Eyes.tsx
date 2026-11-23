import { useEffect, useState } from "react";
import { pivot } from "./pivot";
import { motion, useReducedMotion } from "motion/react";
import type { Mood } from "./RobotProvider";

const EYE_X = [80, 120];
const EYE_Y = 78;
const GLOW = "#ffc94d";

function star(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
  }
  return pts.join(" ");
}

/** Two glowing eyes on the face screen: blink, follow taps, and change shape with mood. */
export function Eyes({ mood, look }: { mood: Mood; look: { x: number; y: number } }) {
  const [blink, setBlink] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    let t: number;
    const schedule = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        schedule();
      }, 2000 + Math.random() * 4000);
    };
    schedule();
    return () => window.clearTimeout(t);
  }, [reduce]);

  const offset = mood === "thinking" ? { x: 5, y: -5 } : look;

  return (
    <motion.g animate={{ x: offset.x, y: offset.y }} transition={{ type: "spring", stiffness: 180, damping: 16 }} filter="url(#eyeGlow)">
      {EYE_X.map((cx, i) => (
        <motion.g
          key={cx}
          style={pivot(cx, EYE_Y)}
          animate={{ scaleY: blink && mood !== "sleepy" ? 0.1 : 1 }}
          transition={{ duration: 0.07 }}
        >
          {mood === "cheer" ? (
            <motion.polygon points={star(cx, EYE_Y, 12)} fill={GLOW} animate={{ rotate: [0, 18, 0] }} style={pivot(cx, EYE_Y)} transition={{ duration: 0.6, repeat: Infinity }} />
          ) : mood === "happy" || mood === "wave" ? (
            <path d={`M${cx - 10} ${EYE_Y + 4} Q${cx} ${EYE_Y - 10} ${cx + 10} ${EYE_Y + 4}`} stroke={GLOW} strokeWidth={6} strokeLinecap="round" fill="none" />
          ) : mood === "sleepy" ? (
            <path d={`M${cx - 9} ${EYE_Y + 2} Q${cx} ${EYE_Y + 7} ${cx + 9} ${EYE_Y + 2}`} stroke={GLOW} strokeWidth={5} strokeLinecap="round" fill="none" />
          ) : mood === "encourage" ? (
            <ellipse cx={cx} cy={EYE_Y + 1} rx={8} ry={10} fill={GLOW} />
          ) : (
            <rect x={cx - 7} y={EYE_Y - (mood === "thinking" && i === 0 ? 8 : 11)} width={14} height={mood === "thinking" && i === 0 ? 16 : 22} rx={7} fill={GLOW} />
          )}
          {/* Little highlight makes the eyes feel alive. */}
          {(mood === "idle" || mood === "thinking" || mood === "encourage") && <circle cx={cx + 3} cy={EYE_Y - 5} r={2.5} fill="#fff8e1" />}
        </motion.g>
      ))}
    </motion.g>
  );
}
