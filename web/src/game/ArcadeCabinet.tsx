import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { labelTexture } from "./textures";

const body = new RoundedBoxGeometry(1, 1, 1, 3, 0.1);

/**
 * The arcade machine on Sky Dock: a chunky cabinet with a glowing screen that plays a
 * little bouncing-shapes animation, a joystick and buttons, and a pad in front. The pad
 * and screen light up as Sparky walks closer; stepping on the pad opens the Arcade.
 */
export function ArcadeCabinet({ position, player }: { position: [number, number, number]; player: React.MutableRefObject<{ x: number; z: number }> }) {
  const label = useMemo(() => labelTexture("🕹️", "Arcade"), []);
  const screen = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 96;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { canvas: c, tex: t };
  }, []);
  const pad = useRef<THREE.Mesh>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const g = screen.canvas.getContext("2d")!;
    g.fillStyle = "#10102a";
    g.fillRect(0, 0, 128, 96);
    const colors = ["#ffd23f", "#7cf0d8", "#ff7ad9", "#8fd3ff"];
    for (let i = 0; i < 4; i++) {
      const x = 64 + Math.sin(t * (1.3 + i * 0.4) + i) * 44;
      const y = 48 + Math.cos(t * (1.1 + i * 0.3) + i * 2) * 30;
      g.fillStyle = colors[i]!;
      g.beginPath();
      if (i % 2) g.arc(x, y, 9, 0, Math.PI * 2);
      else g.rect(x - 8, y - 8, 16, 16);
      g.fill();
    }
    screen.tex.needsUpdate = true;
    const d = Math.hypot(player.current.x - position[0], player.current.z - position[2]);
    const near = THREE.MathUtils.clamp((5 - d) / 4, 0, 1);
    if (pad.current) (pad.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + near * 1.2 + Math.sin(t * 3) * 0.08;
    if (screenMat.current) screenMat.current.emissiveIntensity = 0.7 + near * 0.6;
  });

  // The cabinet stands behind its pad and faces the middle of the dock.
  const facing = Math.atan2(-position[0], -position[2]);
  return (
    <group position={position}>
      <mesh ref={pad} position={[0, 0.08, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.16, 24]} />
        <meshStandardMaterial color="#7a5cff" emissive="#7a5cff" emissiveIntensity={0.5} />
      </mesh>
      <group rotation={[0, facing, 0]} position={[-Math.sin(facing) * 1.9, 0, -Math.cos(facing) * 1.9]}>
        <mesh geometry={body} position={[0, 1.3, 0]} scale={[1.5, 2.6, 1.1]}>
          <meshStandardMaterial color="#5b3fd6" roughness={0.5} />
        </mesh>
        {/* Stripes down the sides. */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.76, 1.3, 0]} scale={[0.02, 2.4, 0.9]}>
            <boxGeometry />
            <meshStandardMaterial color="#ffd23f" emissive="#ffb300" emissiveIntensity={0.4} />
          </mesh>
        ))}
        {/* Screen, tilted back a little. */}
        <mesh position={[0, 1.85, 0.56]} rotation={[-0.15, 0, 0]}>
          <planeGeometry args={[1.15, 0.86]} />
          <meshStandardMaterial ref={screenMat} map={screen.tex} emissive="#ffffff" emissiveMap={screen.tex} emissiveIntensity={0.8} />
        </mesh>
        {/* Control panel with a joystick and three buttons. */}
        <mesh geometry={body} position={[0, 1.05, 0.7]} rotation={[0.5, 0, 0]} scale={[1.45, 0.12, 0.55]}>
          <meshStandardMaterial color="#2b2140" />
        </mesh>
        <mesh position={[-0.35, 1.22, 0.72]}>
          <cylinderGeometry args={[0.03, 0.03, 0.22, 8]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
        <mesh position={[-0.35, 1.35, 0.72]}>
          <sphereGeometry args={[0.08, 12, 10]} />
          <meshStandardMaterial color="#ff4d4d" />
        </mesh>
        {["#7cf0d8", "#ffd23f", "#ff7ad9"].map((c, i) => (
          <mesh key={c} position={[0.12 + i * 0.2, 1.14, 0.78 - i * 0.02]} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.05, 12]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.6} />
          </mesh>
        ))}
        {/* Glowing marquee on top. */}
        <mesh geometry={body} position={[0, 2.75, 0.1]} scale={[1.55, 0.4, 0.9]}>
          <meshStandardMaterial color="#ff7ad9" emissive="#ff7ad9" emissiveIntensity={0.7} />
        </mesh>
        <pointLight position={[0, 1.9, 1.2]} color="#b89cff" intensity={4} distance={5} />
      </group>
      <sprite position={[0, 3.9, 0]} scale={[2.4, 1.2, 1]}><spriteMaterial map={label} transparent /></sprite>
    </group>
  );
}
