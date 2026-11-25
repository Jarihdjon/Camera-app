import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import type { BeatEffect, Box, GateSpot, Spot } from "@yav/shared/game";
import { labelTexture } from "./textures";

/**
 * What each story beat looks like in the world. Every effect sits at its gate and plays
 * once when the gate is cleared (`open`). `shake` changes on a wrong answer, so the
 * obstacle rumbles shut.
 */

const block = new RoundedBoxGeometry(1, 1, 1, 2, 0.1);
const wood = new THREE.MeshLambertMaterial({ color: "#a8743f" });
const darkWood = new THREE.MeshLambertMaterial({ color: "#6b4226" });
const stone = new THREE.MeshLambertMaterial({ color: "#9a9fae", flatShading: true });
const gold = new THREE.MeshStandardMaterial({ color: "#ffd23f", emissive: "#ffb300", emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.3 });

/** 0 → 1 over `secs` once `open` turns true; snaps back to 0 when it closes. */
function useOpening(open: boolean, secs = 1.2) {
  const t0 = useRef<number | null>(null);
  return (t: number) => {
    if (!open) {
      t0.current = null;
      return 0;
    }
    t0.current ??= t;
    return Math.min(1, (t - t0.current) / secs);
  };
}
const ease = (k: number) => 1 - Math.pow(1 - k, 3);
/** A short rumble after each wrong answer. */
function useShake(shake: number) {
  const last = useRef({ n: shake, at: -10 });
  return (t: number) => {
    if (last.current.n !== shake) last.current = { n: shake, at: t };
    const e = t - last.current.at;
    return e < 0.6 ? Math.sin(e * 60) * 0.08 * (1 - e / 0.6) : 0;
  };
}

/** The signpost with Kip's diary page: it spins round, then points down the path. */
function Signpost({ gate, open, shake }: EffectProps) {
  const arm = useRef<THREE.Group>(null);
  const page = useMemo(() => labelTexture("📜", "Story clue"), []);
  const k = useOpening(open, 1.6);
  const sh = useShake(shake);
  useFrame(({ clock }) => {
    const a = arm.current;
    if (!a) return;
    const v = ease(k(clock.elapsedTime));
    // Spins three times and settles pointing along the course (+z).
    a.rotation.y = open ? -Math.PI / 2 + v * Math.PI * 6 : Math.PI / 2 + Math.sin(clock.elapsedTime * 1.3) * 0.25 + sh(clock.elapsedTime) * 4;
  });
  return (
    <group position={[gate.x - 2.2, gate.y, gate.z - 1.6]}>
      <mesh material={wood} position={[0, 1.2, 0]} scale={[0.18, 2.4, 0.18]} geometry={block} />
      <group ref={arm} position={[0, 2.1, 0]}>
        <mesh material={darkWood} position={[0.7, 0, 0]} scale={[1.4, 0.4, 0.1]} geometry={block} />
        <mesh material={darkWood} position={[1.45, 0, 0]} rotation={[0, 0, Math.PI / 4]} scale={[0.32, 0.32, 0.1]} geometry={block} />
      </group>
      <sprite position={[0, 3.1, 0]} scale={[1.8, 0.9, 1]}><spriteMaterial map={page} transparent depthWrite={false} /></sprite>
    </group>
  );
}

/** A stone door with Boulder's carvings. The two halves slide apart into the cliff. */
function StoneDoor({ gate, open, shake }: EffectProps) {
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const k = useOpening(open, 1.4);
  const sh = useShake(shake);
  useFrame(({ clock }) => {
    const v = ease(k(clock.elapsedTime));
    const s = sh(clock.elapsedTime);
    if (left.current) left.current.position.x = gate.x - 1.1 - v * 2.2 + s;
    if (right.current) right.current.position.x = gate.x + 1.1 + v * 2.2 - s;
  });
  return (
    <group>
      <mesh ref={left} material={stone} position={[gate.x - 1.1, gate.y + 1.5, gate.z]} scale={[2.2, 3, 0.45]} geometry={block} />
      <mesh ref={right} material={stone} position={[gate.x + 1.1, gate.y + 1.5, gate.z]} scale={[2.2, 3, 0.45]} geometry={block} />
    </group>
  );
}

/** Wally's bridge: posts and ropes either side, and planks that drop in one by one. */
function Bridge({ gate, open, shake, reveal }: EffectProps) {
  const planks = useRef<THREE.Group>(null);
  const k = useOpening(open, 2.2);
  const sh = useShake(shake);
  const boxes = reveal ?? [];
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  useFrame(({ clock }) => {
    const v = k(clock.elapsedTime);
    const s = sh(clock.elapsedTime);
    planks.current?.children.forEach((c, i) => {
      // Each plank falls in a little after the one before.
      const local = THREE.MathUtils.clamp(v * boxes.length - i * 0.85, 0, 1);
      const b = boxes[i]!;
      c.visible = open && local > 0;
      c.position.y = b.y + (1 - ease(local)) * 6;
      c.rotation.z = (1 - local) * 0.6;
      // A wobble after a wrong answer: the half-built bridge creaks.
      c.rotation.x = s * 2;
    });
  });
  if (!first || !last) return null;
  const posts = [first.z - 0.5, last.z + 0.5];
  return (
    <group>
      <group ref={planks}>
        {boxes.map((b) => <mesh key={b.id} material={wood} position={[b.x, b.y, b.z]} scale={[b.w, b.h, b.d]} geometry={block} visible={false} />)}
      </group>
      {posts.flatMap((z) => [-1, 1].map((s) => (
        <mesh key={`${z}${s}`} material={darkWood} position={[gate.x + s * 1.7, gate.y + 0.3, z]} scale={[0.25, 1.6, 0.25]} geometry={block} />
      )))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[gate.x + s * 1.7, gate.y + 0.95, (posts[0]! + posts[1]!) / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, posts[1]! - posts[0]!, 6]} />
          <meshLambertMaterial color="#e0c18a" />
        </mesh>
      ))}
      {/* Wally's pile of planks waiting at the edge. */}
      {open ? null : [0, 1, 2].map((i) => (
        <mesh key={i} material={wood} position={[gate.x + 2.3, gate.y + 0.15 + i * 0.3, gate.z - 1.4]} rotation={[0, 0.2 * i, 0]} scale={[1.6, 0.25, 0.5]} geometry={block} />
      ))}
    </group>
  );
}

/** A wilted vine on a rock wall. It grows up and turns green, becoming a leafy ladder. */
function Vine({ gate, open, shake }: EffectProps) {
  const vine = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#8a7a4a" }), []);
  const leafMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#8a7a4a" }), []);
  const k = useOpening(open, 1.8);
  const sh = useShake(shake);
  const dry = new THREE.Color("#8a7a4a");
  const green = new THREE.Color("#3faa3a");
  useFrame(({ clock }) => {
    const v = ease(k(clock.elapsedTime));
    const g = vine.current;
    if (!g) return;
    g.scale.y = 0.35 + v * 0.65;
    g.rotation.z = (1 - v) * 0.5 + sh(clock.elapsedTime) * 3;
    mat.color.copy(dry).lerp(green, v);
    leafMat.color.copy(dry).lerp(green, v).offsetHSL(0, 0, 0.05);
  });
  const leaves = Array.from({ length: 9 }, (_, i) => i);
  return (
    <group position={[gate.x + 2.6, gate.y, gate.z - 0.5]}>
      <mesh material={stone} position={[0.4, 2, 0.3]} scale={[1, 4, 1.4]} geometry={block} />
      <group ref={vine}>
        <mesh material={mat} position={[-0.15, 1.9, 0]} scale={[0.1, 3.8, 0.1]} geometry={block} />
        {leaves.map((i) => (
          <mesh key={i} material={leafMat} position={[-0.25 + (i % 2 ? -0.2 : 0.1), 0.4 + i * 0.4, 0]} rotation={[0, 0, i % 2 ? 0.8 : -0.8]} scale={[0.3, 0.14, 0.05]}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** A treasure chest with a pattern lock. The lid swings open and gold light spills out. */
export function Chest({ spot, open, shake = 0, scale = 1 }: { spot: Spot; open: boolean; shake?: number; scale?: number }) {
  const lid = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);
  const k = useOpening(open, 1.0);
  const sh = useShake(shake);
  useFrame(({ clock }) => {
    const v = ease(k(clock.elapsedTime));
    if (lid.current) lid.current.rotation.x = -v * 1.9 + sh(clock.elapsedTime) * 2;
    if (glow.current) glow.current.intensity = v * 6;
  });
  return (
    <group position={[spot.x, spot.y, spot.z]} scale={scale}>
      <mesh material={wood} position={[0, 0.35, 0]} scale={[1.2, 0.7, 0.8]} geometry={block} />
      <mesh material={gold} position={[0, 0.35, 0]} scale={[1.25, 0.12, 0.85]} geometry={block} />
      <group ref={lid} position={[0, 0.7, -0.4]}>
        <mesh material={darkWood} position={[0, 0.17, 0.4]} scale={[1.22, 0.34, 0.82]} geometry={block} />
        <mesh material={gold} position={[0, 0.05, 0.82]} scale={[0.22, 0.28, 0.08]} geometry={block} />
      </group>
      <pointLight ref={glow} position={[0, 1, 0]} color="#ffd23f" intensity={0} distance={5} />
    </group>
  );
}

/** The treasure vault: a round stone door marked with an X that rolls aside. */
function Vault({ gate, open, shake }: EffectProps) {
  const door = useRef<THREE.Group>(null);
  const k = useOpening(open, 1.6);
  const sh = useShake(shake);
  useFrame(({ clock }) => {
    const v = ease(k(clock.elapsedTime));
    const d = door.current;
    if (!d) return;
    d.position.x = gate.x + v * 3.6 + sh(clock.elapsedTime);
    d.rotation.z = -v * Math.PI * 1.2;
  });
  return (
    <group>
      <group ref={door} position={[gate.x, gate.y + 1.7, gate.z + 0.1]}>
        <mesh material={stone} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.75, 1.75, 0.5, 20]} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, 0, -0.27]} rotation={[0, 0, (s * Math.PI) / 4]} scale={[2.2, 0.32, 0.05]}>
            <boxGeometry />
            <meshStandardMaterial color="#e0402a" emissive="#c02010" emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

interface EffectProps {
  gate: GateSpot;
  open: boolean;
  shake: number;
  reveal?: Box[];
}

/** Whether a beat's effect replaces the gate's glowing energy wall (it is the obstacle itself). */
export const REPLACES_WALL: Partial<Record<BeatEffect, boolean>> = { door: true, vault: true, bridge: true };

export function BeatEffectView({ effect, ...p }: EffectProps & { effect: BeatEffect }) {
  switch (effect) {
    case "signpost": return <Signpost {...p} />;
    case "door": return <StoneDoor {...p} />;
    case "bridge": return <Bridge {...p} />;
    case "vine": return <Vine {...p} />;
    case "chest": return <Chest spot={{ id: "c", x: p.gate.x + 2.4, y: p.gate.y, z: p.gate.z - 1.4 }} open={p.open} shake={p.shake} />;
    case "vault": return <Vault {...p} />;
    // "fly" is Wren herself flying ahead (see Npc).
    default: return null;
  }
}

/**
 * The finale: a big red X on the ground. Once every clue is found, a chest digs itself up
 * and the treasure rises out of it, spinning and glowing.
 */
export function TreasureSpot({ spot, ready, dug, emoji }: { spot: Spot; ready: boolean; dug: boolean; emoji: string }) {
  const chest = useRef<THREE.Group>(null);
  const prize = useRef<THREE.Sprite>(null);
  const x = useRef<THREE.Group>(null);
  const k = useOpening(dug, 2.4);
  const icon = useMemo(() => labelTexture(emoji, "", "rgba(0,0,0,0)"), [emoji]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const v = k(t);
    if (chest.current) chest.current.position.y = spot.y - 1.2 + ease(Math.min(1, v * 2)) * 1.2;
    if (prize.current) {
      const r = ease(THREE.MathUtils.clamp(v * 2 - 1, 0, 1));
      prize.current.visible = dug && r > 0;
      prize.current.position.y = spot.y + 1 + r * 1.8 + Math.sin(t * 2) * 0.1;
      const sc = 0.4 + r * 1.6;
      prize.current.scale.set(sc * 2, sc, 1);
    }
    if (x.current) {
      x.current.visible = !dug;
      const pulse = ready ? 1 + Math.sin(t * 5) * 0.08 : 1;
      x.current.scale.set(pulse, 1, pulse);
    }
  });
  return (
    <group>
      <group ref={x} position={[spot.x, spot.y + 0.03, spot.z]}>
        {[1, -1].map((s) => (
          <mesh key={s} rotation={[-Math.PI / 2, 0, (s * Math.PI) / 4]}>
            <planeGeometry args={[3, 0.5]} />
            <meshBasicMaterial color={ready ? "#ff3b2a" : "#8a3a30"} transparent opacity={ready ? 0.95 : 0.55} />
          </mesh>
        ))}
      </group>
      <group ref={chest} position={[spot.x, spot.y - 1.2, spot.z]}>
        <Chest spot={{ id: "t", x: 0, y: 0, z: 0 }} open={dug} scale={1.3} />
      </group>
      <sprite ref={prize} position={[spot.x, spot.y + 1, spot.z]} visible={false}>
        <spriteMaterial map={icon} transparent depthWrite={false} />
      </sprite>
      {dug && <pointLight position={[spot.x, spot.y + 2.5, spot.z]} color="#ffe28a" intensity={8} distance={8} />}
    </group>
  );
}
