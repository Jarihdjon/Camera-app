/** Display name, emoji and glow colour for each interest theme. */
export const THEME_STYLE: Record<string, { label: string; emoji: string; glow: string }> = {
  minecraft: { label: "Block worlds", emoji: "⛏️", glow: "before:from-emerald-400/40 before:to-lime-300/10" },
  "astro-bot": { label: "Astro adventures", emoji: "🚀", glow: "before:from-sky-400/40 before:to-cyan-300/10" },
  space: { label: "Space", emoji: "🪐", glow: "before:from-violet-400/40 before:to-fuchsia-300/10" },
  lego: { label: "Bricks", emoji: "🧱", glow: "before:from-rose-400/40 before:to-amber-300/10" },
  robots: { label: "Robots", emoji: "🤖", glow: "before:from-orange-400/40 before:to-yellow-300/10" },
  animals: { label: "Animals", emoji: "🐨", glow: "before:from-amber-400/40 before:to-lime-300/10" },
  nature: { label: "Nature", emoji: "🌻", glow: "before:from-teal-400/40 before:to-emerald-300/10" },
  everyday: { label: "Everyday life", emoji: "🎒", glow: "before:from-fuchsia-400/40 before:to-pink-300/10" },
};
export const themeStyle = (t: string) => THEME_STYLE[t] ?? THEME_STYLE.space!;
