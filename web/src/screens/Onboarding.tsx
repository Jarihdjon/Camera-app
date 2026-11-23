import { useState } from "react";
import { api } from "../lib/api";
import { say } from "../lib/speech";
import { Robot } from "./Robot";

/** Day one: the parent enters his first name, then he names his robot. */
export function Onboarding({ onDone, hasName }: { onDone: () => void; hasName: boolean }) {
  const [value, setValue] = useState("");
  const step = hasName ? "robot" : "name";

  async function save() {
    if (!value.trim()) return;
    await api.setChild(step === "name" ? { firstName: value.trim() } : { robotName: value.trim() });
    if (step === "robot") say(`Hello! My name is ${value.trim()}. Let's go on an adventure!`);
    setValue("");
    onDone();
  }

  return (
    <div className="centre stack">
      <Robot size={180} mood={step === "robot" ? "thinking" : "happy"} />
      <h1>{step === "name" ? "Who is learning today?" : "Your robot needs a name!"}</h1>
      <p className="muted">{step === "name" ? "Grown-ups: type his first name. Only the first name is ever used." : "What will you call it?"}</p>
      <input className="big-input" value={value} onChange={(e) => setValue(e.target.value)} maxLength={30} autoFocus
        onKeyDown={(e) => e.key === "Enter" && void save()} />
      <button className="primary" onClick={() => void save()} disabled={!value.trim()}>{step === "name" ? "Next" : "That's the name!"}</button>
    </div>
  );
}
