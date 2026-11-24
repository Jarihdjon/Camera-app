import { Component, Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * Free CC0 model packs (see docs/CREDITS.md), served from /models.
 *
 * Models are drawn with instancing: one draw per mesh part however many copies there
 * are, so a jungle of hundreds of plants stays smooth on an iPad. If a model can't be
 * loaded, the scene shows its built-in block version instead (`fallback`).
 */
const K_PLAT = "/models/kenney-platformer/glb/";
const K_NAT = "/models/kenney-nature/glb/";
const Q_NAT = "/models/quaternius-nature/glTF/";
const Q_ANIM = "/models/quaternius-animals/glTF/";

export const MODELS = {
  // Course
  grassBlock: `${K_PLAT}block-grass.glb`,
  grassBlockLarge: `${K_PLAT}block-grass-large.glb`,
  flag: `${K_PLAT}flag.glb`,
  // Scenery: trees (Quaternius, ~7 units tall), plants, rocks
  trees: [1, 2, 3, 4, 5].map((i) => `${Q_NAT}CommonTree_${i}.gltf`),
  pines: [1, 2, 3, 4, 5].map((i) => `${Q_NAT}Pine_${i}.gltf`),
  bush: `${Q_NAT}Bush_Common_Flowers.gltf`,
  fern: `${Q_NAT}Fern_1.gltf`,
  plantBig: `${Q_NAT}Plant_1_Big.gltf`,
  grass: `${Q_NAT}Grass_Common_Short.gltf`,
  grassTall: `${Q_NAT}Grass_Wispy_Tall.gltf`,
  flowers: [`${Q_NAT}Flower_3_Group.gltf`, `${Q_NAT}Flower_4_Group.gltf`],
  clover: `${Q_NAT}Clover_1.gltf`,
  mushroom: `${Q_NAT}Mushroom_Common.gltf`,
  rocks: [1, 2, 3].map((i) => `${Q_NAT}Rock_Medium_${i}.gltf`),
  // Islands under the scenery
  cliff: `${K_NAT}cliff_block_rock.glb`,
  log: `${K_NAT}log_large.glb`,
  // Animals that roam the scenery
  deer: `${Q_ANIM}Deer.gltf`,
  fox: `${Q_ANIM}Fox.gltf`,
} as const;

/** One placed copy of a model. Rotation is about the vertical axis. */
export interface Placement { p: [number, number, number]; s: number | [number, number, number]; r?: number; color?: THREE.ColorRepresentation }

/** Mesh parts of a model, with their transforms relative to the model's root. */
function useParts(url: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(scene.matrixWorld).invert();
    const parts: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; local: THREE.Matrix4 }[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m as unknown as THREE.SkinnedMesh).isSkinnedMesh) parts.push({ geometry: m.geometry, material: m.material, local: new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld) });
    });
    return parts;
  }, [scene]);
}

function InstancedModel({ url, items, tint = false }: { url: string; items: Placement[]; tint?: boolean }) {
  const parts = useParts(url);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    parts.forEach((part, pi) => {
      const mesh = refs.current[pi];
      if (!mesh) return;
      items.forEach((it, i) => {
        o.position.set(...it.p);
        o.rotation.set(0, it.r ?? 0, 0);
        if (typeof it.s === "number") o.scale.setScalar(it.s);
        else o.scale.set(...it.s);
        o.updateMatrix();
        mesh.setMatrixAt(i, m.multiplyMatrices(o.matrix, part.local));
        if (tint) mesh.setColorAt(i, c.set(it.color ?? "#ffffff"));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [parts, items, tint]);
  if (!items.length) return null;
  return (
    <>
      {parts.map((part, pi) => (
        <instancedMesh key={pi} ref={(el) => { refs.current[pi] = el; }} args={[part.geometry, part.material, items.length]} frustumCulled={false} />
      ))}
    </>
  );
}

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("Model failed to load; using the block version.", e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Instanced copies of a model, with a fallback if it can't be loaded. */
export function Model({ url, items, fallback = null, tint }: { url: string; items: Placement[]; fallback?: ReactNode; tint?: boolean }) {
  return (
    <Fallback fallback={fallback}>
      <Suspense fallback={null}>
        <InstancedModel url={url} items={items} tint={tint} />
      </Suspense>
    </Fallback>
  );
}

/** Group placements by model url, then draw each group instanced. */
export function Models({ groups, fallback = null }: { groups: Map<string, Placement[]>; fallback?: ReactNode }) {
  return (
    <Fallback fallback={fallback}>
      <Suspense fallback={null}>
        {[...groups].map(([url, items]) => <InstancedModel key={url} url={url} items={items} />)}
      </Suspense>
    </Fallback>
  );
}

export { Fallback as ModelFallback };
