/**
 * Robot parts Yav unlocks by earning word gems. Unlocks are based on gems ever
 * earned, never on the current balance, so nothing he has earned is taken away.
 */
export const PART_SLOTS = ["cape", "visor", "boots"] as const;
export type PartSlot = (typeof PART_SLOTS)[number];

export interface RobotPart {
  id: string;
  slot: PartSlot;
  label: string;
  /** Total gems earned needed to unlock. 0 = the starting part. */
  gems: number;
}

export const ROBOT_PARTS: readonly RobotPart[] = [
  { id: "cape-orange", slot: "cape", label: "Orange cape", gems: 0 },
  { id: "cape-stars", slot: "cape", label: "Star cape", gems: 10 },
  { id: "cape-lightning", slot: "cape", label: "Lightning cape", gems: 30 },
  { id: "visor-teal", slot: "visor", label: "Teal visor", gems: 0 },
  { id: "visor-galaxy", slot: "visor", label: "Galaxy visor", gems: 15 },
  { id: "visor-matrix", slot: "visor", label: "Matrix visor", gems: 40 },
  { id: "boots-hover", slot: "boots", label: "Hover boots", gems: 0 },
  { id: "boots-rocket", slot: "boots", label: "Rocket boots", gems: 25 },
  { id: "boots-wheels", slot: "boots", label: "Wheels", gems: 50 },
];

export const partById = (id: string) => ROBOT_PARTS.find((p) => p.id === id);

export function unlockedParts(gemsEarned: number): string[] {
  return ROBOT_PARTS.filter((p) => p.gems <= gemsEarned).map((p) => p.id);
}

export type RobotLook = Record<PartSlot, string>;

/** What the robot is wearing: the equipped part per slot, or the starting part. */
export function resolveLook(equipped: readonly string[]): RobotLook {
  const look = {} as RobotLook;
  for (const slot of PART_SLOTS) {
    const chosen = equipped.map(partById).find((p) => p?.slot === slot);
    look[slot] = chosen?.id ?? ROBOT_PARTS.find((p) => p.slot === slot && p.gems === 0)!.id;
  }
  return look;
}

/** Equip a part, replacing whatever was in the same slot. */
export function equip(equipped: readonly string[], partId: string): string[] {
  const part = partById(partId);
  if (!part) return [...equipped];
  return [...equipped.filter((id) => partById(id)?.slot !== part.slot), partId];
}
