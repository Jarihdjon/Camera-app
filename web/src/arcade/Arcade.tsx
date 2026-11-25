import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Check } from "lucide-react";
import { api, type ArcadeCategory, type ArcadeFinish, type ArcadeGame, type Wallet } from "@/lib/api";
import { useRobot } from "@/components/robot/RobotProvider";
import { SpeechBubble } from "@/components/robot/SpeechBubble";
import { celebrate } from "@/components/rewards";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmbedPlayer } from "./EmbedPlayer";
import { H5PPlayer } from "./H5PPlayer";

const SHELVES: { id: ArcadeCategory; icon: string; name: string; color: string }[] = [
  { id: "numbers", icon: "🔢", name: "Numbers", color: "#ffd23f" },
  { id: "words", icon: "🔤", name: "Words", color: "#7cf0d8" },
  { id: "puzzles", icon: "🧩", name: "Puzzles", color: "#ff7ad9" },
  { id: "science", icon: "🔬", name: "Science", color: "#8fd3ff" },
];

/**
 * The Arcade: games from other services and H5P games, on shelves by subject. Opened
 * from the arcade machine on Sky Dock.
 */
export function Arcade({ robotName, wallet, onWallet, onBack }: { robotName: string; wallet: Wallet; onWallet: (w: Wallet) => void; onBack: () => void }) {
  const robot = useRobot();
  const [games, setGames] = useState<ArcadeGame[] | null>(null);
  const [playing, setPlaying] = useState<{ game: ArcadeGame; playId: string } | null>(null);
  const [result, setResult] = useState<ArcadeFinish | null>(null);
  const finishing = useRef(false);

  const load = () => api.arcade.list().then(setGames);
  useEffect(() => {
    void load();
    robot.say("Welcome to the Arcade! Pick a game to play.", "wave");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function play(game: ArcadeGame) {
    const { playId } = await api.arcade.start(game.id);
    finishing.current = false;
    setResult(null);
    setPlaying({ game, playId });
    robot.say(`Let's play ${game.title}!`, "cheer");
  }

  async function finish(score?: { score: number; max: number }) {
    if (!playing || finishing.current) return;
    finishing.current = true;
    const r = await api.arcade.finish(playing.playId, score ?? {});
    setResult(r);
    onWallet({ ...wallet, gems: r.wallet.gems, minutes: wallet.minutes + r.minutes });
    if (r.reason === "score") {
      void celebrate(true);
      robot.say(`Brilliant! You scored ${score!.score} out of ${score!.max}! That's ${r.gems} gems${r.minutes ? ` and ${r.minutes} play minutes` : ""}!`, "cheer");
    } else if (r.reason === "finished") {
      void celebrate();
      robot.say(`Well played! Here are ${r.gems} gems.`, "cheer");
    } else if (r.reason === "already-today") {
      robot.say("Great playing! You already got gems for this game today. Try a different one for more!", "happy");
    } else {
      robot.say("Keep playing a bit longer, then tap I finished!", "encourage");
      finishing.current = false;
      // Not finished yet: let him carry on with a fresh play record.
      const { playId } = await api.arcade.start(playing.game.id);
      setPlaying({ game: playing.game, playId });
    }
    void load();
  }

  function close() {
    setPlaying(null);
    setResult(null);
    robot.say("Pick another game!", "happy");
  }

  if (playing) {
    const g = playing.game;
    return (
      <div className="fixed inset-0 z-40 flex flex-col gap-3 bg-[#0b1030] p-3">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="lg" onClick={close}><ArrowLeft /> Back</Button>
          <h1 className="flex-1 truncate font-display text-2xl">{g.title}</h1>
          <div className="rounded-full bg-black/45 px-4 py-2 font-display text-xl">💎 {wallet.gems}</div>
          {g.kind === "embed" && !result && <Button size="lg" variant="success" onClick={() => void finish()}><Check /> I finished!</Button>}
        </div>
        <div className="min-h-0 flex-1">
          {g.kind === "embed" ? <EmbedPlayer game={g} /> : <H5PPlayer game={g} onScore={(score, max) => void finish({ score, max })} />}
        </div>
        {result && result.reason !== "too-quick" && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-xl items-center gap-4 rounded-3xl border-2 border-primary bg-black/85 p-5">
            <span className="text-5xl">{result.gems ? "💎" : "⭐"}</span>
            <p className="flex-1 font-display text-2xl">{result.gems ? `+${result.gems} gems${result.minutes ? `, +${result.minutes} play minutes` : ""}` : "Great playing!"}</p>
            <Button size="kid" variant="success" onClick={close}>More games ➜</Button>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[radial-gradient(circle_at_top,#3a2a7a,#0b1030_70%)] p-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="lg" onClick={onBack}><ArrowLeft /> Sky Dock</Button>
          <h1 className="flex-1 font-display text-4xl text-glow">🕹️ The Arcade</h1>
          <div className="rounded-full bg-black/45 px-4 py-2 font-display text-xl">💎 {wallet.gems}</div>
        </div>
        <SpeechBubble name={robotName} className="text-base" />
        {games && games.length === 0 && (
          <p className="rounded-3xl bg-black/30 p-6 text-center text-xl">No games yet! Ask a grown-up to add some in the Grown-ups area.</p>
        )}
        {SHELVES.map((shelf) => {
          const list = games?.filter((g) => g.category === shelf.id) ?? [];
          if (!list.length) return null;
          return (
            <section key={shelf.id} className="space-y-3">
              <h2 className="font-display text-2xl" style={{ color: shelf.color }}>{shelf.icon} {shelf.name}</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {list.map((g, i) => (
                  <motion.button key={g.id} type="button" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    onClick={() => void play(g)}
                    className={cn("flex min-h-40 cursor-pointer flex-col items-start gap-2 rounded-3xl border-2 bg-black/35 p-4 text-left transition active:scale-95")}
                    style={{ borderColor: `${shelf.color}aa` }}>
                    <span className="text-5xl">{g.kind === "h5p" ? "🎮" : "🌐"}</span>
                    <span className="font-display text-xl leading-tight">{g.title}</span>
                    <span className="mt-auto flex flex-wrap gap-2 text-sm">
                      {g.plays > 0 && <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-amber-200">⭐ played</span>}
                      {g.best != null && <span className="rounded-full bg-white/10 px-2 py-0.5">best {Math.round(g.best * 100)}%</span>}
                      <span className="rounded-full bg-white/10 px-2 py-0.5">{g.rewardedToday ? "✅ gems today" : `💎 up to ${g.kind === "h5p" ? 8 : 2}`}</span>
                    </span>
                  </motion.button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
