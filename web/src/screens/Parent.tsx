import { useState } from "react";
import { api } from "../lib/api";

/** PIN-protected parent area. Phase 1 adds the weekly digest, allowance editor and steering. */
export function Parent({ onBack }: { onBack: () => void }) {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState("");
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [queue, setQueue] = useState<Awaited<ReturnType<typeof api.parent.reviewQueue>>>([]);

  async function login() {
    try {
      await api.parent.login(pin);
      setAuthed(true);
      setSettings(await api.parent.settings());
      setQueue(await api.parent.reviewQueue());
    } catch {
      setErr("Wrong PIN");
    }
  }

  async function review(id: string, status: "thumbs-up" | "redo") {
    await api.parent.review(id, status);
    setQueue(await api.parent.reviewQueue());
  }

  if (!authed)
    return (
      <div className="centre stack">
        <h1>Grown-ups only</h1>
        <input className="big-input" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void login()} />
        {err && <p className="error">{err}</p>}
        <div className="row"><button onClick={onBack}>Back</button><button className="primary" onClick={() => void login()}>Enter</button></div>
      </div>
    );

  return (
    <div className="screen parent">
      <div className="row"><button onClick={onBack}>← Back</button><h1>Parent area</h1></div>
      <h2>Review queue</h2>
      {queue.length === 0 && <p className="muted">No pages yet.</p>}
      <div className="review-grid">
        {queue.map((u) => (
          <figure key={u.id} className={`review ${u.review_status}`}>
            <img src={`/api/uploads/${u.id}/file`} alt="Writing page" loading="lazy" />
            <figcaption>
              {new Date(u.created_at + "Z").toLocaleString("en-AU")} · {u.review_status}
              <div className="row"><button onClick={() => void review(u.id, "thumbs-up")}>👍</button><button onClick={() => void review(u.id, "redo")}>Ask for a redo</button></div>
            </figcaption>
          </figure>
        ))}
      </div>
      <h2>Settings</h2>
      <pre className="settings">{JSON.stringify(settings, null, 2)}</pre>
    </div>
  );
}
