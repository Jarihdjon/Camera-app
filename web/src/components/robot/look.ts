import type { RobotLook } from "@yav/shared";

/** Colours for each visor: the face screen and the LED colour of eyes and mouth. */
export const VISORS: Record<string, { top: string; bottom: string; edge: string; led: string; halo: string }> = {
  "visor-teal": { top: "#12505c", bottom: "#0d3a44", edge: "#082a31", led: "#ffc94d", halo: "rgba(255, 201, 77, 0.45)" },
  "visor-galaxy": { top: "#3a2370", bottom: "#1d1240", edge: "#140b2e", led: "#8fe9ff", halo: "rgba(143, 233, 255, 0.45)" },
  "visor-matrix": { top: "#0f3a22", bottom: "#062114", edge: "#03160c", led: "#6dff9c", halo: "rgba(109, 255, 156, 0.45)" },
};

export const CAPES: Record<string, { light: string; dark: string; trim: string; pattern: "none" | "stars" | "lightning" }> = {
  "cape-orange": { light: "#ff9a3c", dark: "#e0520f", trim: "#ffd36b", pattern: "none" },
  "cape-stars": { light: "#ff9a3c", dark: "#d9480c", trim: "#ffe27a", pattern: "stars" },
  "cape-lightning": { light: "#ffa53c", dark: "#c93d0a", trim: "#fff07a", pattern: "lightning" },
};

export const visorOf = (look: RobotLook) => VISORS[look.visor] ?? VISORS["visor-teal"]!;
export const capeOf = (look: RobotLook) => CAPES[look.cape] ?? CAPES["cape-orange"]!;

export interface SvgIds {
  glow: string;
  led: string;
  shell: string;
  body: string;
  screen: string;
  flame: string;
  cape: string;
  screenDots: string;
}
