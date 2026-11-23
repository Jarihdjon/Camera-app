import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { labelTexture, skyTexture } from "./textures";

const rune = new RoundedBoxGeometry(0.32, 0.32, 0.32, 2, 0.08);
const tile = new RoundedBoxGeometry(1.6, 0.12, 1.1, 2, 0.05);

export interface PortalProps {
  position: [number, number, number];
  /** Turned to face the middle of the dock. */
  rotationY: number;
  color: string;
  sky: [string, string];
  emoji: string;
  name: string;
  /** What floats inside when it opens: leaves, bubbles, stars or sparkles. */
  preview: "leaves" | "bubbles" | "stars" | "sparkles";
  /** Read every frame: where Sparky is. */
  player: React.MutableRefObject<{ x: number; z: number }>;
  onEnter: () => void;
  size?: number;
}

/**
 * A realm portal that wakes up as Sparky walks towards it:
 * far away it is a dormant stone ring; closer, its runes light one by one and the
 * runway tiles glow towards it; close up the ring spins and an iris opens with a live
 * preview of the realm inside. Walking away powers it back down.
 */
export function Portal({ position, rotationY, color, sky, emoji, name, preview, player, onEnter, size = 1 }: PortalProps) {
  const ring = useRef<THREE.Mesh>(null);
  const runes = useRef<THREE.Mesh[]>([]);
  const iris = useRef<THREE.Mesh>(null);
  const swirl = useRef<THREE.Group>(null);
  const bits = useRef<THREE.Group>(null);
  const tiles = useRef<THREE.Mesh[]>([]);
  const entered = useRef(false);
  const state = useRef({ power: 0, open: 0 });

  const ringMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7d8296", emissive: color, emissiveIntensity: 0, roughness: 0.6 }), [color]);
  const runeOff = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5a5f73", roughness: 0.7 }), []);
  const runeOn = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4 }), [color]);
  const irisMat = useMemo(() => new THREE.MeshBasicMaterial({ map: skyTexture(sky[0], sky[1]), transparent: true, opacity: 0.95, side: THREE.DoubleSide }), [sky]);
  const sign = useMemo(() => labelTexture(emoji, name), [emoji, name]);
  const tileOff = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a3f5c" }), []);
  const tileOn = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 }), [color]);
  const bitGeo = useMemo(() => (preview === "bubbles" ? new THREE.SphereGeometry(0.12, 10, 8) : preview === "leaves" ? new THREE.BoxGeometry(0.22, 0.04, 0.16) : new THREE.OctahedronGeometry(0.1)), [preview]);
  const bitMat = useMemo(() => new THREE.MeshBasicMaterial({ color: preview === "leaves" ? "#4fd16a" : preview === "bubbles" ? "#d9f5ff" : preview === "stars" ? "#fff3b0" : "#ffb3e6", transparent: true, opacity: 0.9 }), [preview]);

  const R = 2.2 * size;
  const runeCount = 8;

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const dx = player.current.x - position[0];
    const dz = player.current.z - position[2];
    const d = Math.hypot(dx, dz);
    // Power rises from 12 blocks away; the iris opens inside 5.
    const wantPower = THREE.MathUtils.clamp((12 - d) / 8, 0, 1);
    const wantOpen = THREE.MathUtils.clamp((5 - d) / 2.2, 0, 1);
    const s = state.current;
    s.power += (wantPower - s.power) * Math.min(1, delta * 3);
    s.open += (wantOpen - s.open) * Math.min(1, delta * 4);

    ringMat.emissiveIntensity = s.power * 0.9;
    ringMat.color.lerpColors(new THREE.Color("#7d8296"), new THREE.Color(color), s.power * 0.6);
    if (ring.current) ring.current.rotation.z += delta * (0.1 + s.open * 2.5);
    runes.current.forEach((m, i) => {
      m.material = s.power > (i + 0.5) / runeCount ? runeOn : runeOff;
      m.scale.setScalar(1 + (s.power > (i + 0.5) / runeCount ? Math.sin(t * 6 + i) * 0.12 : 0));
    });
    tiles.current.forEach((m, i) => {
      // Runway lights up towards the portal, in a travelling wave.
      const lit = s.power > (tiles.current.length - i) / (tiles.current.length + 1);
      m.material = lit ? tileOn : tileOff;
      m.position.y = -0.04 + (lit ? Math.max(0, Math.sin(t * 5 - i * 0.8)) * 0.06 : 0);
    });
    if (iris.current) {
      iris.current.scale.setScalar(Math.max(0.001, s.open));
      iris.current.rotation.z = t * 0.3;
    }
    if (swirl.current) {
      swirl.current.rotation.z = -t * 2;
      swirl.current.scale.setScalar(0.4 + s.open * 0.6);
      swirl.current.visible = s.power > 0.3;
    }
    if (bits.current) {
      bits.current.visible = s.open > 0.05;
      bits.current.children.forEach((b, i) => {
        const a = i * 2.4 + t * (0.4 + (i % 3) * 0.2);
        const rr = (0.3 + ((i * 37) % 10) / 10 * 1.4) * s.open;
        b.position.set(Math.cos(a) * rr, Math.sin(a * 1.3) * rr + (preview === "bubbles" ? ((t * 0.6 + i * 0.2) % 2) - 1 : 0), 0.05);
        b.rotation.set(t + i, t * 0.7, 0);
      });
    }
    if (!entered.current && d < 1.4 && s.open > 0.85) {
      entered.current = true;
      onEnter();
    }
    if (d > 3) entered.current = false;
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={[0, R + 0.3, 0]}>
        <mesh ref={ring} material={ringMat}>
          <torusGeometry args={[R, 0.32 * size, 12, 48]} />
        </mesh>
        {Array.from({ length: runeCount }, (_, i) => {
          const a = (i / runeCount) * Math.PI * 2;
          return <mesh key={i} ref={(el) => { if (el) runes.current[i] = el; }} geometry={rune} material={runeOff} position={[Math.cos(a) * R, Math.sin(a) * R, 0.3]} />;
        })}
        <mesh ref={iris} material={irisMat}>
          <circleGeometry args={[R - 0.2, 48]} />
        </mesh>
        <group ref={swirl}>
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * (R - 0.5), Math.sin(a) * (R - 0.5), 0.06]}>
                <sphereGeometry args={[0.07, 6, 6]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
              </mesh>
            );
          })}
        </group>
        <group ref={bits}>
          {Array.from({ length: 18 }, (_, i) => <mesh key={i} geometry={bitGeo} material={bitMat} />)}
        </group>
      </group>
      <sprite position={[0, 2 * R + 1.4, 0]} scale={[3.2, 1.6, 1]}>
        <spriteMaterial map={sign} transparent />
      </sprite>
      {/* Runway tiles leading to the portal (they sit in front of it, towards the dock centre). */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} ref={(el) => { if (el) tiles.current[i] = el; }} geometry={tile} material={tileOff} position={[0, -0.04, 1.4 + i * 1.3]} />
      ))}
    </group>
  );
}
