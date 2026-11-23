import type { Box } from "@yav/shared/game";

/**
 * Small, predictable platformer physics for box courses: gravity, running, jumping,
 * an optional double jump (Jet boost), riding moving platforms, and push-out from walls.
 */
export const PHYS = { gravity: 30, jump: 11, doubleJump: 10, speed: 6, accel: 40, airAccel: 22, halfW: 0.35, height: 1.4, fallY: -12 };

export interface Body {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  grounded: boolean;
  jumps: number;
  /** Which way Sparky faces, in radians. */
  facing: number;
  /** The moving platform he is standing on, so it can carry him. */
  riding: string | null;
}

export function newBody(x: number, y: number, z: number): Body {
  return { x, y, z, vx: 0, vy: 0, vz: 0, grounded: true, jumps: 0, facing: 0, riding: null };
}

/** Where a box is at time t (moving platforms swing side to side or up and down). */
export function boxAt(b: Box, t: number): { x: number; y: number; z: number } {
  if (!b.move) return b;
  const o = Math.sin(t * b.move.speed + b.move.phase) * b.move.range;
  return b.move.axis === "x" ? { x: b.x + o, y: b.y, z: b.z } : { x: b.x, y: b.y + o, z: b.z };
}

function overlaps(body: Body, c: { x: number; y: number; z: number }, b: Box) {
  return (
    Math.abs(body.x - c.x) < b.w / 2 + PHYS.halfW &&
    Math.abs(body.z - c.z) < b.d / 2 + PHYS.halfW &&
    body.y < c.y + b.h / 2 &&
    body.y + PHYS.height > c.y - b.h / 2
  );
}

export interface StepInput { x: number; y: number; jumpPressed: boolean; jumpHeld: boolean }

/** Advance one step. Returns true if he fell off the world. */
export function step(body: Body, inp: StepInput, dt: number, boxes: Box[], t: number, canDoubleJump: boolean): boolean {
  // Ride a moving platform: move with it before anything else.
  if (body.riding) {
    const b = boxes.find((x) => x.id === body.riding);
    if (b?.move) {
      const now = boxAt(b, t);
      const before = boxAt(b, t - dt);
      body.x += now.x - before.x;
      body.y += now.y - before.y;
    }
  }

  // Run: the stick sets a target velocity; ease towards it.
  const mag = Math.min(1, Math.hypot(inp.x, inp.y));
  const tx = inp.x * PHYS.speed;
  const tz = inp.y * PHYS.speed;
  const a = (body.grounded ? PHYS.accel : PHYS.airAccel) * dt;
  body.vx += Math.max(-a, Math.min(a, tx - body.vx));
  body.vz += Math.max(-a, Math.min(a, tz - body.vz));
  if (mag > 0.15) body.facing = Math.atan2(inp.x, inp.y);

  // Jump, and the Jet boost double jump.
  if (inp.jumpPressed) {
    if (body.grounded) {
      body.vy = PHYS.jump;
      body.jumps = 1;
      body.grounded = false;
    } else if (canDoubleJump && body.jumps < 2) {
      body.vy = PHYS.doubleJump;
      body.jumps = 2;
    }
  }
  // Short hop when the button is released early.
  if (!inp.jumpHeld && body.vy > 4) body.vy -= PHYS.gravity * dt * 1.2;
  body.vy -= PHYS.gravity * dt;

  const placed = boxes.map((b) => ({ b, c: boxAt(b, t) }));

  // Move one axis at a time. A wall only pushes back along the axis he was moving on,
  // and only if he came from that side: running into a step stops him, and never
  // slides him sideways off the edge.
  const EPS = 0.001;
  const isWall = (c: { y: number }, b: Box) => body.y < c.y + b.h / 2 - 0.25;

  const prevX = body.x;
  body.x += body.vx * dt;
  for (const { b, c } of placed) {
    if (!overlaps(body, c, b) || !isWall(c, b)) continue;
    const left = c.x - b.w / 2 - PHYS.halfW;
    const right = c.x + b.w / 2 + PHYS.halfW;
    if (prevX <= left + EPS) { body.x = left; body.vx = 0; }
    else if (prevX >= right - EPS) { body.x = right; body.vx = 0; }
  }
  const prevZ = body.z;
  body.z += body.vz * dt;
  for (const { b, c } of placed) {
    if (!overlaps(body, c, b) || !isWall(c, b)) continue;
    const front = c.z - b.d / 2 - PHYS.halfW;
    const back = c.z + b.d / 2 + PHYS.halfW;
    if (prevZ <= front + EPS) { body.z = front; body.vz = 0; }
    else if (prevZ >= back - EPS) { body.z = back; body.vz = 0; }
  }
  const prevY = body.y;
  body.y += body.vy * dt;
  body.grounded = false;
  body.riding = null;
  for (const { b, c } of placed) {
    if (!overlaps(body, c, b)) continue;
    const top = c.y + b.h / 2;
    const bottom = c.y - b.h / 2;
    if (body.y >= top - 0.35) {
      // Feet at or just under the top surface: land on it, or (rising past a lip) step up onto it.
      body.y = top;
      if (body.vy <= 0) {
        body.vy = 0;
        body.grounded = true;
        body.jumps = 0;
        if (b.move) body.riding = b.id;
      }
    } else if (body.vy > 0 && prevY + PHYS.height <= bottom + 0.05) {
      // Head bumped the underside of something he was fully below.
      body.y = bottom - PHYS.height;
      body.vy = 0;
    }
    // Otherwise he's beside it: the wall checks above handle that, never a vertical snap.
  }
  return body.y < PHYS.fallY;
}
