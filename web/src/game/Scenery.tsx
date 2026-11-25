import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Box, Palette, PropSpot } from "@yav/shared/game";
import { rng } from "@yav/shared/game";
import { MODELS, Models, ModelFallback, type Placement } from "./models";

export type SceneryTheme = Exclude<Palette["props"], "town">;

/**
 * The world around the course, from the model packs. Every scenery spot becomes a
 * floating island, and the edges of every platform get small plants or rocks:
 * - jungle: grass islands with big trees, bushes and ferns; grass, flowers and mushrooms;
 * - beach: grass islands with palm trees; flowers and pebbles;
 * - moon: grey stone islands with tall rocks; little rocks along the path;
 * - castle: grass islands with pines and flowers, like a fairy-tale garden.
 * `fallback` (the block trees) shows if the models can't be loaded.
 */
export function JungleScenery({ spots, boxes, seed, fallback, theme = "jungle" }: { spots: PropSpot[]; boxes: Box[]; seed: string; fallback: React.ReactNode; theme?: SceneryTheme }) {
  const groups = useMemo(() => {
    const r = rng(`${seed}-scenery`);
    const g = new Map<string, Placement[]>();
    const add = (url: string, p: Placement) => {
      const list = g.get(url) ?? [];
      list.push(p);
      g.set(url, list);
    };
    const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;

    // Floating islands.
    spots.forEach((s, i) => {
      const w = 3.2 * s.s;
      const turn = Math.floor(r() * 4) * (Math.PI / 2);
      if (theme === "moon") {
        add(MODELS.cliffStone, { p: [s.x, s.y - 1.6 * s.s, s.z], s: [w, 1.6 * s.s, w], r: turn });
        add(pick(MODELS.moonRocks), { p: [s.x, s.y, s.z], s: 0.7 * s.s, r: r() * 6 });
        if (i % 2 === 0) add(pick(MODELS.moonRocks), { p: [s.x + w * 0.3, s.y, s.z - w * 0.25], s: 0.35 * s.s, r: r() * 6 });
        return;
      }
      // A chunky grass block island, matching the path.
      add(MODELS.grassBlockLarge, { p: [s.x, s.y - 1.6 * s.s, s.z], s: [w / 2.08, 1.6 * s.s, w / 2.08], r: turn });
      if (theme === "beach") {
        add(pick(MODELS.palms), { p: [s.x, s.y, s.z], s: 3.4 * s.s, r: r() * Math.PI * 2 });
        if (i % 2 === 0) add(pick(MODELS.bigRocks), { p: [s.x + w * 0.3, s.y, s.z - w * 0.2], s: 1.4 * s.s, r: r() * 6 });
        return;
      }
      if (theme === "castle") {
        add(pick(MODELS.pines), { p: [s.x, s.y, s.z], s: 0.45 * s.s, r: r() * Math.PI * 2 });
        add(pick(MODELS.flowers), { p: [s.x + (r() - 0.5) * w * 0.6, s.y, s.z + (r() - 0.5) * w * 0.6], s: 0.5 * s.s, r: r() * 6 });
        if (i % 2 === 0) add(MODELS.bush, { p: [s.x - w * 0.25, s.y, s.z + w * 0.2], s: 0.6 * s.s, r: r() * 6 });
        return;
      }
      const tree = s.variant === 2 ? pick(MODELS.pines) : pick(MODELS.trees);
      add(tree, { p: [s.x, s.y, s.z], s: 0.55 * s.s, r: r() * Math.PI * 2 });
      if (i % 2 === 0) add(MODELS.bush, { p: [s.x + (r() - 0.5) * w * 0.6, s.y, s.z + (r() - 0.5) * w * 0.6], s: 0.7 * s.s, r: r() * 6 });
      if (i % 3 === 0) add(MODELS.fern, { p: [s.x - (r() - 0.5) * w * 0.5, s.y, s.z - (r() - 0.5) * w * 0.5], s: 0.22 * s.s, r: r() * 6 });
      if (i % 4 === 1) add(pick(MODELS.rocks), { p: [s.x + w * 0.3, s.y, s.z - w * 0.2], s: 0.35 * s.s, r: r() * 6 });
    });

    // Path edges: low things that never block the way.
    for (const b of boxes) {
      if (b.move || b.kind !== "ground") continue;
      const top = b.y + b.h / 2;
      const n = Math.round(b.d * (b.w > 3 ? 1.4 : 0.8) * (theme === "moon" ? 0.5 : 1));
      for (let k = 0; k < n; k++) {
        const side = r() < 0.5 ? -1 : 1;
        const x = b.x + side * (b.w / 2 - 0.2 - r() * 0.3);
        const z = b.z - b.d / 2 + r() * b.d;
        const roll = r();
        if (theme === "moon") add(pick(MODELS.pebbles), { p: [x, top, z], s: 0.5 + r() * 0.5, r: r() * 6 });
        else if (theme === "beach") {
          if (roll < 0.5) add(pick(MODELS.smallRocks), { p: [x, top, z], s: 1 + r(), r: r() * 6 });
          else add(pick(MODELS.kFlowers), { p: [x, top, z], s: 1.4, r: r() * 6 });
        } else if (theme === "castle") {
          if (roll < 0.45) add(pick(MODELS.flowers), { p: [x, top, z], s: 0.3 + r() * 0.12, r: r() * 6 });
          else if (roll < 0.75) add(MODELS.clover, { p: [x, top, z], s: 0.4, r: r() * 6 });
          else add(MODELS.mushroom, { p: [x, top, z], s: 0.7 + r() * 0.4, r: r() * 6 });
        } else if (roll < 0.4) add(MODELS.grass, { p: [x, top, z], s: 0.35 + r() * 0.2, r: r() * 6 });
        else if (roll < 0.62) add(pick(MODELS.flowers), { p: [x, top, z], s: 0.28 + r() * 0.12, r: r() * 6 });
        else if (roll < 0.8) add(MODELS.clover, { p: [x, top, z], s: 0.4, r: r() * 6 });
        else if (roll < 0.9) add(MODELS.mushroom, { p: [x, top, z], s: 0.6 + r() * 0.4, r: r() * 6 });
        else add(MODELS.grassTall, { p: [x, top, z], s: 0.35, r: r() * 6 });
      }
      // Wide jungle pads get a big leafy plant at a corner.
      if (theme === "jungle" && b.w >= 6 && r() < 0.6) add(MODELS.plantBig, { p: [b.x + (r() < 0.5 ? -1 : 1) * (b.w / 2 - 0.5), top, b.z + b.d / 2 - 0.6], s: 0.35, r: r() * 6 });
    }
    return g;
  }, [spots, boxes, seed, theme]);
  return <Models groups={groups} fallback={fallback} />;
}

/** An animated animal that wanders back and forth along a short path, pausing to graze. */
function Roamer({ url, from, to, scale, speed }: { url: string; from: [number, number, number]; to: [number, number, number]; scale: number; speed: number }) {
  const { scene, animations } = useGLTF(url);
  const model = useMemo(() => cloneSkinned(scene), [scene]);
  const root = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, root);
  const state = useRef({ k: 0, dir: 1, rest: 0, mode: "" });
  const play = (name: string) => {
    if (state.current.mode === name) return;
    const next = actions[name] ?? actions[name.replace("Eating", "Idle")];
    Object.values(actions).forEach((a) => a?.fadeOut(0.3));
    next?.reset().fadeIn(0.3).play();
    state.current.mode = name;
  };
  useEffect(() => {
    play("Walk");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);
  const len = Math.hypot(to[0] - from[0], to[2] - from[2]);
  useFrame((_, dt) => {
    const s = state.current;
    const g = root.current;
    if (!g) return;
    if (s.rest > 0) {
      s.rest -= dt;
      if (s.rest <= 0) play("Walk");
      return;
    }
    s.k += (s.dir * speed * dt) / len;
    if (s.k >= 1 || s.k <= 0) {
      s.k = THREE.MathUtils.clamp(s.k, 0, 1);
      s.dir *= -1;
      s.rest = 3 + Math.random() * 3;
      play("Eating");
    }
    g.position.set(from[0] + (to[0] - from[0]) * s.k, from[1], from[2] + (to[2] - from[2]) * s.k);
    g.rotation.y = Math.atan2((to[0] - from[0]) * s.dir, (to[2] - from[2]) * s.dir);
  });
  return (
    <group ref={root} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

/** A deer on the start pad and a fox near the finish, off to the side of the path. */
export function Wildlife({ start, finish }: { start: { x: number; y: number; z: number }; finish: { x: number; y: number; z: number } }) {
  return (
    <ModelFallback fallback={null}>
      <Suspense fallback={null}>
        <Roamer url={MODELS.deer} from={[start.x + 2.4, start.y, start.z - 1.5]} to={[start.x + 2.4, start.y, start.z + 4]} scale={0.32} speed={0.9} />
        <Roamer url={MODELS.fox} from={[finish.x - 3, finish.y, finish.z - 2]} to={[finish.x - 3, finish.y, finish.z + 3]} scale={0.3} speed={1.3} />
      </Suspense>
    </ModelFallback>
  );
}
