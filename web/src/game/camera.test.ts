import { describe, expect, it } from "vitest";
import { follow, newCamera, steer, turn, wrap } from "./camera";
import { newBody, step } from "./physics";

/** Run `secs` of play on open ground with the stick held, returning the camera and body. */
function play(c = newCamera(), stick: { x: number; y: number }, secs: number, body = newBody(0, 0, 0)) {
  const floor = [{ id: "f", x: 0, y: -0.5, z: 0, w: 400, h: 1, d: 400, kind: "ground" as const }];
  const dt = 1 / 60;
  for (let i = 0; i < secs * 60; i++) {
    const w = steer(c, stick.x, stick.y, false);
    step(body, { x: w.x, y: w.z, jumpPressed: false, jumpHeld: false }, dt, floor, i * dt, false);
    follow(c, body.vx, body.vz, dt, i * dt);
  }
  return { c, body };
}

describe("follow camera", () => {
  it("up on the stick walks along the course at the start", () => {
    const { body } = play(undefined, { x: 0, y: 1 }, 1);
    expect(body.z).toBeGreaterThan(3);
    expect(Math.abs(body.x)).toBeLessThan(0.01);
  });

  it("right on the stick walks to screen-right (world -x at the start)", () => {
    const { body } = play(newCamera(), { x: 1, y: 0 }, 0.5);
    expect(body.x).toBeLessThan(-1);
  });

  it("walking back turns the camera round to look the way he's going", () => {
    const { c, body } = play(newCamera(), { x: 0, y: -1 }, 3);
    expect(body.z).toBeLessThan(-8); // he kept walking back the whole time (no spiralling)
    expect(Math.abs(wrap(c.yaw - Math.PI))).toBeLessThan(0.3); // camera now looks along -z
  });

  it("holding sideways swings the camera to follow, and he keeps a straight line", () => {
    const { c, body } = play(newCamera(), { x: 1, y: 0 }, 3);
    expect(Math.abs(wrap(c.yaw + Math.PI / 2))).toBeLessThan(0.3);
    expect(Math.abs(body.z)).toBeLessThan(0.5);
  });

  it("after letting go, up means the new way the camera faces", () => {
    const { c, body } = play(newCamera(), { x: 0, y: -1 }, 3);
    const z0 = body.z;
    steer(c, 0, 0, false);
    play(c, { x: 0, y: 1 }, 1, body);
    expect(body.z).toBeLessThan(z0 - 3); // still heading along -z
  });

  it("turning by hand pauses the auto-swing", () => {
    const c = newCamera();
    turn(c, 1, 0);
    const yaw = c.yaw;
    follow(c, 6, 0, 1 / 60, 1);
    expect(c.yaw).toBe(yaw);
  });
});
