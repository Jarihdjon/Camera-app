/**
 * The follow camera's rules, kept apart from drawing so they can be tested.
 *
 * - `yaw` is where the camera looks (0 = along +z, the course direction).
 * - Movement is relative to the camera, but the stick's meaning (`basis`) is held while he
 *   keeps pushing the same way, so the camera turning never pulls him off course.
 * - While he runs, the camera swings round behind his direction of travel: gently for small
 *   sideways moves, faster for a full turn-around, so walking back shows what's ahead.
 * - Turning it by hand pauses the auto-swing for a moment.
 */
export interface CameraState { yaw: number; basis: number; pushing: boolean; rawDir: number; manualUntil: number; recentering: boolean }

export const newCamera = (yaw = 0): CameraState => ({ yaw, basis: yaw, pushing: false, rawDir: 0, manualUntil: 0, recentering: false });

export const wrap = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

/** Hand-turning (radians, + turns the view right) and the "behind Sparky" button. */
export function turn(c: CameraState, manual: number, t: number) {
  if (!manual) return;
  c.yaw = wrap(c.yaw - manual);
  c.manualUntil = t + 2.5;
  c.recentering = false;
}

export function recenterStep(c: CameraState, facing: number, dt: number) {
  if (!c.recentering) return;
  const d = wrap(facing - c.yaw);
  c.yaw = wrap(c.yaw + d * Math.min(1, dt * 6));
  if (Math.abs(d) < 0.02) c.recentering = false;
}

/** Stick (x right, y up) → world direction (x, z). Screen-right at yaw 0 is world -x. */
export function steer(c: CameraState, sx: number, sy: number, turnedByHand: boolean): { x: number; z: number } {
  if (Math.hypot(sx, sy) < 0.2) {
    c.pushing = false;
    c.basis = c.yaw;
  } else {
    const raw = Math.atan2(sx, sy);
    if (!c.pushing || Math.abs(wrap(raw - c.rawDir)) > 0.8 || turnedByHand) {
      c.basis = c.yaw;
      c.rawDir = raw;
    }
    c.pushing = true;
  }
  const sb = Math.sin(c.basis), cb = Math.cos(c.basis);
  return { x: sb * sy - cb * sx, z: cb * sy + sb * sx };
}

/** Swing round behind his direction of travel. */
export function follow(c: CameraState, vx: number, vz: number, dt: number, t: number) {
  const speed = Math.hypot(vx, vz);
  if (speed < 1.2 || t < c.manualUntil || c.recentering) return;
  const d = wrap(Math.atan2(vx, vz) - c.yaw);
  const rate = (Math.abs(d) > 2 ? 2.4 : 1.4) * Math.min(1, speed / 6);
  c.yaw = wrap(c.yaw + Math.max(-rate * dt, Math.min(rate * dt, d)));
}
