/** Placeholder robot. Parts (arms, wheels, jetpack, antenna) unlock as he learns. */
export function Robot({ parts = [], size = 120, mood = "happy" }: { parts?: string[]; size?: number; mood?: "happy" | "thinking" | "cheer" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Your robot" className={`robot robot-${mood}`}>
      {parts.includes("antenna") ? <><rect x="57" y="8" width="6" height="16" fill="var(--robot)" /><circle cx="60" cy="8" r="6" fill="var(--accent)" /></> : null}
      <rect x="25" y="24" width="70" height="60" rx="14" fill="var(--robot)" />
      <circle cx="45" cy="52" r="8" fill="var(--bg)" />
      <circle cx="75" cy="52" r="8" fill="var(--bg)" />
      {mood === "cheer" ? <path d="M44 68 Q60 80 76 68" stroke="var(--bg)" strokeWidth="5" fill="none" strokeLinecap="round" />
        : <rect x="45" y="68" width="30" height="5" rx="2.5" fill="var(--bg)" />}
      <rect x="38" y="88" width="44" height="24" rx="6" fill="var(--robot)" opacity="0.8" />
    </svg>
  );
}
