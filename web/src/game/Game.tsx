import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AnimatePresence, motion } from "motion/react";
import { layoutFor, GATES, PERK_INFO, type GameState, type GateQuestion, type GateResult, type MissionLine, type PackView, type Perk } from "@yav/shared/game";
import { api, type Wallet } from "@/lib/api";
import { useRobot } from "@/components/robot/RobotProvider";
import { SpeechBubble } from "@/components/robot/SpeechBubble";
import { celebrate } from "@/components/rewards";
import { Button } from "@/components/ui/button";
import { Controls } from "./hud/Controls";
import { GatePanel } from "./hud/GatePanel";
import { StoryPanel } from "./hud/StoryPanel";
import { Dialogue } from "./hud/Dialogue";
import { TreasureMap } from "./hud/TreasureMap";
import { LevelScene, RealmHub, SkyDock } from "./scenes";
import { input, listenKeyboard, resetInput } from "./input";
import { sfx } from "./sfx";
import type { PlayerHandle } from "./Player";
import type { Body } from "./physics";

type Scene =
  | { kind: "dock" }
  | { kind: "realm"; realmId: string }
  | { kind: "level"; levelId: string; realmId: string; runId: string; pack: PackView; checkpoint: number; gems: Set<string>; eggs: Set<string> };

/**
 * Sparky's Learning Worlds. Sky Dock is home; portals lead to realms; each realm's pads
 * lead to levels; each level is a course with seven challenge gates.
 */
export function Game({ firstName, robotName, wallet, onWallet, onWorkshop, onParent }: {
  firstName: string;
  robotName: string;
  wallet: Wallet;
  onWallet: (w: Wallet) => void;
  onWorkshop: () => void;
  onParent: () => void;
}) {
  const robot = useRobot();
  const [state, setState] = useState<GameState | null>(null);
  const [scene, setScene] = useState<Scene>({ kind: "dock" });
  const [swirl, setSwirl] = useState<string | null>(null);
  const [question, setQuestion] = useState<GateQuestion | null>(null);
  const [story, setStory] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [done, setDone] = useState<null | { minutes: number; gems: number; eggs: number; eggsTotal: number; quest?: { name: string; emoji: string; pieces: number; total: number } }>(null);
  /** A story conversation on screen, and what happens when it ends. */
  const [dialogue, setDialogue] = useState<null | { lines: MissionLine[]; then: () => void }>(null);
  const [intro, setIntro] = useState(false);
  const [misses, setMisses] = useState(0);
  const [dug, setDug] = useState(false);
  const player = useRef<PlayerHandle | null>(null);
  const pos = useRef({ x: 0, z: 0 });
  const busy = useRef(false);
  /** The level's finish has been sent (it must only happen once per visit). */
  const finished = useRef(false);
  const holdTimer = useRef<number>(undefined);

  const refresh = useCallback(() => api.game.state().then(setState), []);
  useEffect(() => {
    listenKeyboard();
    void refresh();
    robot.say(`Welcome to Sky Dock, ${firstName}! Walk to a portal to wake it up.`, "wave");
    // Test hook: lets automated checks steer Sparky. Only present with ?test in the URL.
    if (location.search.includes("test")) (window as unknown as Record<string, unknown>).__game = { input, player, pos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  /** The swirl transition between scenes. */
  const go = (next: Scene, color = "#ffffff") => {
    sfx.portal();
    setSwirl(color);
    window.setTimeout(() => {
      setScene(next);
      pos.current = { x: 0, z: -4 };
      window.setTimeout(() => setSwirl(null), 350);
    }, 650);
  };

  const realm = state?.realms.find((r) => scene.kind !== "dock" && r.id === scene.realmId);

  async function startLevel(levelId: string, realmId: string) {
    const s = await api.game.start(levelId);
    const mission = s.pack.mission;
    finished.current = false;
    setDug(false);
    setMisses(0);
    setIntro(Boolean(mission && s.checkpoint === 0));
    go({ kind: "level", levelId, realmId, runId: s.runId, pack: s.pack, checkpoint: s.checkpoint, gems: new Set(s.gems), eggs: new Set(s.eggs) }, "#ffffff");
    window.setTimeout(() => {
      if (mission && s.checkpoint === 0) {
        // The opening scene, then the Story Stone.
        setDialogue({ lines: mission.intro, then: () => { setIntro(false); setStory(true); robot.say(mission.goal, "happy"); } });
      } else if (mission) {
        robot.say(`Welcome back! ${mission.goal} You've found ${s.checkpoint} of ${mission.beats.length} clues.`, "wave");
      } else {
        if (s.checkpoint === 0) setStory(true);
        robot.say(s.checkpoint ? `Welcome back to ${s.pack.title}! Let's keep going.` : `Welcome to ${s.pack.title}! First, read the Story Stone.`, "wave");
      }
    }, 900);
  }

  // ---------- level logic ----------
  const level = scene.kind === "level" ? scene : null;
  const layout = useMemo(() => (level ? layoutFor(level.pack) : null), [level?.pack.id]);
  const [nearStone, setNearStone] = useState(false);
  // Opening or closing any panel lets go of the joystick and keys, so Sparky stays put.
  useEffect(() => resetInput(), [question, story, done, dialogue]);
  useEffect(() => {
    const hook = (window as unknown as { __game?: Record<string, unknown> }).__game;
    if (hook) {
      hook.layout = layout;
      hook.openLevel = (levelId: string, realmId: string) => void startLevel(levelId, realmId);
      hook.question = question;
      hook.answerNow = (x: string | number) => answer(x).then((r) => afterGate(r));
    }
  });
  const [, setPickups] = useState(0);

  const onMove = useCallback((b: Body) => {
    pos.current = { x: b.x, z: b.z };
    if (!level || !layout || busy.current) return;
    const magnet = state?.perks.magnet ? 3 : 0.9;
    for (const g of layout.gems) {
      if (!level.gems.has(g.id) && Math.hypot(b.x - g.x, b.y + 0.7 - g.y, b.z - g.z) < magnet) {
        level.gems.add(g.id);
        setPickups((n) => n + 1);
        if (g.big) sfx.bigGem();
        else sfx.gem();
        void api.game.collect(level.levelId, "gem", g.id).then((r) => onWallet(r.wallet));
      }
    }
    for (const e of layout.eggs) {
      if (!level.eggs.has(e.id) && Math.hypot(b.x - e.x, b.y - e.y, b.z - e.z) < 1.2) {
        level.eggs.add(e.id);
        setPickups((n) => n + 1);
        sfx.egg();
        void celebrate(true);
        void api.game.collect(level.levelId, "egg", e.id).then((r) => {
          onWallet(r.wallet);
          setState((s) => (s ? { ...s, perks: r.state } : s));
          if (r.perk) {
            const p = PERK_INFO[r.perk];
            flash(`${p.icon} Easter egg! You got ${p.name}: ${p.about}`);
            robot.say(`An easter egg! You got the ${p.name}! ${p.about}.`, "cheer");
          }
        });
      }
    }
    const near = Math.hypot(b.x - layout.storyStone.x, b.z - layout.storyStone.z) < 2.2;
    setNearStone((v) => (v === near ? v : near));
    // Reaching the next closed gate opens its challenge.
    const gate = layout.gates[level.checkpoint];
    if (gate && !question && !dialogue && b.z > gate.z - 1.6) {
      busy.current = true;
      const beat = level.pack.mission?.beats[gate.index];
      void api.game.gate(level.runId, gate.index).then((q) => {
        if (beat) {
          // The story animal sets up the challenge first.
          setDialogue({ lines: [{ who: beat.who, line: beat.setup }], then: () => { setQuestion(q); busy.current = false; } });
        } else {
          setQuestion(q);
          busy.current = false;
        }
      });
    }
    if (level.checkpoint >= GATES.length && Math.hypot(b.x - layout.finale.x, b.z - layout.finale.z) < 2 && !done && !dialogue && !finished.current) {
      busy.current = true;
      finished.current = true;
      const mission = level.pack.mission;
      void api.game.finish(level.runId).then(async (r) => {
        onWallet(r.wallet);
        const s = await api.game.state();
        setState(s);
        const quest = s.realms.find((x) => x.id === level.realmId)?.quest;
        const finish = () => {
          sfx.finale();
          void celebrate(true);
          robot.say(`Level complete! Amazing work, ${firstName}!${r.minutesEarned ? ` You earned ${r.minutesEarned} play minutes!` : ""}`, "cheer");
          setDone({ minutes: r.minutesEarned, gems: level.gems.size, eggs: level.eggs.size, eggsTotal: layout.eggs.length, quest: mission ? quest : undefined });
          busy.current = false;
        };
        if (!mission) return finish();
        // X marks the spot: the chest digs itself up, the treasure rises, then the animals cheer.
        setDug(true);
        sfx.bigGem();
        void celebrate(true);
        window.setTimeout(() => setDialogue({ lines: mission.finale, then: finish }), 2600);
      });
    }
  }, [level, layout, question, dialogue, state?.perks.magnet, done, onWallet, robot, firstName]);

  const onFall = useCallback(() => {
    if (!level || !layout) return;
    const c = layout.checkpoints[level.checkpoint]!;
    sfx.warp();
    player.current?.teleport(c.x, c.y, c.z);
    robot.say("Whoops! Back to the checkpoint.", "encourage");
  }, [level, layout, robot]);

  async function answer(a: string | number): Promise<GateResult> {
    const r = await api.game.answer(question!.id, a);
    onWallet(r.wallet);
    setState((s) => (s ? { ...s, perks: { ...s.perks, shield: r.shields } } : s));
    if (r.correct) {
      sfx.gateOpen();
      void celebrate();
    } else sfx.wrong();
    return r;
  }

  async function afterGate(r: GateResult) {
    if (!level || !layout) return;
    setQuestion(null);
    const beat = level.pack.mission?.beats[level.checkpoint];
    if (r.correct && r.progress < r.needed) {
      // Next question of the round, straight away.
      setQuestion(await api.game.gate(level.runId, level.checkpoint));
    } else if (r.correct) {
      setScene({ ...level, checkpoint: r.checkpoint });
      if (beat) {
        // The world changes (the effect plays) while the animal celebrates; the clue goes on the map.
        flash(`🗺️ Clue found: ${beat.clueIcon} ${beat.clue}`);
        setDialogue({ lines: [{ who: beat.who, line: beat.success }], then: () => {} });
      }
    } else if (r.shielded) {
      // Same gate, fresh question, no warp.
      const q = await api.game.gate(level.runId, level.checkpoint);
      setQuestion(q);
    } else {
      // Warp back to the previous checkpoint; the gate will have a fresh question.
      const c = layout.checkpoints[level.checkpoint]!;
      const warp = () => {
        sfx.warp();
        setSwirl("#7cf0d8");
        window.setTimeout(() => {
          player.current?.teleport(c.x, c.y, c.z);
          setSwirl(null);
        }, 500);
      };
      if (beat) {
        // The obstacle rumbles shut, and the animal says what went wrong, kindly.
        setMisses((n) => n + 1);
        setDialogue({ lines: [{ who: beat.who, line: beat.fail }], then: warp });
      } else warp();
    }
  }

  const perks = state?.perks;

  return (
    <div className="fixed inset-0 select-none">
      <Canvas camera={{ fov: 55, position: [0, 6, -12] }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <Suspense fallback={null}>
          {scene.kind === "dock" && state && (
            <SkyDock key="dock" realms={state.realms} playerRef={player} pos={pos} jet={Boolean(perks?.jet)}
              onRealm={(id) => {
                const r = state.realms.find((x) => x.id === id)!;
                robot.say(`To ${r.name}!`, "cheer");
                go({ kind: "realm", realmId: id }, r.color);
              }}
              onWorkshop={onWorkshop} />
          )}
          {scene.kind === "realm" && realm && (
            <RealmHub key={`realm-${realm.id}`} realm={realm} playerRef={player} pos={pos} jet={Boolean(perks?.jet)}
              onLevel={(id) => void startLevel(id, realm.id)}
              onHome={() => { void refresh(); go({ kind: "dock" }, "#7cf0d8"); }}
              onComingSoon={(name) => robot.say(`${name} is still being built. Try a glowing pad!`, "thinking")} />
          )}
          {level && layout && (
            <LevelScene key={`level-${level.levelId}`} pack={level.pack} layout={layout} checkpoint={level.checkpoint} gems={level.gems} eggs={level.eggs}
              frozen={Boolean(question) || story || Boolean(done) || Boolean(dialogue) || dug} jet={Boolean(perks?.jet)} playerRef={player} onMove={onMove} onFall={onFall}
              intro={intro} misses={misses} dug={dug} />
          )}
        </Suspense>
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start gap-3 p-4">
        {scene.kind !== "dock" && (
          <Button className="pointer-events-auto" variant="secondary" size="lg"
            onClick={() => {
              setQuestion(null); setStory(false); setDone(null); setDialogue(null); setDug(false); busy.current = false; void refresh();
              go(scene.kind === "level" ? { kind: "realm", realmId: scene.realmId } : { kind: "dock" });
            }}>
            ← {scene.kind === "level" ? "Realm" : "Sky Dock"}
          </Button>
        )}
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 font-display text-xl backdrop-blur">💎 {wallet.gems}</div>
        {level && layout && (
          <div className="flex items-center gap-1 rounded-full bg-black/45 px-3 py-2 backdrop-blur" aria-label={`Gates cleared: ${level.checkpoint} of 7`}>
            {GATES.map((g, i) => <span key={g} className={i < level.checkpoint ? "text-xl" : "text-xl opacity-30 grayscale"}>{["👂", "📖", "🔤", "🔢", "🔬", "🧩", "✏️"][i]}</span>)}
          </div>
        )}
        <div className="ml-auto flex items-start gap-2">
          {level?.pack.mission && <TreasureMap mission={level.pack.mission} found={level.checkpoint} />}
          {perks && perks.shield > 0 && <span className="rounded-full bg-black/45 px-3 py-2 font-display text-lg backdrop-blur">🛡️ {perks.shield}</span>}
          {perks?.jet && <span className="rounded-full bg-black/45 px-3 py-2 font-display text-lg backdrop-blur">🚀</span>}
        </div>
      </div>
      <div className={`pointer-events-none fixed inset-x-0 top-20 z-10 mx-auto max-w-xl px-4 ${dialogue ? "hidden" : ""}`}><SpeechBubble name={robotName} className="pointer-events-auto text-base" /></div>

      {level && nearStone && !story && !question && !dialogue && (
        <Button className="fixed bottom-48 left-1/2 z-30 -translate-x-1/2" size="kid" onClick={() => setStory(true)}>📖 Read the Story Stone</Button>
      )}
      {!question && !story && !done && !dialogue && <Controls />}

      <AnimatePresence>
        {dialogue && level?.pack.mission && (
          <Dialogue key={dialogue.lines.map((l) => l.line).join("|")} lines={dialogue.lines} characters={level.pack.mission.characters} robotName={robotName} firstName={firstName}
            onDone={() => { const then = dialogue.then; setDialogue(null); then(); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {question && level && (
          <GatePanel key={question.id} question={question} onAnswer={answer} onDone={(r) => void afterGate(r)} onReadStory={() => setStory(true)} />
        )}
      </AnimatePresence>
      <AnimatePresence>{story && level && <StoryPanel pack={level.pack} onClose={() => setStory(false)} />}</AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-2xl border-2 border-pink/60 bg-black/80 px-5 py-3 font-display text-xl">{toast}</motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {done && level && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-x-4 top-1/4 z-50 mx-auto flex max-w-lg flex-col items-center gap-3 rounded-[2rem] border-2 border-primary bg-black/85 p-8 text-center">
            <h1 className="font-display text-5xl text-glow">Level complete!</h1>
            <p className="font-display text-2xl">{level.pack.emoji} {level.pack.title}</p>
            <p className="text-xl">💎 {done.gems} gems · 🥚 {done.eggs} of {done.eggsTotal} eggs</p>
            {done.quest && (
              <p className="rounded-2xl bg-amber-300/15 px-4 py-2 font-display text-2xl text-amber-200">{done.quest.emoji} {done.quest.name} piece {done.quest.pieces} of {done.quest.total}!</p>
            )}
            {done.minutes > 0 && <p className="font-display text-3xl text-primary">+{done.minutes} play minutes</p>}
            {done.eggs < done.eggsTotal && <p className="text-muted-foreground">There's still a hidden egg somewhere… 👀</p>}
            <Button size="kid" variant="success" onClick={() => { setDone(null); void refresh(); go({ kind: "realm", realmId: level.realmId }); }}>Back to {realm?.name} ➜</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portal swirl transition. */}
      <AnimatePresence>
        {swirl && (
          <motion.div className="pointer-events-none fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: `radial-gradient(circle, #ffffff 0%, ${swirl} 35%, #0b1030 75%)` }}>
            <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 0.8, ease: "easeIn" }}
              style={{ background: "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.25) 0deg 10deg, transparent 10deg 30deg)" }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parent area: press and hold the top-right corner for two seconds. */}
      <div className="fixed right-0 top-0 z-30 size-16" aria-label="Grown-ups"
        onPointerDown={() => { holdTimer.current = window.setTimeout(onParent, 2000); }}
        onPointerUp={() => window.clearTimeout(holdTimer.current)}
        onPointerLeave={() => window.clearTimeout(holdTimer.current)} />
    </div>
  );
}

export type { Perk };
