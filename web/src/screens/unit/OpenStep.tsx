import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import { api, type Wallet } from "@/lib/api";
import { useRobot } from "@/components/robot/RobotProvider";
import { useAsk } from "@/components/ask/AskSparky";
import { Button } from "@/components/ui/button";
import { Feedback, Kicker, Prompt, StepCard } from "./shared";

/**
 * A thinking question: tune-in, an open question, or a reflection. Never marked.
 * He can type, dictate, or choose to talk about it with a grown-up instead.
 */
export type OpenState = { text: string; done: null | { model: string | null; talk: boolean } };

export function OpenStep(props: {
  unitId: string;
  activityId?: string;
  kind: "open" | "tune-in" | "reflect";
  label: string;
  prompt: string;
  optional?: boolean;
  extra?: React.ReactNode;
  initial?: OpenState;
  onState?: (s: OpenState) => void;
  onWallet: (w: Wallet) => void;
  onNext: () => void;
}) {
  const [text, setText] = useState(props.initial?.text ?? "");
  const [done, setDone] = useState<null | { model: string | null; talk: boolean }>(props.initial?.done ?? null);
  const onState = props.onState;
  useEffect(() => onState?.({ text, done }), [text, done, onState]);
  const robot = useRobot();
  const ask = useAsk();
  useEffect(() => ask.setScreen({ activityId: props.activityId, prompt: props.prompt }), [props.activityId, props.prompt, ask]);

  async function finish(talkLater: boolean) {
    const r = await api.respond({ unitId: props.unitId, activityId: props.activityId, kind: props.kind, text: talkLater ? "" : text.trim(), talkLater });
    props.onWallet(r.wallet);
    setDone({ model: r.model, talk: talkLater });
    robot.say(talkLater ? "Great idea. Talking about it together is fun!" : r.model ? `Good thinking! One idea is: ${r.model}` : "Thanks for sharing your thinking!", "happy");
  }

  return (
    <StepCard>
      <Kicker>{props.label}</Kicker>
      <Prompt text={props.prompt} />
      {props.extra}
      {!done ? (
        <>
          <textarea
            className="min-h-32 w-full select-text rounded-2xl border-2 border-white/15 bg-black/30 p-4 text-2xl leading-snug outline-none focus:border-[var(--unit)]"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or say what you think"
            maxLength={2000}
          />
          <p className="flex items-center gap-1 text-base text-muted-foreground"><Mic className="size-4" /> Tap the microphone on the keyboard to say it instead of typing.</p>
          <div className="flex flex-wrap gap-3">
            <Button size="kid" disabled={text.trim().length < 3} onClick={() => void finish(false)}>Done</Button>
            {props.optional ? (
              <Button size="kid" variant="secondary" onClick={props.onNext}>Skip</Button>
            ) : (
              <Button size="kid" variant="secondary" onClick={() => void finish(true)}>We'll talk about it</Button>
            )}
          </div>
        </>
      ) : (
        <>
          {done.model && !done.talk && <Feedback tone="good">Good thinking! One idea: {done.model}</Feedback>}
          {!done.model && !done.talk && <Feedback tone="good">Thanks for sharing your thinking!</Feedback>}
          {done.talk && <Feedback tone="try">Saved for talking time with a grown-up.</Feedback>}
          <Button size="kid" variant="success" className="w-fit" onClick={props.onNext}>Next ➜</Button>
        </>
      )}
    </StepCard>
  );
}
