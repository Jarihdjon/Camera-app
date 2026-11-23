import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HelpCircle, Lightbulb, Mic, Send, Volume2, X } from "lucide-react";
import { api, type AskReply, type Wallet } from "@/lib/api";
import { Robot } from "@/components/robot/Robot";
import { useRobot, type Mood } from "@/components/robot/RobotProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Ask Sparky: a help panel that is always one tap away during a unit.
 * The server keeps the robot grounded in this unit only; this panel just
 * says which unit and which activity are on screen.
 */
interface AskApi {
  /** Tell the helper what's on screen so answers fit it. */
  setScreen: (s: { activityId?: string; prompt?: string }) => void;
  open: (question?: string) => void;
  /** Explain a word he tapped, in the sentence it came from. Resolves to the reply text. */
  explainWord: (word: string, sentence: string) => Promise<string>;
}
const Ctx = createContext<AskApi | null>(null);
export const useAsk = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAsk must be used inside <AskSparky>");
  return c;
};

type Msg = { from: "me" | "bot"; text: string; kind?: AskReply["kind"] };
const MOOD: Record<AskReply["kind"], Mood> = { answer: "happy", word: "happy", "off-topic": "thinking", "grown-up": "encourage", offline: "encourage", limit: "sleepy" };

export function AskSparky({ unitId, robotName, parts, onWallet, children }: { unitId: string; robotName: string; parts: string[]; onWallet?: (w: Wallet) => void; children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const screen = useRef<{ activityId?: string; prompt?: string }>({});
  const robot = useRobot();
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const refreshWallet = useCallback(async () => {
    if (onWallet) onWallet((await api.child()).wallet);
  }, [onWallet]);

  const send = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setText("");
    setMsgs((m) => [...m, { from: "me", text: q }]);
    setBusy(true);
    robot.setMood("thinking");
    try {
      const r = await api.ask({ unitId, activityId: screen.current.activityId, question: q });
      setMsgs((m) => [...m, { from: "bot", text: r.reply, kind: r.kind }]);
      robot.say(r.reply, MOOD[r.kind]);
      void refreshWallet();
    } catch {
      const t = "Oops, my circuits got muddled. Try again in a moment!";
      setMsgs((m) => [...m, { from: "bot", text: t }]);
      robot.say(t, "encourage");
    } finally {
      setBusy(false);
    }
  }, [busy, unitId, robot, refreshWallet]);

  const api_: AskApi = {
    setScreen: (s) => { screen.current = s; },
    open: (question) => {
      setOpen(true);
      if (question) void send(question);
    },
    explainWord: async (word, sentence) => {
      const r = await api.ask({ unitId, activityId: screen.current.activityId, question: word, word: { word, sentence } });
      void refreshWallet();
      return r.reply;
    },
  };

  const chips = [
    { icon: <HelpCircle className="size-5" />, label: "What does a word mean?", ask: null as string | null },
    { icon: <Lightbulb className="size-5" />, label: "Give me a clue", ask: "Can you give me a clue for this one?" },
    { icon: <HelpCircle className="size-5" />, label: "I don't get the question", ask: "I don't understand the question. Can you explain it?" },
    { icon: <Volume2 className="size-5" />, label: "Read it to me", ask: "READ" },
  ];

  return (
    <Ctx.Provider value={api_}>
      {children}

      {/* Floating Ask button. */}
      {!isOpen && (
        <motion.button
          type="button"
          aria-label={`Ask ${robotName}`}
          onClick={() => setOpen(true)}
          initial={{ scale: 0 }}
          animate={{ scale: 1, y: [0, -4, 0] }}
          transition={{ y: { duration: 2.5, repeat: Infinity } }}
          whileTap={{ scale: 0.9 }}
          className="fixed bottom-5 right-5 z-40 flex cursor-pointer items-center gap-2 rounded-full bg-primary py-2 pl-2 pr-5 font-display text-xl font-semibold text-primary-foreground shadow-[0_6px_0_0_var(--primary-shadow),0_10px_30px_rgba(0,0,0,0.4)]"
        >
          <span className="grid size-11 place-items-center rounded-full bg-black/15 text-2xl">?</span>
          Ask {robotName}
        </motion.button>
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.section
              role="dialog"
              aria-label={`Ask ${robotName}`}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] max-w-3xl flex-col gap-3 rounded-t-[2rem] border border-white/15 bg-[oklch(0.22_0.06_275)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <Robot size={90} parts={parts} />
                <div className="flex-1">
                  <h2 className="text-2xl">Ask {robotName}</h2>
                  <p className="text-base text-muted-foreground">Questions about this story and its words.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close"><X /></Button>
              </div>

              <div ref={list} className="flex min-h-24 flex-col gap-3 overflow-y-auto py-1">
                {msgs.length === 0 && <p className="text-lg text-muted-foreground">Tap a button below, or type your question. You can also tap 🎤 on the keyboard to talk.</p>}
                {msgs.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={cn("max-w-[85%] rounded-3xl px-4 py-3 text-lg leading-snug", m.from === "me" ? "self-end bg-glow/20" : "self-start bg-white text-slate-800",
                      m.kind === "grown-up" && "border-2 border-pink")}>
                    {m.from === "bot" ? (
                      <button type="button" className="cursor-pointer text-left" onClick={() => robot.say(m.text)}>{m.text} <Volume2 className="inline size-4 opacity-60" /></button>
                    ) : m.text}
                  </motion.div>
                ))}
                {busy && <div className="self-start rounded-3xl bg-white px-4 py-3 text-2xl text-slate-500"><motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }}>• • •</motion.span></div>}
              </div>

              <div className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <Button key={c.label} variant="secondary" size="lg" className="rounded-full" disabled={busy}
                    onClick={() => {
                      if (c.ask === "READ") {
                        if (screen.current.prompt) robot.say(screen.current.prompt, "happy");
                      } else if (c.ask) void send(c.ask);
                      else {
                        setText("");
                        robot.say("Which word? Type just the word, or tap it in the story!", "happy");
                      }
                    }}>
                    {c.icon} {c.label}
                  </Button>
                ))}
              </div>

              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
                <Input className="h-14 rounded-2xl text-xl" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Type or say your question…" enterKeyHint="send" autoCorrect="on" />
                <Button type="submit" size="lg" className="h-14 rounded-2xl" disabled={busy || !text.trim()} aria-label="Send"><Send /></Button>
              </form>
              <p className="flex items-center gap-1 text-sm text-muted-foreground"><Mic className="size-4" /> Tap the microphone on the keyboard to say your question.</p>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
