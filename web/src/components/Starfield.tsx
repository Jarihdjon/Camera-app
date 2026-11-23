import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Animated space background on one canvas: three layers of twinkling stars drifting
 * at different speeds, the odd shooting star, and two slow planets. Capped at about
 * 160 stars and 30 fps so it stays light on the iPad.
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0, h = 0, raf = 0, last = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type Star = { x: number; y: number; r: number; layer: number; phase: number };
    let stars: Star[] = [];
    let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.min(160, Math.round((w * h) / 7000)) }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.4 + 0.3, layer: Math.floor(Math.random() * 3), phase: Math.random() * Math.PI * 2,
      }));
    };

    const planet = (x: number, y: number, r: number, c1: string, c2: string, ring: boolean) => {
      const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (ring) {
        ctx.strokeStyle = "rgba(255, 214, 140, 0.45)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.7, r * 0.45, -0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 33) return; // ~30 fps
      last = t;
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#0b1030");
      bg.addColorStop(0.6, "#16124a");
      bg.addColorStop(1, "#2a1250");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Soft nebula glow.
      const neb = ctx.createRadialGradient(w * 0.8, h * 0.2, 0, w * 0.8, h * 0.2, w * 0.5);
      neb.addColorStop(0, "rgba(120, 90, 255, 0.18)");
      neb.addColorStop(1, "rgba(120, 90, 255, 0)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, w, h);

      const s = t / 1000;
      planet(w * 0.86 + Math.sin(s / 20) * 12, h * 0.82 + Math.cos(s / 25) * 8, Math.min(w, h) * 0.09, "#ffb27a", "#a2412a", true);
      planet(w * 0.1 + Math.cos(s / 30) * 10, h * 0.16, Math.min(w, h) * 0.035, "#9ef0e0", "#2c6f86", false);

      for (const st of stars) {
        const speed = [4, 9, 16][st.layer]!;
        if (!reduce) st.x -= speed / 30;
        if (st.x < -2) st.x = w + 2;
        const tw = 0.55 + 0.45 * Math.sin(s * 2 + st.phase);
        ctx.globalAlpha = tw * (0.5 + st.layer * 0.25);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r * (1 + st.layer * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (!reduce && !shooting && Math.random() < 0.004) {
        shooting = { x: Math.random() * w * 0.7 + w * 0.3, y: Math.random() * h * 0.3, vx: -14, vy: 6, life: 1 };
      }
      if (shooting) {
        const grad = ctx.createLinearGradient(shooting.x, shooting.y, shooting.x - shooting.vx * 6, shooting.y - shooting.vy * 6);
        grad.addColorStop(0, `rgba(255,255,255,${shooting.life})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shooting.x, shooting.y);
        ctx.lineTo(shooting.x - shooting.vx * 6, shooting.y - shooting.vy * 6);
        ctx.stroke();
        shooting.x += shooting.vx;
        shooting.y += shooting.vy;
        shooting.life -= 0.03;
        if (shooting.life <= 0) shooting = null;
      }
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduce]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 -z-10 h-full w-full" aria-hidden />;
}
