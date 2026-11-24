import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { labelTexture } from "./textures";

/**
 * The realm's quest monument. In Wildlands it is the Heartwood: a great tree that starts
 * bare and grey, and comes back to life a stage at a time as each Compass piece returns.
 * A stone ring round its roots holds the pieces; each returned piece lights up.
 *
 * 0 pieces: a grey, leafless trunk. 1: the trunk turns warm brown, first buds.
 * 2: a full green crown. 3: flowers and glowing fruit. 4: the whole tree glows and the
 * compass at its heart spins.
 */
export function HeartwoodTree({ position, pieces, total, name, emoji }: {
  position: [number, number, number];
  pieces: number;
  total: number;
  name: string;
  emoji: string;
}) {
  const life = total ? pieces / total : 0;
  const crown = useRef<THREE.Group>(null);
  const compass = useRef<THREE.Group>(null);
  const label = useMemo(() => labelTexture(emoji, `${name} ${pieces}/${total}`), [emoji, name, pieces, total]);
  const trunk = useMemo(() => new THREE.MeshLambertMaterial({ color: new THREE.Color("#8d8d93").lerp(new THREE.Color("#7a4a28"), Math.min(1, life * 2)) }), [life]);
  const leaf = useMemo(() => new THREE.MeshLambertMaterial({ color: new THREE.Color("#6f8a5a").lerp(new THREE.Color("#3fbf4a"), life), emissive: "#3fbf4a", emissiveIntensity: pieces >= total ? 0.25 : 0 }), [life, pieces, total]);
  // Crown clumps appear as the tree recovers.
  const clumps = useMemo(() => {
    const out: { p: [number, number, number]; s: number }[] = [];
    const n = pieces === 0 ? 0 : pieces === 1 ? 4 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = i % 2 ? 1.6 : 1.1;
      out.push({ p: [Math.cos(a) * r, 5.2 + (i % 3) * 0.6, Math.sin(a) * r], s: pieces === 1 ? 0.45 : 1.1 + (i % 3) * 0.2 });
    }
    if (pieces >= 2) out.push({ p: [0, 6.4, 0], s: 1.6 });
    return out;
  }, [pieces]);
  const fruit = useMemo(() => (pieces >= 3 ? Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    return [Math.cos(a) * 2.1, 5 + (i % 2) * 1.2, Math.sin(a) * 2.1] as [number, number, number];
  }) : []), [pieces]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (crown.current) crown.current.rotation.z = Math.sin(t * 0.7) * 0.025;
    if (compass.current) compass.current.rotation.y = pieces >= total ? t * 1.5 : Math.sin(t) * 0.3;
  });

  return (
    <group position={position}>
      {/* Roots and trunk, with two bare branches. */}
      <mesh material={trunk} position={[0, 2.2, 0]}><cylinderGeometry args={[0.55, 0.9, 4.4, 9]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={trunk} position={[s * 0.8, 4.2, 0]} rotation={[0, 0, -s * 0.7]}><cylinderGeometry args={[0.15, 0.3, 2, 6]} /></mesh>
      ))}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return <mesh key={i} material={trunk} position={[Math.cos(a) * 0.9, 0.2, Math.sin(a) * 0.9]} rotation={[Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9]}><cylinderGeometry args={[0.12, 0.3, 1.2, 5]} /></mesh>;
      })}
      <group ref={crown}>
        {clumps.map((c, i) => <mesh key={i} material={leaf} position={c.p} scale={c.s}><icosahedronGeometry args={[1, 1]} /></mesh>)}
        {fruit.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.2, 10, 8]} />
            <meshStandardMaterial color={i % 2 ? "#ff6f91" : "#ffd23f"} emissive={i % 2 ? "#ff6f91" : "#ffb300"} emissiveIntensity={0.7} />
          </mesh>
        ))}
      </group>
      {/* The compass ring: one stone segment per piece; returned pieces glow. */}
      {Array.from({ length: total }, (_, i) => {
        const a = (i / total) * Math.PI * 2 + Math.PI / 4;
        const lit = i < pieces;
        return (
          <mesh key={i} position={[Math.cos(a) * 2.2, 0.2, Math.sin(a) * 2.2]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.7, 0.4, 1.4]} />
            <meshStandardMaterial color={lit ? "#ffd23f" : "#6e6e78"} emissive={lit ? "#ffb300" : "#000000"} emissiveIntensity={lit ? 0.8 : 0} />
          </mesh>
        );
      })}
      <group ref={compass} position={[0, 3, 0.62]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.1, 20]} />
          <meshStandardMaterial color="#ffe9a8" emissive="#ffb300" emissiveIntensity={0.2 + life * 0.8} metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.07]} rotation={[0, 0, Math.PI / 4]} scale={[0.1, 0.6, 0.02]}>
          <boxGeometry />
          <meshBasicMaterial color="#e0402a" />
        </mesh>
      </group>
      {pieces > 0 && <pointLight position={[0, 4, 1.5]} color="#ffe28a" intensity={2 + pieces * 2} distance={10} />}
      <sprite position={[0, 8.6, 0]} scale={[3.6, 1.8, 1]}><spriteMaterial map={label} transparent depthWrite={false} /></sprite>
    </group>
  );
}
