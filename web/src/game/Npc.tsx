import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CharacterKind, MissionCharacter } from "@yav/shared/game";
import { labelTexture } from "./textures";
import { onSpeech } from "@/lib/speech";

/**
 * The story animals: original, chunky low-poly characters built from simple shapes so
 * they match the course. Each one bobs while idle, bounces and opens its mouth while it
 * talks, and walks (or flies) to wherever the story needs it next.
 */

/** Which character is talking right now (shared by every NPC). */
const talking = { who: undefined as string | undefined };
onSpeech((e) => {
  if (e.type === "start") talking.who = e.who;
  else if (e.type === "end" && talking.who === e.who) talking.who = undefined;
});

const lambert = (color: string) => new THREE.MeshLambertMaterial({ color });

function Eyes({ y, z, spread, size = 0.07 }: { y: number; z: number; spread: number; size?: number }) {
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * spread, y, z]}>
          <mesh><sphereGeometry args={[size * 1.5, 12, 10]} /><meshLambertMaterial color="#ffffff" /></mesh>
          <mesh position={[0, 0, size * 0.9]}><sphereGeometry args={[size, 10, 8]} /><meshBasicMaterial color="#1a1420" /></mesh>
          <mesh position={[size * 0.35, size * 0.4, size * 1.6]}><sphereGeometry args={[size * 0.3, 6, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
        </group>
      ))}
    </>
  );
}

/** Kip: a round grey koala with big fluffy ears and a dark nose. */
function Koala({ color, mouth }: { color: string; mouth: React.RefObject<THREE.Mesh | null> }) {
  const fur = useMemo(() => lambert(color), [color]);
  const pale = useMemo(() => lambert("#e9e4dc"), []);
  return (
    <group>
      <mesh material={fur} position={[0, 0.55, 0]} scale={[0.55, 0.6, 0.5]}><sphereGeometry args={[1, 18, 14]} /></mesh>
      <mesh material={pale} position={[0, 0.5, 0.3]} scale={[0.35, 0.4, 0.25]}><sphereGeometry args={[1, 14, 10]} /></mesh>
      <mesh material={fur} position={[0, 1.35, 0]} scale={[0.5, 0.45, 0.45]}><sphereGeometry args={[1, 18, 14]} /></mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.5, 1.6, -0.05]}>
          <mesh material={fur} scale={[0.3, 0.3, 0.14]}><sphereGeometry args={[1, 14, 10]} /></mesh>
          <mesh material={pale} position={[0, 0, 0.06]} scale={[0.2, 0.2, 0.1]}><sphereGeometry args={[1, 12, 8]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 1.3, 0.42]} scale={[0.13, 0.17, 0.1]}><sphereGeometry args={[1, 12, 10]} /><meshLambertMaterial color="#2a2530" /></mesh>
      <Eyes y={1.45} z={0.36} spread={0.2} />
      <mesh ref={mouth} position={[0, 1.12, 0.4]} scale={[0.08, 0.02, 0.04]}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#5a2030" /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={fur} position={[s * 0.25, 0.08, 0.15]} scale={[0.16, 0.1, 0.22]}><sphereGeometry args={[1, 10, 8]} /></mesh>
      ))}
      {/* A little leafy satchel for the map. */}
      <mesh position={[0.45, 0.6, 0.1]} rotation={[0, 0, 0.3]} scale={[0.16, 0.2, 0.1]}><boxGeometry /><meshLambertMaterial color="#4f9a3a" /></mesh>
    </group>
  );
}

/** Wren: a small round brown bird with a cream belly, a perky tail and flapping wings. */
function Bird({ color, mouth, wings }: { color: string; mouth: React.RefObject<THREE.Mesh | null>; wings: React.RefObject<THREE.Group | null> }) {
  const body = useMemo(() => lambert(color), [color]);
  return (
    <group position={[0, 0.2, 0]}>
      <mesh material={body} position={[0, 0.45, 0]} scale={[0.35, 0.33, 0.38]}><sphereGeometry args={[1, 16, 12]} /></mesh>
      <mesh position={[0, 0.4, 0.15]} scale={[0.25, 0.24, 0.25]}><sphereGeometry args={[1, 12, 10]} /><meshLambertMaterial color="#f3dfb8" /></mesh>
      <mesh material={body} position={[0, 0.85, 0.08]} scale={0.26}><sphereGeometry args={[1, 14, 12]} /></mesh>
      <Eyes y={0.9} z={0.27} spread={0.11} size={0.05} />
      <mesh ref={mouth} position={[0, 0.8, 0.32]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.06, 0.16, 6]} /><meshLambertMaterial color="#ffb02e" /></mesh>
      <mesh material={body} position={[0, 0.72, -0.42]} rotation={[-0.9, 0, 0]} scale={[0.14, 0.32, 0.05]}><boxGeometry /></mesh>
      <group ref={wings}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.3, 0.55, 0]}>
            <mesh material={body} position={[s * 0.15, 0, 0]} scale={[0.32, 0.06, 0.22]}><sphereGeometry args={[1, 10, 8]} /></mesh>
          </group>
        ))}
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.1, 0.05, 0.05]}><cylinderGeometry args={[0.02, 0.02, 0.22, 4]} /><meshLambertMaterial color="#ffb02e" /></mesh>
      ))}
    </group>
  );
}

/** Wally: a stocky wombat with a broad square nose and short legs. */
function Wombat({ color, mouth }: { color: string; mouth: React.RefObject<THREE.Mesh | null> }) {
  const fur = useMemo(() => lambert(color), [color]);
  return (
    <group>
      <mesh material={fur} position={[0, 0.55, -0.1]} scale={[0.6, 0.48, 0.75]}><sphereGeometry args={[1, 18, 14]} /></mesh>
      <mesh material={fur} position={[0, 0.75, 0.6]} scale={[0.42, 0.36, 0.38]}><sphereGeometry args={[1, 16, 12]} /></mesh>
      <mesh position={[0, 0.72, 0.95]} scale={[0.26, 0.16, 0.12]}><boxGeometry /><meshLambertMaterial color="#3a2a22" /></mesh>
      <Eyes y={0.92} z={0.88} spread={0.18} size={0.055} />
      {[-1, 1].map((s) => (
        <mesh key={s} material={fur} position={[s * 0.25, 1.08, 0.5]} scale={[0.1, 0.12, 0.06]}><sphereGeometry args={[1, 8, 6]} /></mesh>
      ))}
      <mesh ref={mouth} position={[0, 0.58, 0.92]} scale={[0.1, 0.02, 0.04]}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#5a2030" /></mesh>
      {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz], i) => (
        <mesh key={i} material={fur} position={[sx! * 0.35, 0.12, sz! * 0.4]} scale={[0.14, 0.14, 0.16]}><sphereGeometry args={[1, 8, 6]} /></mesh>
      ))}
      {/* Builder's hard hat: Wally is fixing the bridge. */}
      <mesh position={[0, 1.08, 0.55]} scale={[0.32, 0.14, 0.32]}><sphereGeometry args={[1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshLambertMaterial color="#ffc13b" /></mesh>
    </group>
  );
}

/** Boulder: a mossy talking stone with a sleepy, kindly face. */
function Stone({ color, mouth }: { color: string; mouth: React.RefObject<THREE.Mesh | null> }) {
  const rock = useMemo(() => new THREE.MeshLambertMaterial({ color, flatShading: true }), [color]);
  return (
    <group>
      <mesh material={rock} position={[0, 0.85, 0]} scale={[0.9, 0.85, 0.75]}><icosahedronGeometry args={[1, 1]} /></mesh>
      <mesh position={[0, 1.55, -0.1]} scale={[0.6, 0.18, 0.5]}><icosahedronGeometry args={[1, 1]} /><meshLambertMaterial color="#5f9a3e" flatShading /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.3, 1.15, 0.62]} scale={[0.16, 0.05, 0.05]}><boxGeometry /><meshBasicMaterial color="#2a2530" /></mesh>
      ))}
      <mesh ref={mouth} position={[0, 0.7, 0.66]} scale={[0.22, 0.03, 0.05]}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#2a2530" /></mesh>
    </group>
  );
}


/** Shelly: a round sea turtle with a patterned dome shell and paddle flippers. */
function Turtle({ color, mouth }: { color: string; mouth: React.RefObject<THREE.Mesh | null> }) {
  const skin = useMemo(() => lambert("#8fcf8a"), []);
  const shell = useMemo(() => new THREE.MeshLambertMaterial({ color, flatShading: true }), [color]);
  return (
    <group>
      <mesh material={shell} position={[0, 0.55, -0.05]} scale={[0.75, 0.5, 0.85]}><sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      <mesh position={[0, 0.55, -0.05]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.78, 0.88, 1]}><circleGeometry args={[1, 20]} /><meshLambertMaterial color="#e9d7a0" side={THREE.DoubleSide} /></mesh>
      {[[-0.35, 0.92, 0.1], [0.35, 0.92, 0.1], [0, 1.02, -0.3], [0, 1.0, 0.35]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[-0.3, 0, 0]} scale={[0.22, 0.05, 0.22]}><cylinderGeometry args={[1, 1, 1, 6]} /><meshLambertMaterial color="#e9d7a0" /></mesh>
      ))}
      <mesh material={skin} position={[0, 0.7, 0.85]} scale={[0.34, 0.3, 0.34]}><sphereGeometry args={[1, 14, 10]} /></mesh>
      <Eyes y={0.8} z={1.1} spread={0.15} size={0.055} />
      <mesh ref={mouth} position={[0, 0.6, 1.15]} scale={[0.1, 0.02, 0.03]}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#3a2030" /></mesh>
      {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz], i) => (
        <mesh key={i} material={skin} position={[sx! * 0.72, 0.4, sz! * 0.45]} rotation={[0, sx! * 0.5 * sz!, sx! * 0.3]} scale={[0.38, 0.08, 0.2]}><sphereGeometry args={[1, 10, 6]} /></mesh>
      ))}
    </group>
  );
}

/** Captain Clack: a bright red crab with eye stalks, big claws and a little captain's hat. */
function Crab({ color, mouth }: { color: string; mouth: React.RefObject<THREE.Mesh | null> }) {
  const shell = useMemo(() => lambert(color), [color]);
  return (
    <group position={[0, 0.1, 0]}>
      <mesh material={shell} position={[0, 0.45, 0]} scale={[0.7, 0.35, 0.5]}><sphereGeometry args={[1, 16, 10]} /></mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={shell} position={[s * 0.2, 0.85, 0.3]}><cylinderGeometry args={[0.04, 0.05, 0.4, 6]} /></mesh>
          <group position={[s * 0.2, 1.08, 0.3]}>
            <mesh><sphereGeometry args={[0.11, 12, 10]} /><meshLambertMaterial color="#ffffff" /></mesh>
            <mesh position={[0, 0, 0.08]}><sphereGeometry args={[0.06, 10, 8]} /><meshBasicMaterial color="#1a1420" /></mesh>
          </group>
          {/* Claws: two chunky pincers. */}
          <group position={[s * 0.85, 0.55, 0.35]} rotation={[0, 0, s * -0.4]}>
            <mesh material={shell} scale={[0.22, 0.2, 0.2]}><sphereGeometry args={[1, 10, 8]} /></mesh>
            <mesh material={shell} position={[0, 0.16, 0.12]} rotation={[0.6, 0, 0]} scale={[0.1, 0.18, 0.08]}><sphereGeometry args={[1, 8, 6]} /></mesh>
            <mesh material={shell} position={[0, -0.06, 0.16]} rotation={[-0.3, 0, 0]} scale={[0.1, 0.14, 0.08]}><sphereGeometry args={[1, 8, 6]} /></mesh>
          </group>
          {[0, 1, 2].map((k) => (
            <mesh key={k} material={shell} position={[s * 0.6, 0.18, -0.2 + k * 0.2]} rotation={[0, 0, s * 0.9]}><cylinderGeometry args={[0.035, 0.03, 0.4, 5]} /></mesh>
          ))}
        </group>
      ))}
      <mesh ref={mouth} position={[0, 0.4, 0.5]} scale={[0.14, 0.02, 0.03]}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#5a1020" /></mesh>
      <mesh position={[0, 0.78, -0.05]} scale={[0.32, 0.12, 0.26]}><cylinderGeometry args={[1, 1, 1, 14]} /><meshLambertMaterial color="#1f2a4a" /></mesh>
      <mesh position={[0, 0.86, 0.2]} scale={[0.08, 0.06, 0.02]}><boxGeometry /><meshLambertMaterial color="#ffd23f" /></mesh>
    </group>
  );
}

/** Zib: a round little alien with one big eye, two bobbly antennae and a glass helmet. */
function Alien({ color, mouth }: { color: string; mouth: React.RefObject<THREE.Mesh | null> }) {
  const skin = useMemo(() => lambert(color), [color]);
  return (
    <group>
      <mesh material={skin} position={[0, 0.55, 0]} scale={[0.5, 0.55, 0.45]}><sphereGeometry args={[1, 16, 12]} /></mesh>
      <mesh material={skin} position={[0, 1.3, 0]} scale={0.42}><sphereGeometry args={[1, 18, 14]} /></mesh>
      {/* One big friendly eye. */}
      <mesh position={[0, 1.35, 0.33]}><sphereGeometry args={[0.17, 14, 12]} /><meshLambertMaterial color="#ffffff" /></mesh>
      <mesh position={[0, 1.35, 0.46]}><sphereGeometry args={[0.09, 12, 10]} /><meshBasicMaterial color="#1a1420" /></mesh>
      <mesh position={[0.03, 1.39, 0.53]}><sphereGeometry args={[0.03, 6, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <mesh ref={mouth} position={[0, 1.13, 0.38]} scale={[0.1, 0.02, 0.03]}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#2a4030" /></mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={skin} position={[s * 0.18, 1.82, 0]} rotation={[0, 0, -s * 0.35]}><cylinderGeometry args={[0.025, 0.03, 0.4, 6]} /></mesh>
          <mesh position={[s * 0.26, 2.02, 0]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color="#ffd23f" emissive="#ffb300" emissiveIntensity={0.8} /></mesh>
          <mesh material={skin} position={[s * 0.25, 0.1, 0.1]} scale={[0.15, 0.1, 0.2]}><sphereGeometry args={[1, 8, 6]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 1.3, 0]}><sphereGeometry args={[0.58, 20, 16]} /><meshStandardMaterial color="#cfefff" transparent opacity={0.22} roughness={0.05} /></mesh>
    </group>
  );
}

/** Ember: a small, round, friendly dragon with little wings, a tail and soft horns. */
function Dragon({ color, mouth, wings }: { color: string; mouth: React.RefObject<THREE.Mesh | null>; wings: React.RefObject<THREE.Group | null> }) {
  const scales = useMemo(() => lambert(color), [color]);
  const belly = useMemo(() => lambert("#ffe0a8"), []);
  return (
    <group>
      <mesh material={scales} position={[0, 0.6, 0]} scale={[0.5, 0.55, 0.5]}><sphereGeometry args={[1, 16, 12]} /></mesh>
      <mesh material={belly} position={[0, 0.55, 0.3]} scale={[0.32, 0.4, 0.22]}><sphereGeometry args={[1, 12, 10]} /></mesh>
      <mesh material={scales} position={[0, 1.35, 0.1]} scale={[0.42, 0.38, 0.42]}><sphereGeometry args={[1, 16, 12]} /></mesh>
      <mesh material={scales} position={[0, 1.27, 0.45]} scale={[0.24, 0.17, 0.2]}><sphereGeometry args={[1, 12, 10]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.07, 1.31, 0.63]}><sphereGeometry args={[0.025, 6, 6]} /><meshBasicMaterial color="#5a2a20" /></mesh>
      ))}
      <Eyes y={1.48} z={0.38} spread={0.17} size={0.06} />
      <mesh ref={mouth} position={[0, 1.18, 0.6]} scale={[0.1, 0.02, 0.03]}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#5a1020" /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.2, 1.72, 0]} rotation={[-0.3, 0, -s * 0.3]}><coneGeometry args={[0.07, 0.25, 8]} /><meshLambertMaterial color="#ffe0a8" /></mesh>
      ))}
      <group ref={wings}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.42, 0.95, -0.2]}>
            <mesh position={[s * 0.25, 0.1, 0]} rotation={[0, 0, s * 0.4]} scale={[0.45, 0.28, 0.04]}><sphereGeometry args={[1, 10, 6]} /><meshLambertMaterial color="#ffb36b" /></mesh>
          </group>
        ))}
      </group>
      <mesh material={scales} position={[0, 0.3, -0.6]} rotation={[-1.1, 0, 0]}><coneGeometry args={[0.15, 0.8, 8]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={scales} position={[s * 0.25, 0.1, 0.1]} scale={[0.16, 0.12, 0.22]}><sphereGeometry args={[1, 8, 6]} /></mesh>
      ))}
    </group>
  );
}

export const PORTRAIT: Record<CharacterKind | "sparky", string> = { koala: "🐨", bird: "🐦", wombat: "🐻", stone: "🪨", owl: "🦉", turtle: "🐢", crab: "🦀", alien: "👽", dragon: "🐲", sparky: "🤖" };

/**
 * One story animal. It moves smoothly to `target` (hopping, or flying for birds), faces
 * Sparky's side of the course, and shows its name above its head.
 */
export function Npc({ character, target, face = Math.PI }: { character: MissionCharacter; target: [number, number, number]; face?: number }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const wings = useRef<THREE.Group>(null);
  const label = useMemo(() => labelTexture(PORTRAIT[character.kind], character.name), [character]);
  const flies = character.kind === "bird";
  const placed = useRef(false);
  useEffect(() => {
    placed.current = false;
  }, [character.id]);

  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const [tx, ty, tz] = target;
    const goalY = ty + (flies ? 1.6 : 0);
    if (!placed.current) {
      g.position.set(tx, goalY, tz);
      placed.current = true;
    }
    const dx = tx - g.position.x;
    const dz = tz - g.position.z;
    const dist = Math.hypot(dx, dz);
    const moving = dist > 0.05;
    // Far jumps (a whole section away) happen quickly so the story isn't kept waiting.
    const speed = Math.max(5, dist * 1.2);
    if (moving) {
      const step = Math.min(dist, speed * dt);
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(dx, dz), 0.2);
    } else {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, face, 0.08);
    }
    const flyHeight = flies && moving ? 2.4 : 0;
    g.position.y = THREE.MathUtils.lerp(g.position.y, goalY + flyHeight, 0.1);

    const speaking = talking.who === character.id;
    const b = body.current;
    if (b) {
      const hop = moving && !flies ? Math.abs(Math.sin(t * 12)) * 0.35 : 0;
      const bob = Math.sin(t * 2 + character.id.length) * 0.04;
      const chat = speaking ? Math.abs(Math.sin(t * 9)) * 0.08 : 0;
      b.position.y = hop + bob + chat + (flies ? Math.sin(t * 3) * 0.08 : 0);
      b.rotation.z = speaking ? Math.sin(t * 5) * 0.06 : 0;
    }
    if (mouth.current) {
      const open = speaking ? 0.02 + Math.abs(Math.sin(t * 14)) * 0.06 : 0.02;
      mouth.current.scale.y = character.kind === "bird" ? 1 : open;
      if (character.kind === "bird") mouth.current.rotation.x = Math.PI / 2 + (speaking ? Math.sin(t * 14) * 0.25 : 0);
    }
    if (wings.current) {
      const flap = moving || speaking ? Math.sin(t * (moving ? 26 : 12)) * 0.7 : Math.sin(t * 2) * 0.05;
      wings.current.children.forEach((w, i) => (w.rotation.z = (i === 0 ? 1 : -1) * flap));
    }
  });

  const k = character.kind;
  return (
    <group ref={root}>
      <group ref={body}>
        {k === "koala" && <Koala color={character.color} mouth={mouth} />}
        {k === "bird" && <Bird color={character.color} mouth={mouth} wings={wings} />}
        {k === "wombat" && <Wombat color={character.color} mouth={mouth} />}
        {k === "stone" && <Stone color={character.color} mouth={mouth} />}
        {k === "owl" && <Bird color={character.color} mouth={mouth} wings={wings} />}
        {k === "turtle" && <Turtle color={character.color} mouth={mouth} />}
        {k === "crab" && <Crab color={character.color} mouth={mouth} />}
        {k === "alien" && <Alien color={character.color} mouth={mouth} />}
        {k === "dragon" && <Dragon color={character.color} mouth={mouth} wings={wings} />}
      </group>
      <sprite position={[0, k === "stone" ? 2.3 : 2.2, 0]} scale={[2.2, 1.1, 1]}>
        <spriteMaterial map={label} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}
