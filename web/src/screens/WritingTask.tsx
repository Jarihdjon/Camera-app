import { useRef, useState } from "react";
import type { Unit } from "@yav/shared";
import { api } from "../lib/api";
import { checkPhoto } from "../lib/blankCheck";
import { say } from "../lib/speech";

/** Print, write, upload. The upload unlocks the next activity. */
export function WritingTask({ task, onUnlocked }: { task: Unit["writing"]; onUnlocked: () => void }) {
  const [status, setStatus] = useState<"idle" | "checking" | "retake" | "uploading" | "done">("idle");
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setStatus("checking");
    const check = await checkPhoto(file);
    if (!check.ok) {
      setStatus("retake");
      setMessage(check.reason === "too-dark" ? "That photo is too dark. Try again with the light on." : "I can't see any writing yet. Write your sentences, then take the photo.");
      return;
    }
    setStatus("uploading");
    await api.upload(file, task.id);
    setStatus("done");
    say("Brilliant writing! Next mission unlocked.");
    onUnlocked();
  }

  return (
    <div className="stack">
      <h2>Writing mission</h2>
      <p className="prompt">{task.prompt}</p>
      <p className="muted">Write {task.sentences} sentence{task.sentences > 1 ? "s" : ""}. You can start with:</p>
      <ul className="starters">{task.starters.map((s) => <li key={s}>{s}…</li>)}</ul>
      <div className="row">
        <button onClick={() => window.print()}>🖨 Print my sheet</button>
        <button className="primary" onClick={() => fileInput.current?.click()} disabled={status === "checking" || status === "uploading"}>📷 Upload my page</button>
      </div>
      {/* capture="environment" opens the back camera; works over plain http on home Wi-Fi. */}
      <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onPhoto(e.target.files?.[0])} />
      {status === "checking" && <p>Checking your page…</p>}
      {status === "uploading" && <p>Sending it to your journal…</p>}
      {status === "retake" && <div className="bubble hint">{message}</div>}

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
    </div>
  );
}
