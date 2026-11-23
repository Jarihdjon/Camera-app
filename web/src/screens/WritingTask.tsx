import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Printer } from "lucide-react";
import type { Unit } from "@yav/shared";
import { api } from "@/lib/api";
import { checkPhoto } from "@/lib/blankCheck";
import { useRobot } from "@/components/robot/RobotProvider";
import { pointFrom, useFlyReward } from "@/components/rewards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Print, write, upload. The upload unlocks the next activity. */
export function WritingTask({ task, onUnlocked }: { task: NonNullable<Unit["writing"]>; onUnlocked: () => void }) {
  const mountain = task.format === "story-mountain";
  const [status, setStatus] = useState<"idle" | "checking" | "retake" | "uploading" | "done">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadBtn = useRef<HTMLButtonElement>(null);
  const robot = useRobot();
  const fly = useFlyReward();

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setStatus("checking");
    robot.setMood("thinking");
    // Give the scan animation a moment, so it feels like the robot is really looking.
    const [check] = await Promise.all([checkPhoto(file), new Promise((r) => setTimeout(r, 1200))]);
    if (!check.ok) {
      setStatus("retake");
      robot.say(check.reason === "too-dark" ? "Hmm, that photo is too dark. Try again with the light on!" : "I can't see any writing yet. Write your sentences, then take the photo!", "encourage");
      return;
    }
    setStatus("uploading");
    await api.upload(file, task.id);
    setStatus("done");
    fly("gems", pointFrom(uploadBtn.current), 3);
    robot.say("Brilliant writing! Next mission unlocked!", "cheer");
    onUnlocked();
  }

  return (
    <Card className="gap-5 border-t-4 border-t-[var(--unit,var(--primary))] p-7">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-[var(--unit,var(--primary))]">Take action · {mountain ? "plan your own story" : "writing mission"}</p>
      <h2 className="text-3xl">{mountain ? "⛰️ Story Mountain" : "✏️ Writing mission"}</h2>
      <p className="font-display text-2xl leading-snug">{task.prompt}</p>
      {mountain ? (
        <StoryMountain />
      ) : (
        <>
          <p className="text-lg text-muted-foreground">Write {task.sentences} sentence{task.sentences > 1 ? "s" : ""}. You can start with:</p>
          <ul className="grid gap-2">
            {task.starters.map((s, i) => (
              <motion.li key={s} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 * i }} className="rounded-xl bg-white/5 px-4 py-2 text-xl">
                {s}…
              </motion.li>
            ))}
          </ul>
        </>
      )}
      <p className="text-lg text-muted-foreground">{mountain ? "Print the mountain sheet, write a few words at each stage, then take a photo of it." : "Print your sheet, write on it, then take a photo."}</p>
      <div className="flex flex-wrap gap-3">
        <Button size="kid" variant="secondary" onClick={() => window.print()}><Printer className="size-6" /> Print my sheet</Button>
        <Button ref={uploadBtn} size="kid" onClick={() => fileInput.current?.click()} disabled={status === "checking" || status === "uploading"}><Camera className="size-6" /> Upload my page</Button>
      </div>
      {/* capture="environment" opens the back camera; works over plain http on home Wi-Fi. */}
      <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onPhoto(e.target.files?.[0])} />

      <AnimatePresence>
        {preview && (status === "checking" || status === "uploading") && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative mx-auto w-56 overflow-hidden rounded-2xl border-2 border-glow/60">
            <img src={preview} alt="Your page" className="block aspect-[3/4] w-full object-cover" />
            {/* Scanner line sweeps over the photo. */}
            <motion.div className="absolute inset-x-0 h-1.5 bg-glow shadow-[0_0_20px_6px] shadow-glow/70" animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }} />
            <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-sm">{status === "checking" ? "Scanning…" : "Saving to your journal…"}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Only this part is printed: one page, big lines, no drawing box. */}
      <section className="print-sheet" aria-hidden>
        <h1>{task.prompt}</h1>
        {mountain
          ? STAGES.map((st, n) => (
              <div key={st.name} className="print-line-group">
                <p className="starter"><b>{n + 1}. {st.name}</b> — {st.prompt}</p>
                <div className="line" />
              </div>
            ))
          : Array.from({ length: task.sentences }, (_, n) => (
              <div key={n} className="print-line-group">
                <p className="starter">{task.starters[n] ?? ""}</p>
                <div className="line" /><div className="line" />
              </div>
            ))}
        <p className="print-footer">Name: ________________ Date: ____________</p>
      </section>
    </Card>
  );
}

/** The five stages of a Story Mountain, as in the Inquirer's Journal. */
export const STAGES = [
  { name: "Orientation", prompt: "Who is your character? Where and when is the story set?", emoji: "🧭" },
  { name: "Problem", prompt: "What goes wrong, or what does your character want?", emoji: "❗" },
  { name: "Climax", prompt: "What is the most exciting or tricky moment?", emoji: "⚡" },
  { name: "Resolution", prompt: "How does your character solve the problem?", emoji: "🛠️" },
  { name: "Ending", prompt: "How does everyone feel now? What has changed?", emoji: "🌈" },
];

/** Tap each peak to hear what goes there. The climb is the build-up; the top is the climax. */
function StoryMountain() {
  const robot = useRobot();
  const [on, setOn] = useState<number | null>(null);
  const xs = [50, 190, 320, 450, 590];
  const ys = [150, 100, 34, 96, 150];
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 640 200" className="w-full" role="img" aria-label="Story mountain with five stages">
        <defs>
          <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--unit, #ffc94d)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--unit, #ffc94d)" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={`M0 190 L${xs.map((x, i) => `${x} ${ys[i]}`).join(" L")} L640 190 Z`} fill="url(#mtn)" />
        <motion.polyline points={xs.map((x, i) => `${x},${ys[i]}`).join(" ")} fill="none" stroke="var(--unit, #ffc94d)" strokeWidth={5} strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
        {STAGES.map((st, i) => (
          <g key={st.name} className="cursor-pointer" onClick={() => { setOn(i); robot.say(`${st.name}. ${st.prompt}`, "happy"); }}>
            <motion.circle cx={xs[i]} cy={ys[i]} r={22} fill={on === i ? "var(--unit, #ffc94d)" : "#1b2150"} stroke="var(--unit, #ffc94d)" strokeWidth={4}
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.15, type: "spring" }} style={{ transformBox: "fill-box", transformOrigin: "center" }} />
            <text x={xs[i]} y={ys[i]! + 8} textAnchor="middle" fontSize={22}>{st.emoji}</text>
            <text x={xs[i]} y={196} textAnchor="middle" fontSize={17} fill="#cfd6ff">{st.name}</text>
          </g>
        ))}
      </svg>
      <AnimatePresence mode="wait">
        {on !== null && (
          <motion.div key={on} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl bg-white/5 px-5 py-3 text-xl">
            <b className="font-display">{on + 1}. {STAGES[on]!.name}:</b> {STAGES[on]!.prompt}
          </motion.div>
        )}
      </AnimatePresence>
      {on === null && <p className="text-lg text-muted-foreground">Tap each circle to hear what goes there.</p>}
    </div>
  );
}
