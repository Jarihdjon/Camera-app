import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import type { EggSpot, GateSpot, GemSpot, Spot } from "@yav/shared/game";
import { GATES, GATE_INFO } from "@yav/shared/game";
import { labelTexture } from "./textures";

const gemGeo = new THREE.OctahedronGeometry(0.28, 0);
const block = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);

/** Spinning gems. Ones he already collected show as faint glass. */
export function Gems({ gems, collected, color }: { gems: GemSpot[]; collected: Set<string>; color: string }) {
  const group = useRef<THREE.Group>(null);
  const mats = useMemo(() => ({
    gem: new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.2 }),
    big: new THREE.MeshStandardMaterial({ color: "#ffd23f", emissive: "#ffb300", emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.2 }),
    ghost: new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.25 }),
  }), [color]);
  useFrame(({ clock }) => {
    group.current?.children.forEach((c, i) => {
      c.rotation.y = clock.elapsedTime * 2 + i;
      c.position.y = (gems[i]?.y ?? 0) + Math.sin(clock.elapsedTime * 3 + i) * 0.1;
    });
  });
  return (
    <group ref={group}>
      {gems.map((g) => (
        <mesh key={g.id} geometry={gemGeo} position={[g.x, g.y, g.z]} scale={g.big ? 2.2 : 1}
          material={collected.has(g.id) ? mats.ghost : g.big ? mats.big : mats.gem} />
      ))}
    </group>
  );
}

/** Easter eggs: speckled, glowing, gently bobbing. */
export function Eggs({ eggs, found }: { eggs: EggSpot[]; found: Set<string> }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, "#ff7ad9");
    grad.addColorStop(1, "#7a5cff");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = ["#ffd23f", "#7cf0d8", "#ffffff"][i % 3]!;
      g.beginPath();
      g.arc((i * 37) % 128, (i * 53) % 128, 4 + (i % 3) * 2, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    group.current?.children.forEach((c, i) => {
      c.rotation.y = clock.elapsedTime * 1.5;
      c.position.y = (eggs[i]?.y ?? 0) + 0.6 + Math.sin(clock.elapsedTime * 2 + i) * 0.12;
    });
  });
  return (
    <group ref={group}>
      {eggs.map((e) => (
        <group key={e.id} position={[e.x, e.y + 0.6, e.z]} visible={!found.has(e.id)}>
          <mesh scale={[0.35, 0.45, 0.35]}>
            <sphereGeometry args={[1, 24, 18]} />
            <meshStandardMaterial map={tex} emissive="#7a5cff" emissiveIntensity={0.35} roughness={0.3} />
          </mesh>
          <pointLight color="#ff9ce6" intensity={3} distance={3} />
        </group>
      ))}
    </group>
  );
}

/** A gate: a block arch with a glowing energy wall and its challenge icon. Opens when cleared. */
export function Gate({ gate, open, color }: { gate: GateSpot; open: boolean; color: string }) {
  const type = GATES[gate.index]!;
  const info = GATE_INFO[type];
  const sign = useMemo(() => labelTexture(info.icon, info.name), [info]);
  const wall = useRef<THREE.Mesh>(null);
  const t0 = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const w = wall.current;
    if (!w) return;
    if (open) {
      t0.current ??= clock.elapsedTime;
      const k = Math.min(1, (clock.elapsedTime - t0.current) * 2.5);
      w.scale.set(1, 1 - k, 1);
      w.position.y = gate.y + 1.5 + k * 1.4;
      w.visible = k < 1;
    } else {
      t0.current = null;
      w.visible = true;
      w.scale.set(1, 1, 1);
      w.position.y = gate.y + 1.5;
      (w.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(clock.elapsedTime * 4) * 0.15;
    }
  });
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={block} position={[gate.x + s * 2.6, gate.y + 1.6, gate.z]} scale={[0.8, 3.2, 0.8]}>
          <meshLambertMaterial color={color} />
        </mesh>
      ))}
      <mesh geometry={block} position={[gate.x, gate.y + 3.45, gate.z]} scale={[6, 0.7, 0.9]}>
        <meshLambertMaterial color={color} />
      </mesh>
      <mesh ref={wall} position={[gate.x, gate.y + 1.5, gate.z]}>
        <planeGeometry args={[4.4, 3]} />
        <meshBasicMaterial color={open ? "#7cf0d8" : "#7cf0d8"} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <sprite position={[gate.x, gate.y + 4.6, gate.z]} scale={[2.6, 1.3, 1]}>
        <spriteMaterial map={sign} transparent />
      </sprite>
    </group>
  );
}

/** Checkpoint flag: grey until reached, then bright. */
export function Flag({ spot, lit, color }: { spot: Spot; lit: boolean; color: string }) {
  return (
    <group position={[spot.x + 2.4, spot.y, spot.z]}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 2.2, 8]} />
        <meshLambertMaterial color="#dddddd" />
      </mesh>
      <mesh position={[0.4, 1.9, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.3, 0.8, 3]} />
        <meshLambertMaterial color={lit ? color : "#777777"} emissive={lit ? color : "#000000"} emissiveIntensity={lit ? 0.5 : 0} />
      </mesh>
    </group>
  );
}

/** The Story Stone at the start of each level. */
export function StoryStone({ spot }: { spot: Spot }) {
  const sign = useMemo(() => labelTexture("📖", "Story Stone"), []);
  return (
    <group position={[spot.x, spot.y, spot.z]}>
      <mesh geometry={block} position={[0, 1, 0]} scale={[1.2, 2, 0.5]}>
        <meshLambertMaterial color="#8a8fa3" />
      </mesh>
      <sprite position={[0, 2.7, 0]} scale={[2.2, 1.1, 1]}>
        <spriteMaterial map={sign} transparent />
      </sprite>
    </group>
  );
}

/** The finale beacon: a glowing pillar of light. */
export function Beacon({ spot, active }: { spot: Spot; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime;
  });
  return (
    <group position={[spot.x, spot.y, spot.z]}>
      <mesh ref={ref} position={[0, 0.6, 0]}>
        <cylinderGeometry args={[1.2, 1.4, 1.2, 8]} />
        <meshLambertMaterial color="#ffd23f" emissive="#ffb300" emissiveIntensity={active ? 0.6 : 0.1} />
      </mesh>
      {active && (
        <mesh position={[0, 6, 0]}>
          <cylinderGeometry args={[0.7, 0.9, 10, 16, 1, true]} />
          <meshBasicMaterial color="#fff3b0" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
