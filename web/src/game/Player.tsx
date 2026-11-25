import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Box } from "@yav/shared/game";
import { input, pollInput } from "./input";
import { newBody, step, boxAt, type Body } from "./physics";
import { Sparky3D } from "./Sparky3D";
import { sfx } from "./sfx";
import { follow, newCamera, recenterStep, steer, turn } from "./camera";

export interface PlayerHandle {
  body: Body;
  teleport: (x: number, y: number, z: number) => void;
}

/**
 * Sparky plus the physics and a free follow camera.
 *
 * The camera orbits behind him at a set height and distance (`cameraOffset`: [unused,
 * height, -distance]). Movement is relative to the camera: up on the stick is "away from
 * the camera". When he runs in a new direction the camera gently swings round behind him,
 * so if he turns and walks back the way he came, it turns too and shows what's ahead.
 * Dragging the screen, the right stick, L1/R1 or Q/E turn it by hand; the camera button
 * swings it back behind him.
 *
 * So the camera turning never pulls him off course, the stick's meaning is held steady
 * while he keeps pushing the same way, and only updates when he lets go or changes direction.
 */
export const Player = forwardRef<PlayerHandle, {
  boxes: Box[];
  spawn: { x: number; y: number; z: number };
  frozen?: boolean;
  jet?: boolean;
  onMove?: (b: Body, t: number) => void;
  onFall?: () => void;
  cameraOffset?: [number, number, number];
}>(function Player({ boxes, spawn, frozen = false, jet = false, onMove, onFall, cameraOffset = [0, 5.2, -8] }, ref) {
  const body = useRef<Body>(newBody(spawn.x, spawn.y, spawn.z));
  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const [anim, setAnim] = useState({ moving: 0, airborne: false });
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(spawn.x, spawn.y + 1, spawn.z + 4));
  /** Camera direction (0 looks along +z), the stick basis held while pushing, and when hand-turning stopped. */
  const cam = useRef(newCamera());
  const height = cameraOffset[1];
  const dist = -cameraOffset[2];
  const lastAnim = useRef("");

  useImperativeHandle(ref, () => ({
    body: body.current,
    teleport: (x, y, z) => {
      Object.assign(body.current, newBody(x, y, z));
      // Checkpoints face along the course again.
      Object.assign(cam.current, newCamera());
      camera.position.set(x, y + height, z - dist);
      look.current.set(x, y + 1, z + 4);
    },
  }), [camera, cameraOffset]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const t = clock.elapsedTime;
    const b = body.current;
    pollInput();
    const c = cam.current;
    // Turning the camera by hand.
    const manual = frozen ? 0 : input.lookDelta * 0.008 + input.lookRate * 2.4 * dt;
    input.lookDelta = 0;
    turn(c, manual, t);
    if (input.recenter) {
      input.recenter = false;
      c.recentering = true;
    }
    recenterStep(c, b.facing, dt);
    const w = steer(c, frozen ? 0 : input.x, frozen ? 0 : input.y, Boolean(manual));
    const wx = w.x, wz = w.z;
    const inp = frozen ? { x: 0, y: 0, jumpPressed: false, jumpHeld: false } : { x: wx, y: wz, jumpPressed: input.jumpPressed, jumpHeld: input.jumpHeld };
    if (inp.jumpPressed && (b.grounded || (jet && b.jumps < 2))) sfx.jump();
    input.jumpPressed = false;
    // Two half-steps keep fast falls from skipping through thin platforms.
    let fell = step(b, { ...inp, jumpPressed: inp.jumpPressed }, dt / 2, boxes, t - dt / 2, jet);
    fell = step(b, { ...inp, jumpPressed: false }, dt / 2, boxes, t, jet) || fell;
    if (fell) onFall?.();

    if (group.current) {
      group.current.position.set(b.x, b.y, b.z);
      const target = b.facing;
      const cur = group.current.rotation.y;
      let d = target - cur;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      group.current.rotation.y = cur + d * Math.min(1, dt * 12);
    }
    // Blob shadow on the highest surface below him.
    let ground = -50;
    for (const box of boxes) {
      const c = boxAt(box, t);
      const top = c.y + box.h / 2;
      if (Math.abs(b.x - c.x) < box.w / 2 && Math.abs(b.z - c.z) < box.d / 2 && top <= b.y + 0.05 && top > ground) ground = top;
    }
    if (shadow.current) {
      shadow.current.visible = ground > -50;
      shadow.current.position.set(b.x, ground + 0.02, b.z);
      const s = Math.max(0.4, 1 - (b.y - ground) * 0.15);
      shadow.current.scale.set(s, s, s);
    }
    // The camera swings round behind the way he's running (unless he's turning it by hand).
    if (!frozen) follow(c, b.vx, b.vz, dt, t);
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const want = new THREE.Vector3(b.x - fx * dist, b.y + height, b.z - fz * dist);
    camera.position.lerp(want, Math.min(1, dt * 5));
    look.current.lerp(new THREE.Vector3(b.x + fx * 4, b.y + 1, b.z + fz * 4), Math.min(1, dt * 7));
    camera.lookAt(look.current);

    const moving = Math.min(1, Math.hypot(b.vx, b.vz) / 6);
    const key = `${moving > 0.2 ? 1 : 0}${b.grounded ? 0 : 1}`;
    if (key !== lastAnim.current) {
      lastAnim.current = key;
      setAnim({ moving: moving > 0.2 ? 1 : 0, airborne: !b.grounded });
    }
    onMove?.(b, t);
  });

  return (
    <>
      <group ref={group}>
        <Sparky3D moving={anim.moving} airborne={anim.airborne} jet={jet} />
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </>
  );
});
