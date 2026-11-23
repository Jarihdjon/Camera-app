/**
 * One shared input state, filled by the on-screen joystick and jump button, the keyboard
 * (for testing on a computer) and a game controller paired to the iPad (Gamepad API:
 * left stick to move, the bottom face button to jump).
 */
export const input = {
  x: 0, // -1 left .. 1 right
  y: 0, // -1 back .. 1 forward
  jumpPressed: false, // true for one frame when jump is pressed
  jumpHeld: false,
  /** Forced input for automated tests. */
  override: null as null | { x: number; y: number },
};

const keys = new Set<string>();
let listening = false;
export function listenKeyboard() {
  if (listening) return;
  listening = true;
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === "Space") pressJump();
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
    if (e.code === "Space") input.jumpHeld = false;
  });
}

export function pressJump() {
  input.jumpPressed = true;
  input.jumpHeld = true;
}
export function releaseJump() {
  input.jumpHeld = false;
}

let padJumpWas = false;
let stick = { x: 0, y: 0 };
export function setStick(x: number, y: number) {
  stick = { x, y };
}

/** Called once per frame: merges every input source. */
export function pollInput() {
  let x = stick.x;
  let y = stick.y;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x = -1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x = 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) y = 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) y = -1;
  const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] ?? 0;
    const ay = p.axes[1] ?? 0;
    if (Math.hypot(ax, ay) > 0.2) {
      x = ax;
      y = -ay;
    }
    const jump = Boolean(p.buttons[0]?.pressed);
    if (jump && !padJumpWas) pressJump();
    if (!jump && padJumpWas) releaseJump();
    padJumpWas = jump;
    break;
  }
  if (input.override) ({ x, y } = input.override);
  input.x = Math.max(-1, Math.min(1, x));
  input.y = Math.max(-1, Math.min(1, y));
}

/** For the gate panel: which face button was just pressed on a controller (0..3). */
export function padButtonPressed(): number | null {
  const p = navigator.getGamepads?.()[0];
  if (!p) return null;
  const i = p.buttons.findIndex((b, k) => k < 4 && b.pressed);
  return i >= 0 ? i : null;
}
