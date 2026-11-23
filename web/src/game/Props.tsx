import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import type { Palette, PropSpot } from "@yav/shared/game";

const cube = new RoundedBoxGeometry(1, 1, 1, 2, 0.15);

type Part = { p: [number, number, number]; s: [number, number, number]; c: string; r?: number };

/** Scenery built from rounded blocks: jungle trees, town houses, and so on. */
function partsFor(kind: Palette["props"], spot: PropSpot, pal: Palette): Part[] {
  const { x, y, z, s, variant } = spot;
  if (kind === "town") {
    const h = (2 + variant) * s;
    const col = variant === 1 ? pal.prop2 : pal.prop;
    return [
      { p: [x, y + h / 2, z], s: [2 * s, h, 2 * s], c: col },
      { p: [x, y + h + 0.45 * s, z], s: [2.2 * s, 0.9 * s, 2.2 * s], c: "#5b4a6b" },
      { p: [x, y + h * 0.55, z - s - 0.01], s: [0.5 * s, 0.6 * s, 0.05], c: "#fff3b0" },
    ];
  }
  // Jungle and default: a chunky tree.
  const trunkH = (1.6 + variant * 0.5) * s;
  return [
    { p: [x, y + trunkH / 2, z], s: [0.5 * s, trunkH, 0.5 * s], c: pal.prop2 },
    { p: [x, y + trunkH + 0.6 * s, z], s: [2 * s, 1.2 * s, 2 * s], c: pal.prop },
    { p: [x, y + trunkH + 1.5 * s, z], s: [1.3 * s, 0.9 * s, 1.3 * s], c: pal.prop, r: 0.3 },
  ];
}

export function Props({ spots, palette }: { spots: PropSpot[]; palette: Palette }) {
  const parts = useMemo(() => spots.flatMap((s) => partsFor(palette.props, s, palette)), [spots, palette]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    parts.forEach((p, i) => {
      o.position.set(...p.p);
      o.scale.set(...p.s);
      o.rotation.set(0, p.r ?? 0, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(p.c).offsetHSL(0, 0, (i % 5) * 0.012));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [parts]);
  return (
    <instancedMesh ref={mesh} args={[cube, undefined, parts.length]}>
      <meshLambertMaterial />
    </instancedMesh>
  );
}
