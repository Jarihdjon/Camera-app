import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Lock } from "lucide-react";

/**
 * A chapter planet: a shaded sphere in the chapter's two colours with drifting surface
 * bands, an optional ring, and a padlock when it isn't unlocked yet.
 */
export function Planet({ colors, ring, size = 150, locked = false, glow = false }: { colors: [string, string]; ring?: boolean; size?: number; locked?: boolean; glow?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const reduce = useReducedMotion();
  const [light, dark] = colors;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {glow && !locked && (
        <motion.div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 ${size / 3}px ${light}` }}
          animate={reduce ? {} : { opacity: [0.35, 0.8, 0.35] }} transition={{ duration: 2.6, repeat: Infinity }} />
      )}
      <svg viewBox="0 0 100 100" width={size} height={size} overflow="visible" style={{ filter: locked ? "grayscale(0.85) brightness(0.55)" : undefined }}>
        <defs>
          <radialGradient id={`${id}s`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="18%" stopColor={light} />
            <stop offset="100%" stopColor={dark} />
          </radialGradient>
          <clipPath id={`${id}c`}><circle cx="50" cy="50" r="40" /></clipPath>
        </defs>
        {ring && <ellipse cx="50" cy="54" rx="56" ry="13" fill="none" stroke={light} strokeOpacity="0.55" strokeWidth="4" transform="rotate(-14 50 54)" />}
        <circle cx="50" cy="50" r="40" fill={`url(#${id}s)`} />
        <g clipPath={`url(#${id}c)`}>
          {/* Surface bands drift across, so the planet seems to turn. */}
          <motion.g animate={reduce || locked ? {} : { x: [-20, 20] }} transition={{ duration: 14, repeat: Infinity, repeatType: "mirror", ease: "linear" }}>
            <path d="M-10 38 Q25 30 60 38 T130 38" stroke={dark} strokeOpacity="0.35" strokeWidth="6" fill="none" />
            <path d="M-10 58 Q30 66 70 58 T140 58" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="5" fill="none" />
            <circle cx="30" cy="68" r="5" fill={dark} opacity="0.35" />
            <circle cx="64" cy="30" r="3.5" fill={dark} opacity="0.3" />
            <circle cx="80" cy="64" r="4" fill="#ffffff" opacity="0.15" />
          </motion.g>
          <circle cx="62" cy="62" r="40" fill="#000" opacity="0.18" />
        </g>
        {ring && <path d="M-4 61 A56 13 -14 0 0 104 40" fill="none" stroke={light} strokeOpacity="0.85" strokeWidth="4" transform="rotate(-14 50 54) rotate(14 50 54)" />}
      </svg>
      {locked && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-full bg-black/60 ring-2 ring-white/30"><Lock className="size-7 text-white/90" /></span>
        </div>
      )}
    </div>
  );
}
