import { pivot } from "./pivot";
import { motion, useSpring, useTransform, type MotionValue } from "motion/react";
import type { Mood } from "./RobotProvider";
import type { SvgIds } from "./look";

const CX = 100;
const CY = 100;

/** LED mouth. While speaking it opens and closes with the lip-sync; otherwise it shows the mood. */
export function Mouth({ mood, speaking, open, ids, halo }: { mood: Mood; speaking: boolean; open: MotionValue<number>; ids: SvgIds; halo: string }) {
  const smooth = useSpring(open, { stiffness: 900, damping: 30 });
  const ry = useTransform(smooth, (v) => 2 + v * 8);
  const rx = useTransform(smooth, (v) => 10 - v * 2);
  const led = `url(#${ids.led})`;

  if (speaking) {
    return (
      <g>
        <motion.ellipse cx={CX} cy={CY} rx={rx} ry={ry} fill="none" stroke={halo} strokeWidth={6} filter={`url(#${ids.glow})`} opacity={0.6} />
        <motion.ellipse cx={CX} cy={CY} rx={rx} ry={ry} fill="#00000066" stroke={led} strokeWidth={4} />
      </g>
    );
  }
  const d =
    mood === "cheer" ? `M${CX - 14} ${CY - 3} Q${CX} ${CY + 17} ${CX + 14} ${CY - 3} Z`
    : mood === "happy" || mood === "wave" ? `M${CX - 12} ${CY - 2} Q${CX} ${CY + 11} ${CX + 12} ${CY - 2}`
    : mood === "thinking" ? `M${CX - 2} ${CY + 1} Q${CX + 5} ${CY - 2} ${CX + 11} ${CY + 1}`
    : mood === "sleepy" ? `M${CX - 7} ${CY + 1} L${CX + 7} ${CY + 1}`
    : `M${CX - 9} ${CY - 1} Q${CX} ${CY + 7} ${CX + 9} ${CY - 1}`;
  return (
    <motion.g key={mood} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} style={pivot(CX, CY)}>
      <path d={d} fill="none" stroke={halo} strokeWidth={7} strokeLinecap="round" filter={`url(#${ids.glow})`} opacity={0.6} />
      <path d={d} fill={mood === "cheer" ? led : "none"} stroke={led} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    </motion.g>
  );
}
