import { pivot } from "./pivot";
import { motion, useSpring, useTransform, type MotionValue } from "motion/react";
import type { Mood } from "./RobotProvider";

const CX = 100;
const CY = 99;
const COLOUR = "#ffc94d";

/** While speaking, the mouth opens and closes with the lip-sync. Otherwise it shows the mood. */
export function Mouth({ mood, speaking, open }: { mood: Mood; speaking: boolean; open: MotionValue<number> }) {
  const smooth = useSpring(open, { stiffness: 900, damping: 30 });
  const ry = useTransform(smooth, (v) => 1.8 + v * 8);
  const rx = useTransform(smooth, (v) => 9 - v * 2);

  if (speaking) {
    return (
      <g filter="url(#eyeGlow)">
        <motion.ellipse cx={CX} cy={CY} rx={rx} ry={ry} fill="#2a0f05" stroke={COLOUR} strokeWidth={3} />
      </g>
    );
  }
  const d =
    mood === "cheer" ? `M${CX - 13} ${CY - 3} Q${CX} ${CY + 16} ${CX + 13} ${CY - 3} Z`
    : mood === "happy" || mood === "wave" ? `M${CX - 11} ${CY - 2} Q${CX} ${CY + 10} ${CX + 11} ${CY - 2}`
    : mood === "thinking" ? `M${CX - 2} ${CY + 1} Q${CX + 5} ${CY - 2} ${CX + 10} ${CY + 1}`
    : mood === "sleepy" ? `M${CX - 6} ${CY + 1} L${CX + 6} ${CY + 1}`
    : `M${CX - 8} ${CY - 1} Q${CX} ${CY + 6} ${CX + 8} ${CY - 1}`;
  return (
    <motion.path
      key={mood}
      d={d}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      style={pivot(CX, CY)}
      fill={mood === "cheer" ? "#2a0f05" : "none"}
      stroke={COLOUR}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      filter="url(#eyeGlow)"
    />
  );
}
