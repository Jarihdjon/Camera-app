import { useEffect, useState } from "react";
import { pivot } from "./pivot";
import { motion, useReducedMotion } from "motion/react";
import type { Mood } from "./RobotProvider";
import type { SvgIds } from "./look";

const EYE_X = [80, 120];
const EYE_Y = 78;

function star(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
  }
  return pts.join(" ");
}

/**
 * LED eyes on the face screen, drawn with a fine dot pattern like a pixel display.
 * They blink, follow taps and change shape with mood.
 */
export function Eyes({ mood, look, ids, halo }: { mood: Mood; look: { x: number; y: number }; ids: SvgIds; halo: string }) {
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
  const led = `url(#${ids.led})`;

  const shape = (cx: number, i: number, paint: string, haloLayer: boolean) => {
    const width = haloLayer ? 9 : 6;
    switch (mood) {
      case "cheer":
        return <polygon points={star(cx, EYE_Y, 13)} fill={paint} />;
      case "happy":
      case "wave":
        return <path d={`M${cx - 11} ${EYE_Y + 5} Q${cx} ${EYE_Y - 11} ${cx + 11} ${EYE_Y + 5}`} stroke={paint} strokeWidth={width + 1} strokeLinecap="round" fill="none" />;
      case "sleepy":
        return <path d={`M${cx - 10} ${EYE_Y + 2} Q${cx} ${EYE_Y + 8} ${cx + 10} ${EYE_Y + 2}`} stroke={paint} strokeWidth={width} strokeLinecap="round" fill="none" />;
      case "encourage":
        return <ellipse cx={cx} cy={EYE_Y + 1} rx={9} ry={11} fill={paint} />;
      default: {
        const small = mood === "thinking" && i === 0;
        return <rect x={cx - 9} y={EYE_Y - (small ? 8 : 12)} width={18} height={small ? 16 : 24} rx={8} fill={paint} />;
      }
    }
  };

  return (
    <motion.g animate={{ x: offset.x, y: offset.y }} transition={{ type: "spring", stiffness: 180, damping: 16 }}>
      {EYE_X.map((cx, i) => (
        <motion.g key={cx} style={pivot(cx, EYE_Y)} animate={{ scaleY: blink && mood !== "sleepy" ? 0.1 : 1 }} transition={{ duration: 0.07 }}>
          {/* Soft halo underneath, then the dotted LED layer on top. */}
          <g filter={`url(#${ids.glow})`} opacity={0.55}>{shape(cx, i, halo, true)}</g>
          {mood === "cheer" ? (
            <motion.g style={pivot(cx, EYE_Y)} animate={{ rotate: [0, 18, 0] }} transition={{ duration: 0.6, repeat: Infinity }}>{shape(cx, i, led, false)}</motion.g>
          ) : (
            shape(cx, i, led, false)
          )}
        </motion.g>
      ))}
    </motion.g>
  );
}
