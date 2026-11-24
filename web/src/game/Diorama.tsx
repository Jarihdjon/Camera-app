import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, TiltShift2, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Box, Palette } from "@yav/shared/game";
import { rng } from "@yav/shared/game";

/**
 * The "miniature world" look: soft focus at the top and bottom of the screen so the level
 * reads like a tabletop diorama, a warm glow on bright things, gentle colour grading and
 * a vignette. One effects pass, tuned to stay light on an iPad.
 */
export function DioramaEffects({ warmth = 0.12 }: { warmth?: number }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <TiltShift2 blur={0.18} taper={0.55} start={[0.5, 0.0]} end={[0.5, 1.0]} samples={6} />
      <Bloom luminanceThreshold={0.72} luminanceSmoothing={0.25} intensity={0.75} mipmapBlur radius={0.7} />
      <HueSaturation saturation={0.12} hue={warmth * 0.05} />
      <BrightnessContrast brightness={0.02} contrast={0.08} />
      <Vignette offset={0.28} darkness={0.55} />
    </EffectComposer>
  );
}

/** A slightly higher, narrower camera, so the course looks like a miniature. */
export function DioramaCamera() {
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const before = cam.fov;
    cam.fov = 42;
    cam.updateProjectionMatrix();
    return () => {
      cam.fov = before;
      cam.updateProjectionMatrix();
    };
  }, [camera]);
  return null;
}

/** Fireflies that drift and twinkle, and leaves that tumble down through the light. */
export function Ambience({ length, kind }: { length: number; kind: Palette["props"] }) {
  const fireflies = useRef<THREE.Points>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const count = Math.min(220, Math.round(length * 1.6));
  const seeds = useMemo(() => {
    const r = rng("ambience");
    return Array.from({ length: count }, () => ({ x: (r() - 0.5) * 22, y: r() * 7 + 0.5, z: r() * length - 4, p: r() * 10, s: 0.4 + r() * 0.8 }));
  }, [count, length]);
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const glow = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,250,200,1)");
    grad.addColorStop(0.3, "rgba(255,220,120,0.8)");
    grad.addColorStop(1, "rgba(255,200,80,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
  const leafCount = Math.min(120, Math.round(length));
  const leafSeeds = useMemo(() => {
    const r = rng("leaves");
    return Array.from({ length: leafCount }, () => ({ x: (r() - 0.5) * 18, z: r() * length - 4, p: r() * 20, sp: 0.4 + r() * 0.5, c: r() }));
  }, [leafCount, length]);
  const leafColors = kind === "town" ? ["#ffb3c7", "#ffd6e5", "#ffe9a8"] : ["#7ccf5a", "#a6d94a", "#e8b84a", "#d97a3a"];

  useLayoutEffect(() => {
    const m = leaves.current;
    if (!m) return;
    const c = new THREE.Color();
    leafSeeds.forEach((l, i) => m.setColorAt(i, c.set(leafColors[Math.floor(l.c * leafColors.length)]!)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [leafSeeds, leafColors]);

  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    seeds.forEach((s, i) => {
      positions[i * 3] = s.x + Math.sin(t * 0.4 * s.s + s.p) * 0.8;
      positions[i * 3 + 1] = s.y + Math.sin(t * 0.7 * s.s + s.p * 2) * 0.4;
      positions[i * 3 + 2] = s.z + Math.cos(t * 0.3 * s.s + s.p) * 0.8;
    });
    const pts = fireflies.current;
    if (pts) {
      (pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (pts.material as THREE.PointsMaterial).opacity = 0.75 + Math.sin(t * 3) * 0.15;
    }
    const m = leaves.current;
    if (m) {
      leafSeeds.forEach((l, i) => {
        const fall = ((t * l.sp + l.p) % 10) / 10; // 0..1, loops
        o.position.set(l.x + Math.sin(t + l.p) * 1.2, 9 - fall * 12, l.z);
        o.rotation.set(t * 2 + l.p, t * 1.3 + l.p, Math.sin(t + l.p));
        o.scale.setScalar(1);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <points ref={fireflies}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial map={glow} size={0.35} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#fff2b0" />
      </points>
      <instancedMesh ref={leaves} args={[undefined, undefined, leafCount]}>
        <planeGeometry args={[0.22, 0.14]} />
        <meshLambertMaterial side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}

/** Grass tufts and little flowers along the edges of every platform. */
export function Flora({ boxes, palette }: { boxes: Box[]; palette: Palette }) {
  const items = useMemo(() => {
    const r = rng("flora");
    const out: { x: number; y: number; z: number; kind: number; s: number; rot: number; c: string }[] = [];
    const flowers = palette.props === "town" ? ["#ff6f91", "#ffd23f", "#ffffff"] : ["#ff6f91", "#ffd23f", "#b69cff", "#ffffff", "#ff9f43"];
    for (const b of boxes) {
      if (b.move) continue;
      const top = b.y + b.h / 2;
      const n = Math.round(b.d * (b.w > 3 ? 1.6 : 0.8));
      for (let i = 0; i < n; i++) {
        const side = r() < 0.5 ? -1 : 1;
        const x = b.x + side * (b.w / 2 - 0.15 - r() * 0.35);
        const z = b.z - b.d / 2 + r() * b.d;
        const isFlower = r() < 0.35;
        out.push({ x, y: top, z, kind: isFlower ? 1 : 0, s: 0.7 + r() * 0.6, rot: r() * Math.PI, c: isFlower ? flowers[Math.floor(r() * flowers.length)]! : palette.top });
      }
    }
    return out;
  }, [boxes, palette]);
  const grass = useRef<THREE.InstancedMesh>(null);
  const petals = useRef<THREE.InstancedMesh>(null);
  const grassItems = items.filter((i) => i.kind === 0);
  const flowerItems = items.filter((i) => i.kind === 1);
  const blade = useMemo(() => {
    // Three crossed blades make a tuft that looks full from any angle.
    const g = new THREE.ConeGeometry(0.07, 0.38, 3);
    g.translate(0, 0.19, 0);
    return g;
  }, []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    if (grass.current) {
      grassItems.forEach((g, i) => {
        o.position.set(g.x, g.y, g.z);
        o.rotation.set(0, g.rot, (i % 2 ? 0.12 : -0.12));
        o.scale.set(g.s, g.s * (0.8 + (i % 3) * 0.25), g.s);
        o.updateMatrix();
        grass.current!.setMatrixAt(i, o.matrix);
        grass.current!.setColorAt(i, c.set(palette.top).offsetHSL(0.02, 0.05, -0.12 + (i % 4) * 0.04));
      });
      grass.current.instanceMatrix.needsUpdate = true;
      if (grass.current.instanceColor) grass.current.instanceColor.needsUpdate = true;
    }
    if (petals.current) {
      flowerItems.forEach((f, i) => {
        o.position.set(f.x, f.y + 0.16 * f.s, f.z);
        o.rotation.set(0, f.rot, 0);
        o.scale.setScalar(f.s);
        o.updateMatrix();
        petals.current!.setMatrixAt(i, o.matrix);
        petals.current!.setColorAt(i, c.set(f.c));
      });
      petals.current.instanceMatrix.needsUpdate = true;
      if (petals.current.instanceColor) petals.current.instanceColor.needsUpdate = true;
    }
  }, [grassItems, flowerItems, palette]);
  return (
    <>
      <instancedMesh ref={grass} args={[blade, undefined, grassItems.length]}>
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={petals} args={[undefined, undefined, flowerItems.length]}>
        <icosahedronGeometry args={[0.09, 0]} />
        <meshLambertMaterial emissive="#ffffff" emissiveIntensity={0.15} />
      </instancedMesh>
    </>
  );
}

/** Whether to use the rich look. `?look=classic` turns it off for comparison (or for older iPads). */
export const richLook = () => typeof location === "undefined" || !location.search.includes("look=classic");
