import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import type { Box, Layout, PackView, RealmSummary } from "@yav/shared/game";
import { Blocks } from "./Blocks";
import { Props } from "./Props";
import { Portal } from "./Portal";
import { Player, type PlayerHandle } from "./Player";
import { Beacon, Eggs, Flag, Gate, Gems, StoryStone } from "./Things";
import { labelTexture, skyTexture } from "./textures";
import type { Body } from "./physics";

/** A round floor made of block rows, for the dock and the realm islands. */
function disc(radius: number, y = 0): Box[] {
  const out: Box[] = [];
  for (let z = -radius; z < radius; z += 2) {
    const half = Math.sqrt(Math.max(0, radius * radius - (z + 1) * (z + 1)));
    const w = Math.max(2, Math.round(half) * 2);
    out.push({ id: `d${z}`, x: 0, y: y - 0.5, z: z + 1, w, h: 1, d: 2, kind: "ground" });
  }
  return out;
}

function Sky({ top, bottom, fog, stars = false }: { top: string; bottom: string; fog: string; stars?: boolean }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = skyTexture(top, bottom);
    scene.fog = new THREE.Fog(fog, 30, 90);
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, top, bottom, fog]);
  return (
    <>
      <hemisphereLight args={["#ffffff", "#5a4a7a", 1.1]} />
      <directionalLight position={[8, 16, -6]} intensity={1.4} />
      {stars && <Stars radius={80} depth={40} count={1500} factor={4} fade speed={0.5} />}
    </>
  );
}

const PREVIEW: Record<string, "leaves" | "bubbles" | "stars" | "sparkles"> = { wildlands: "leaves", "splash-bay": "bubbles", "cosmo-heights": "stars", dreamforge: "sparkles" };

/**
 * Sky Dock: the floating base. Four realm portals stand in an arc in front of Sparky;
 * each one wakes as he walks towards it.
 */
export function SkyDock({ realms, playerRef, pos, jet, onRealm, onWorkshop }: {
  realms: RealmSummary[];
  playerRef: React.RefObject<PlayerHandle | null>;
  pos: React.MutableRefObject<{ x: number; z: number }>;
  jet: boolean;
  onRealm: (id: string) => void;
  onWorkshop: () => void;
}) {
  const boxes = useMemo(() => disc(15), []);
  // Left to right on screen (screen-left is world +x).
  const spots: [number, number, number][] = [[10, 0, 6], [3.6, 0, 11], [-3.6, 0, 11], [-10, 0, 6]];
  const shop = useMemo(() => labelTexture("🔧", "Workshop"), []);
  const shopFired = useRef(false);
  const onMove = (b: Body) => {
    pos.current = { x: b.x, z: b.z };
    const d = Math.hypot(b.x - 7, b.z + 7);
    if (d < 1.4 && !shopFired.current) {
      shopFired.current = true;
      onWorkshop();
    }
    if (d > 3) shopFired.current = false;
  };
  return (
    <>
      <Sky top="#0b1030" bottom="#3a2a7a" fog="#2a2060" stars />
      <Blocks boxes={boxes} top="#9aa3c7" side="#5d6690" accent="#ffd23f" />
      {/* A glowing ring around the dock edge. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[13.6, 14.2, 64]} />
        <meshBasicMaterial color="#7cf0d8" transparent opacity={0.5} />
      </mesh>
      {realms.slice(0, 4).map((r, i) => {
        const p = spots[i]!;
        return (
          <Portal key={r.id} position={p} rotationY={Math.atan2(-p[0], -p[2])} color={r.color} sky={r.sky} emoji={r.emoji} name={r.name}
            preview={PREVIEW[r.id] ?? "sparkles"} player={pos} onEnter={() => onRealm(r.id)} />
        );
      })}
      {/* Workshop pad, behind and to the left. */}
      <mesh position={[7, 0.08, -7]}>
        <cylinderGeometry args={[1.2, 1.2, 0.16, 24]} />
        <meshStandardMaterial color="#ff8a3d" emissive="#ff8a3d" emissiveIntensity={0.5} />
      </mesh>
      <sprite position={[7, 2.2, -7]} scale={[2.4, 1.2, 1]}><spriteMaterial map={shop} transparent /></sprite>
      <Player ref={playerRef} boxes={boxes} spawn={{ x: 0, y: 0, z: -4 }} jet={jet} onMove={onMove}
        onFall={() => playerRef.current?.teleport(0, 0, -4)} />
    </>
  );
}

/** A realm's hub island: a pad for each level, plus a way home. */
export function RealmHub({ realm, playerRef, pos, jet, onLevel, onHome, onComingSoon }: {
  realm: RealmSummary;
  playerRef: React.RefObject<PlayerHandle | null>;
  pos: React.MutableRefObject<{ x: number; z: number }>;
  jet: boolean;
  onLevel: (levelId: string) => void;
  onHome: () => void;
  onComingSoon: (name: string) => void;
}) {
  const boxes = useMemo(() => disc(13), []);
  // First level on the left of the screen (world +x).
  const pads = realm.levels.map((l, i) => ({ l, x: 7.5 - i * 5, z: 7 }));
  const labels = useMemo(() => realm.levels.map((l) => labelTexture(l.emoji, l.packId ? l.name : `${l.name} · soon`)), [realm]);
  const fired = useRef<string | null>(null);
  const padRefs = useRef<THREE.Mesh[]>([]);
  const props = useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2;
    return { x: Math.cos(a) * 15.5, y: -0.5, z: Math.sin(a) * 15.5, s: 0.9 + (i % 3) * 0.2, variant: i % 3 };
  }), []);
  useFrame(({ clock }) => {
    padRefs.current.forEach((m, i) => {
      const p = pads[i]!;
      const d = Math.hypot(pos.current.x - p.x, pos.current.z - p.z);
      const near = THREE.MathUtils.clamp((5 - d) / 4, 0, 1);
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (p.l.packId ? 0.25 : 0.05) + near * 1.2 + Math.sin(clock.elapsedTime * 3 + i) * 0.05;
      m.position.y = 0.1 + near * 0.15;
    });
  });
  const onMove = (b: Body) => {
    pos.current = { x: b.x, z: b.z };
    const hit = pads.find((p) => Math.hypot(b.x - p.x, b.z - p.z) < 1.2);
    if (hit && fired.current !== hit.l.id) {
      fired.current = hit.l.id;
      if (hit.l.packId) onLevel(hit.l.id);
      else onComingSoon(hit.l.name);
    }
    if (!hit) fired.current = null;
  };
  return (
    <>
      <Sky top={realm.sky[0]} bottom={realm.sky[1]} fog={realm.sky[1]} stars={realm.id === "cosmo-heights"} />
      <Blocks boxes={boxes} top={realm.color} side="#6b5a4a" accent="#ffd23f" />
      <Props spots={props} palette={{ top: realm.color, side: "#6b4226", accent: "#ffd23f", prop: "#2f8f3a", prop2: "#6b4226", sky: realm.sky, fog: realm.sky[1], props: realm.id === "wildlands" ? "jungle" : "jungle" }} />
      {pads.map((p, i) => (
        <group key={p.l.id}>
          <mesh ref={(el) => { if (el) padRefs.current[i] = el; }} position={[p.x, 0.1, p.z]}>
            <cylinderGeometry args={[1.3, 1.4, 0.25, 24]} />
            <meshStandardMaterial color={p.l.packId ? realm.color : "#777777"} emissive={p.l.packId ? realm.color : "#333333"} emissiveIntensity={0.3} />
          </mesh>
          <sprite position={[p.x, 2.4, p.z]} scale={[2.8, 1.4, 1]}><spriteMaterial map={labels[i]!} transparent opacity={p.l.packId ? 1 : 0.55} /></sprite>
        </group>
      ))}
      <Portal position={[0, 0, -10]} rotationY={0} color="#7cf0d8" sky={["#0b1030", "#3a2a7a"]} emoji="🛸" name="Sky Dock" preview="stars" player={pos} onEnter={onHome} size={0.7} />
      <Player ref={playerRef} boxes={boxes} spawn={{ x: 0, y: 0, z: -3 }} jet={jet} onMove={onMove} onFall={() => playerRef.current?.teleport(0, 0, -3)} />
    </>
  );
}

/** A level: the course with its seven gates, gems, eggs, flags, Story Stone and beacon. */
export function LevelScene({ pack, layout, checkpoint, gems, eggs, frozen, jet, playerRef, onMove, onFall }: {
  pack: PackView;
  layout: Layout;
  checkpoint: number;
  gems: Set<string>;
  eggs: Set<string>;
  frozen: boolean;
  jet: boolean;
  playerRef: React.RefObject<PlayerHandle | null>;
  onMove: (b: Body, t: number) => void;
  onFall: () => void;
}) {
  const p = pack.palette;
  // Closed gates are solid, so he can't walk through before answering.
  const solid = useMemo(() => [
    ...layout.boxes,
    ...layout.gates.filter((g) => g.index >= checkpoint).map((g) => ({ id: `wall${g.index}`, x: g.x, y: g.y + 1.5, z: g.z, w: 6, h: 3, d: 0.3, kind: "ground" as const })),
  ], [layout, checkpoint]);
  const spawn = layout.checkpoints[Math.min(checkpoint, layout.checkpoints.length - 1)]!;
  return (
    <>
      <Sky top={p.sky[0]} bottom={p.sky[1]} fog={p.fog} />
      <Blocks boxes={layout.boxes} top={p.top} side={p.side} accent={p.accent} />
      <Props spots={layout.props} palette={p} />
      <Gems gems={layout.gems} collected={gems} color={p.accent} />
      <Eggs eggs={layout.eggs} found={eggs} />
      {layout.gates.map((g) => <Gate key={g.id} gate={g} open={g.index < checkpoint} color={p.prop2} />)}
      {layout.checkpoints.slice(1).map((c, i) => <Flag key={c.id} spot={c} lit={i < checkpoint} color={p.accent} />)}
      <StoryStone spot={layout.storyStone} />
      <Beacon spot={layout.finale} active={checkpoint >= layout.gates.length} />
      <Player ref={playerRef} boxes={solid} spawn={spawn} frozen={frozen} jet={jet} onMove={onMove} onFall={onFall} />
    </>
  );
}
