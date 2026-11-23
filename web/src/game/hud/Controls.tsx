import { useRef, useState } from "react";
import { pressJump, releaseJump, setStick } from "../input";
import { unlockAudio } from "../sfx";

/** On-screen joystick (left thumb) and jump button (right thumb). */
export function Controls() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);

  function move(e: React.PointerEvent) {
    const r = base.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = r.width / 2;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx *= max / len; dy *= max / len; }
    setKnob({ x: dx, y: dy });
    setStick(dx / max, -dy / max);
  }
  function end() {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    setStick(0, 0);
  }

  return (
    <>
      <div
        ref={base}
        aria-label="Move"
        className="pointer-events-auto fixed bottom-8 left-8 z-30 size-40 touch-none rounded-full border-4 border-white/25 bg-white/10 backdrop-blur-sm"
        onPointerDown={(e) => { unlockAudio(); active.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={(e) => { if (active.current === e.pointerId) move(e); }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="absolute left-1/2 top-1/2 size-16 rounded-full bg-white/70 shadow-lg" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>
      <button
        type="button"
        aria-label="Jump"
        className="pointer-events-auto fixed bottom-10 right-10 z-30 grid size-28 touch-none place-items-center rounded-full border-4 border-white/40 bg-primary/90 font-display text-2xl font-bold text-primary-foreground shadow-[0_6px_0_0_var(--primary-shadow)] active:translate-y-1"
        onPointerDown={(e) => { e.preventDefault(); unlockAudio(); pressJump(); }}
        onPointerUp={releaseJump}
        onPointerCancel={releaseJump}
      >
        Jump
      </button>
    </>
  );
}
