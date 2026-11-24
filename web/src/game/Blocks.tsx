import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import type { Box } from "@yav/shared/game";
import { boxAt } from "./physics";

const tileGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);

function jitter(hex: string, seed: number, amount = 0.07): THREE.Color {
  const c = new THREE.Color(hex);
  const r = Math.sin(seed * 12.9898) * 43758.5453;
  const f = (r - Math.floor(r) - 0.5) * amount;
  c.offsetHSL(0, 0, f);
  return c;
}

/**
 * Draws the course as rounded blocks: a top layer of tiles in the realm's colour with a
 * little variation, and earthy blocks underneath. Static platforms are one instanced
 * mesh (fast on iPad); moving platforms follow their swing every frame.
 */
export function Blocks({ boxes, top, side, accent }: { boxes: Box[]; top: string; side: string; accent: string }) {
  const statics = useMemo(() => boxes.filter((b) => !b.move), [boxes]);
  const movers = useMemo(() => boxes.filter((b) => b.move), [boxes]);

  const tiles = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number]; c: THREE.Color }[] = [];
    let k = 0;
    for (const b of statics) {
      const nx = Math.max(1, Math.round(b.w));
      const nz = Math.max(1, Math.round(b.d));
      const tw = b.w / nx;
      const td = b.d / nz;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const x = b.x - b.w / 2 + tw * (i + 0.5);
          const z = b.z - b.d / 2 + td * (j + 0.5);
          out.push({ p: [x, b.y, z], s: [tw * 1.002, b.h, td * 1.002], c: jitter(b.kind === "ledge" ? accent : top, k++) });
          // Earth below, getting darker with depth.
          out.push({ p: [x, b.y - 1, z], s: [tw * 1.002, 1, td * 1.002], c: jitter(side, k++, 0.05) });
          if ((i + j) % 3 === 0) out.push({ p: [x, b.y - 2, z], s: [tw * 0.9, 1, td * 0.9], c: jitter(side, k++, 0.05).offsetHSL(0, 0, -0.08) });
        }
      }
    }
    return out;
  }, [statics, top, side, accent]);

  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    tiles.forEach((t, i) => {
      o.position.set(...t.p);
      o.scale.set(...t.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, t.c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [tiles]);

  return (
    <>
      <instancedMesh ref={mesh} args={[tileGeo, undefined, tiles.length]} receiveShadow>
        <meshLambertMaterial />
      </instancedMesh>
      {movers.map((b) => <Mover key={b.id} box={b} color={accent} />)}
    </>
  );
}

function Mover({ box, color }: { box: Box; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const c = boxAt(box, clock.elapsedTime);
    ref.current?.position.set(c.x, c.y, c.z);
  });
  return (
    <mesh ref={ref} geometry={tileGeo} scale={[box.w, box.h, box.d]}>
      <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.25} />
    </mesh>
  );
}
