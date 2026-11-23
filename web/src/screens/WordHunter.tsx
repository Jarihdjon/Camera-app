import { useState } from "react";
import type { Passage } from "@yav/shared";
import { api, type Wallet } from "../lib/api";
import { say } from "../lib/speech";

/**
 * Word Hunter: every word is tappable. Tapping always earns a gem and never
 * costs anything, so asking about words becomes the winning move.
 */
export function WordHunter({ passage, robotName, onWallet, onNext }: { passage: Passage; robotName: string; onWallet: (w: Wallet) => void; onNext: () => void }) {
  const [tapped, setTapped] = useState<Set<string>>(new Set());
  const [explain, setExplain] = useState<string | null>(null);
  const glossary = new Map(passage.glossary.map((g) => [g.word.toLowerCase(), g.meaning]));

  async function tap(raw: string) {
    const word = raw.toLowerCase().replace(/[^a-z'-]/g, "");
    if (!word) return;
    const meaning = glossary.get(word);
    const line = meaning ? `${raw.replace(/[^A-Za-z'-]/g, "")}: ${meaning}` : `Great word to ask about! I've saved "${word}" in your Word Vault.`;
    setExplain(line);
    say(line);
    setTapped((s) => new Set(s).add(word));
    const r = await api.tapWord(word, meaning);
    onWallet(r.wallet);
  }

  return (
    <div className="stack">
      <h2>{passage.title}</h2>
      <p className="muted">Tap any word you're not sure about. Every tap earns a 💎</p>
      <p className="passage">
        {passage.text.split(/(\s+)/).map((tok, i) =>
          /\s+/.test(tok) ? tok : (
            <span key={i} className={`word ${tapped.has(tok.toLowerCase().replace(/[^a-z'-]/g, "")) ? "tapped" : ""}`} onClick={() => void tap(tok)}>{tok}</span>
          ),
        )}
      </p>
      {explain && <div className="bubble"><strong>{robotName}:</strong> {explain}</div>}
      <div className="row">
        <button onClick={() => say(passage.text)}>🔊 Read it to me</button>
        <button className="primary" onClick={onNext}>I've read it</button>
      </div>
    </div>
  );
}
