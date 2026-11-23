import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { useRobot, type Mood } from "@/components/robot/RobotProvider";

/**
 * Sparky in 3D: an original robot with a cream TV-style head, an LED face screen,
 * orange bolt ears, a bulb antenna, a round orange body, a flowing cape, and hands
 * and feet that float on their own. The face is drawn on a canvas each frame, so the
 * blinking, moods and lip-sync work just like the 2D robot.
 */
const COL = { shell: "#f6ecda", trim: "#ff8a3d", trimDark: "#d9622a", screen: "#0d3a44", bulb: "#7cf0d8", led: "#ffc94d", cape: "#ff7a1f", capeTrim: "#ffd36b" };

function drawFace(g: CanvasRenderingContext2D, mood: Mood, blink: boolean, mouthOpen: number, speaking: boolean, look: number) {
  const W = 256, H = 160;
  g.fillStyle = COL.screen;
  g.fillRect(0, 0, W, H);
  // Faint LED grid.
  g.fillStyle = "rgba(255,255,255,0.05)";
  for (let x = 4; x < W; x += 8) for (let y = 4; y < H; y += 8) g.fillRect(x, y, 2, 2);
  g.fillStyle = COL.led;
  g.strokeStyle = COL.led;
  g.lineCap = "round";
  g.shadowColor = COL.led;
  g.shadowBlur = 16;
  const eyes = [88 + look * 8, 168 + look * 8];
  for (const cx of eyes) {
    const cy = 66;
    if (blink && mood !== "sleepy") {
      g.lineWidth = 8;
      g.beginPath(); g.moveTo(cx - 16, cy); g.lineTo(cx + 16, cy); g.stroke();
    } else if (mood === "cheer") {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2, r = i % 2 ? 11 : 26;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath(); g.fill();
    } else if (mood === "happy" || mood === "wave") {
      g.lineWidth = 11;
      g.beginPath(); g.arc(cx, cy + 10, 18, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    } else if (mood === "sleepy") {
      g.lineWidth = 8;
      g.beginPath(); g.arc(cx, cy - 4, 16, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
    } else {
      g.beginPath(); g.roundRect(cx - 14, cy - 22, 28, 44, 14); g.fill();
    }
  }
  // Mouth.
  g.lineWidth = 8;
  if (speaking) {
    const ry = 4 + mouthOpen * 16;
    g.beginPath(); g.ellipse(128, 122, 18 - mouthOpen * 4, ry, 0, 0, Math.PI * 2); g.stroke();
  } else if (mood === "cheer") {
    g.beginPath(); g.moveTo(100, 112); g.quadraticCurveTo(128, 150, 156, 112); g.closePath(); g.fill();
  } else if (mood === "encourage" || mood === "thinking") {
    g.beginPath(); g.moveTo(114, 124); g.quadraticCurveTo(128, 118, 142, 124); g.stroke();
  } else {
    g.beginPath(); g.moveTo(106, 116); g.quadraticCurveTo(128, 136, 150, 116); g.stroke();
  }
  g.shadowBlur = 0;
}

export function Sparky3D({ moving = 0, airborne = false, jet = false }: { moving?: number; airborne?: boolean; jet?: boolean }) {
  const robot = useRobot();
  const { canvas, ctx, tex } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 160;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, ctx: canvas.getContext("2d")!, tex };
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  void canvas;

  const geo = useMemo(() => ({
    head: new RoundedBoxGeometry(1.15, 0.85, 0.8, 4, 0.28),
    screen: new RoundedBoxGeometry(0.86, 0.58, 0.05, 3, 0.12),
    body: new THREE.SphereGeometry(0.42, 24, 18),
    ear: new THREE.CylinderGeometry(0.13, 0.13, 0.12, 16),
    hand: new THREE.SphereGeometry(0.13, 16, 12),
    foot: new THREE.SphereGeometry(0.15, 16, 12),
    bulb: new THREE.SphereGeometry(0.08, 12, 10),
    stalk: new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6),
    cape: (() => {
      // A tapered cape: narrow at the shoulders, wider at the hem.
      const g = new THREE.PlaneGeometry(1, 0.8, 6, 8);
      const p = g.attributes.position!;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const k = 0.34 + (0.4 - y) * 0.42; // half-width: 0.34 top, ~0.68 bottom
        p.setX(i, p.getX(i) * k);
      }
      return g;
    })(),
  }), []);
  const mat = useMemo(() => ({
    shell: new THREE.MeshStandardMaterial({ color: COL.shell, roughness: 0.35, metalness: 0.05 }),
    trim: new THREE.MeshStandardMaterial({ color: COL.trim, roughness: 0.4 }),
    body: new THREE.MeshStandardMaterial({ color: "#ff8f45", roughness: 0.35 }),
    face: new THREE.MeshBasicMaterial({ map: tex }),
    bulb: new THREE.MeshStandardMaterial({ color: COL.bulb, emissive: COL.bulb, emissiveIntensity: 1.2 }),
    cape: new THREE.MeshStandardMaterial({ color: COL.cape, side: THREE.DoubleSide, roughness: 0.6 }),
  }), [tex]);

  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const hands = useRef<THREE.Group[]>([]);
  const feet = useRef<THREE.Group[]>([]);
  const cape = useRef<THREE.Mesh>(null);
  const flames = useRef<THREE.Mesh[]>([]);
  const blink = useRef({ until: 0, next: 2 });
  const capeBase = useMemo(() => geo.cape.attributes.position!.array.slice(), [geo]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Blink every few seconds.
    if (t > blink.current.next) {
      blink.current.until = t + 0.12;
      blink.current.next = t + 2 + Math.random() * 4;
    }
    drawFace(ctx, robot.mood, t < blink.current.until, robot.mouth.get(), robot.speaking, Math.sin(t * 0.7) * 0.4);
    tex.needsUpdate = true;

    const run = Math.min(1, moving);
    if (root.current) {
      root.current.position.y = 0.05 + (airborne ? 0 : Math.abs(Math.sin(t * 10)) * 0.08 * run) + Math.sin(t * 2.4) * 0.04;
      root.current.rotation.x = run * 0.18;
    }
    if (head.current) head.current.rotation.z = Math.sin(t * 1.3) * 0.04 + (robot.mood === "thinking" ? 0.12 : 0);
    hands.current.forEach((h, i) => {
      const s = i ? 1 : -1;
      const swing = Math.sin(t * 10 + i * Math.PI) * 0.25 * run;
      const cheer = robot.mood === "cheer" ? 0.5 : 0;
      h.position.set(s * 0.6, 0.55 + Math.sin(t * 2.6 + i) * 0.05 + cheer, swing);
    });
    feet.current.forEach((f, i) => {
      const step = Math.sin(t * 10 + i * Math.PI) * 0.22 * run;
      f.position.set((i ? 1 : -1) * 0.2, 0.08 + Math.max(0, step) * 0.5, step);
    });
    flames.current.forEach((m) => {
      m.visible = airborne && jet;
      m.scale.y = 0.8 + Math.random() * 0.6;
    });
    // Cape ripples, and streams out behind when running or in the air.
    const pos = geo.cape.attributes.position!;
    const flow = 0.15 + run * 0.6 + (airborne ? 0.4 : 0);
    for (let i = 0; i < pos.count; i++) {
      const bx = capeBase[i * 3]!, by = capeBase[i * 3 + 1]!;
      const down = 0.4 - by; // 0 at the shoulders, 0.8 at the hem
      // Curves around his back, and streams out behind (negative z) as he moves.
      pos.setZ(i, -down * flow - bx * bx * 0.6 - Math.sin(t * 8 + by * 6 + bx * 3) * 0.04 * down * 2);
    }
    pos.needsUpdate = true;
  });

  return (
    <group ref={root}>
      {/* Head with the LED face, bolt ears and bulb antenna. */}
      <group ref={head} position={[0, 1.25, 0]}>
        <mesh geometry={geo.head} material={mat.shell} castShadow />
        <mesh geometry={geo.screen} material={mat.face} position={[0, -0.02, 0.405]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.ear} material={mat.trim} position={[s * 0.62, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
        ))}
        <mesh geometry={geo.stalk} material={mat.trim} position={[0, 0.53, 0]} />
        <mesh geometry={geo.bulb} material={mat.bulb} position={[0, 0.68, 0]} />
      </group>
      {/* Round orange body with a heart light. */}
      <mesh geometry={geo.body} material={mat.body} position={[0, 0.6, 0]} scale={[1, 0.9, 0.9]} castShadow />
      <mesh position={[0, 0.62, 0.37]}>
        <circleGeometry args={[0.09, 16]} />
        <meshBasicMaterial color="#ff6f91" />
      </mesh>
      {/* Cape hangs from the shoulders, behind. */}
      <mesh ref={cape} geometry={geo.cape} material={mat.cape} position={[0, 0.55, -0.36]} />
      {/* Gold clasp at the collar. */}
      <mesh position={[0, 0.93, -0.3]}>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial color={COL.capeTrim} emissive={COL.capeTrim} emissiveIntensity={0.3} />
      </mesh>
      {/* Floating hands and feet. */}
      {[0, 1].map((i) => (
        <group key={`h${i}`} ref={(el) => { if (el) hands.current[i] = el; }}>
          <mesh geometry={geo.hand} material={mat.shell} />
        </group>
      ))}
      {[0, 1].map((i) => (
        <group key={`f${i}`} ref={(el) => { if (el) feet.current[i] = el; }}>
          <mesh geometry={geo.foot} material={mat.shell} scale={[1, 0.7, 1.3]} />
          <mesh ref={(el) => { if (el) flames.current[i] = el; }} position={[0, -0.22, 0]} visible={false}>
            <coneGeometry args={[0.1, 0.35, 10]} />
            <meshBasicMaterial color="#ffb340" transparent opacity={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
