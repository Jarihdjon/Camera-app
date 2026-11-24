import { GATES, type BeatEffect, type Perk } from "./types.js";

/**
 * Builds a level's course from a seed. Pure and deterministic, so the server and the
 * iPad agree on every gem, egg, gate and checkpoint without sending geometry around.
 *
 * The course runs forward along +z. Units are blocks (about Sparky's height is 1.4).
 * Jump height is about 2 blocks; with the Jet boost a double jump reaches about 3.5.
 */
export interface Box {
  id: string;
  /** Centre position and full size. */
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  kind: "ground" | "moving" | "ledge";
  move?: { axis: "x" | "y"; range: number; speed: number; phase: number };
}
export interface Spot { id: string; x: number; y: number; z: number }
export interface GemSpot extends Spot { big: boolean }
export interface EggSpot extends Spot { perk: Perk; needsJet: boolean }
export interface GateSpot extends Spot { index: number }
export interface PropSpot { x: number; y: number; z: number; s: number; variant: number }
/** Pieces of the course that only appear once a beat is solved (e.g. bridge planks). */
export interface Reveal { gate: number; boxes: Box[] }

export interface Layout {
  boxes: Box[];
  gems: GemSpot[];
  eggs: EggSpot[];
  gates: GateSpot[];
  /** checkpoints[0] is the start; checkpoints[i] is just past gate i-1. */
  checkpoints: Spot[];
  storyStone: Spot;
  finale: Spot;
  props: PropSpot[];
  length: number;
  /** Boxes that become solid when their gate is cleared. */
  reveals: Reveal[];
}

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Small seeded random number generator (mulberry32). */
export function rng(seed: string | number): () => number {
  let a = typeof seed === "number" ? seed >>> 0 : hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WIDTH = 4;

/**
 * `effects` (one per gate, from the level's mission) can change the gate areas: a
 * "bridge" beat turns its gate area into a gap that planks fill once he answers.
 */
export function buildLayout(seed: string, eggPerks: Perk[] = ["jet", "shield"], effects: BeatEffect[] = []): Layout {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!;
  const boxes: Box[] = [];
  const gems: GemSpot[] = [];
  const eggs: EggSpot[] = [];
  const gates: GateSpot[] = [];
  const checkpoints: Spot[] = [];
  const props: PropSpot[] = [];
  const reveals: Reveal[] = [];
  let z = 0;
  let y = 0;
  let n = 0;
  const box = (b: Omit<Box, "id">) => boxes.push({ id: `b${n++}`, ...b });
  const gem = (x: number, gy: number, gz: number, big = false) => gems.push({ id: `g${gems.length}`, x, y: gy, z: gz, big });
  /** A platform whose top is at height `top`, from z0 to z0+len. */
  const slab = (z0: number, len: number, top: number, x = 0, w = WIDTH, kind: Box["kind"] = "ground") =>
    box({ x, y: top - 0.5, z: z0 + len / 2, w, h: 1, d: len, kind });

  // Start pad with the Story Stone.
  slab(-2, 8, 0, 0, 6);
  checkpoints.push({ id: "c0", x: 0, y: 0, z: 0 });
  const storyStone = { id: "stone", x: -1.8, y: 0, z: 3.5 };
  z = 6;

  const pieces = {
    straight: () => {
      const len = 5 + Math.floor(r() * 3);
      slab(z, len, y);
      for (let k = 1; k < len; k += 1.5) gem(0, y + 0.8, z + k);
      z += len;
    },
    gap: () => {
      const gap = 1.8 + r() * 0.6;
      for (let k = 0.3; k < 1; k += 0.33) gem(0, y + 0.9 + Math.sin(k * Math.PI) * 1.2, z + gap * k);
      z += gap;
      slab(z, 4, y);
      z += 4;
    },
    stepping: () => {
      for (let k = 0; k < 3; k++) {
        const x = k % 2 === 0 ? -1.2 : 1.2;
        z += 1.2;
        slab(z, 2, y, x, 2);
        gem(x, y + 0.8, z + 1);
        z += 2;
      }
      z += 1;
      slab(z, 3, y);
      z += 3;
    },
    stairs: () => {
      for (let k = 0; k < 3; k++) {
        y += 1;
        slab(z, 2, y);
        gem(0, y + 0.8, z + 1);
        z += 2;
      }
      slab(z, 3, y);
      z += 3;
    },
    drop: () => {
      if (y < 1) return pieces.straight();
      y = Math.max(0, y - 2);
      z += 1;
      slab(z, 5, y);
      gem(0, y + 0.8, z + 2.5);
      z += 5;
    },
    mover: () => {
      const gap = 6;
      box({ x: 0, y: y - 0.3, z: z + gap / 2, w: 2.6, h: 0.6, d: 2.6, kind: "moving", move: { axis: "x", range: 2, speed: 1 + r(), phase: r() * 6 } });
      gem(0, y + 0.8, z + gap / 2);
      z += gap;
      slab(z, 4, y);
      z += 4;
    },
  };
  const names = Object.keys(pieces) as (keyof typeof pieces)[];

  GATES.forEach((_, i) => {
    // Two or three pieces between gates.
    const count = 2 + Math.floor(r() * 2);
    for (let k = 0; k < count; k++) pieces[pick(names)]();

    // Easter egg 1, after gate 1: a side ledge, reachable with a normal jump. Gives a perk.
    if (i === 2) {
      slab(z - 4, 2, y + 1, WIDTH / 2 + 2.6, 2, "ledge");
      eggs.push({ id: "egg0", x: WIDTH / 2 + 2.6, y: y + 1, z: z - 3, perk: eggPerks[0] ?? "jet", needsJet: false });
    }
    // Big gem behind an optional jump on the other side.
    if (i === 3) {
      slab(z - 4, 2.5, y, -(WIDTH / 2 + 2.4), 2.5, "ledge");
      gem(-(WIDTH / 2 + 2.4), y + 1, z - 2.75, true);
    }
    // Easter egg 2: a high ledge only the Jet boost double jump can reach.
    if (i === 5) {
      slab(z - 4, 2, y + 3.2, WIDTH / 2 + 1.5, 2, "ledge");
      eggs.push({ id: "egg1", x: WIDTH / 2 + 1.5, y: y + 3.2, z: z - 3, perk: eggPerks[1] ?? "shield", needsJet: true });
    }

    if (effects[i] === "bridge") {
      // Approach, then a ravine the bridge planks will span, then the far bank.
      slab(z, 3, y, 0, 6);
      gates.push({ id: `gate${i}`, index: i, x: 0, y, z: z + 2.2 });
      const planks: Box[] = [];
      for (let k = 0; k < 6; k++) planks.push({ id: `plank${i}-${k}`, x: 0, y: y - 0.15, z: z + 3.35 + k * 0.7, w: 3, h: 0.3, d: 0.64, kind: "ground" });
      reveals.push({ gate: i, boxes: planks });
      z += 3 + 4.2;
      slab(z, 3, y, 0, 6);
      checkpoints.push({ id: `c${i + 1}`, x: 0, y, z: z + 1.5 });
      z += 3;
    } else {
      // Gate area, then the checkpoint just past the gate.
      slab(z, 6, y, 0, 6);
      gates.push({ id: `gate${i}`, index: i, x: 0, y, z: z + 2.5 });
      checkpoints.push({ id: `c${i + 1}`, x: 0, y, z: z + 4.5 });
      z += 6;
    }
  });

  // Finale pad with the beacon.
  slab(z, 8, y, 0, 8);
  const finale = { id: "finale", x: 0, y, z: z + 4 };
  z += 8;

  // Scenery either side, kept clear of the path and ledges.
  for (let pz = -2; pz < z; pz += 2.5) {
    for (const side of [-1, 1]) {
      if (r() < 0.55) props.push({ x: side * (7 + r() * 6), y: -1 - r() * 3, z: pz + r() * 2, s: 0.8 + r() * 0.8, variant: Math.floor(r() * 3) });
    }
  }
  return { boxes, gems, eggs, gates, checkpoints, storyStone, finale, props, length: z, reveals };
}

/** The layout for a level's pack, with its mission's beat effects applied. Server and iPad both use this. */
export function layoutFor(pack: { id: string; eggs: Perk[]; mission?: { beats: { effect: BeatEffect }[] } }): Layout {
  return buildLayout(pack.id, pack.eggs, pack.mission?.beats.map((b) => b.effect) ?? []);
}
