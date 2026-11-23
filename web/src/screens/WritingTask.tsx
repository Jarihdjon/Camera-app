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
export function WritingTask({ task, onUnlocked }: { task: Unit["writing"]; onUnlocked: () => void }) {
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
    <Card className="gap-5 p-7">
      <h2 className="text-3xl">✏️ Writing mission</h2>
      <p className="font-display text-2xl leading-snug">{task.prompt}</p>
      <p className="text-lg text-muted-foreground">Write {task.sentences} sentence{task.sentences > 1 ? "s" : ""}. You can start with:</p>
      <ul className="grid gap-2">
        {task.starters.map((s, i) => (
          <motion.li key={s} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 * i }} className="rounded-xl bg-white/5 px-4 py-2 text-xl">
            {s}…
          </motion.li>
        ))}
      </ul>
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
        {Array.from({ length: task.sentences }, (_, n) => (
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
