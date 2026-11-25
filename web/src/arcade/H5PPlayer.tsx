import { useEffect, useRef, useState } from "react";
import type { ArcadeGame } from "@/lib/api";

type XAPIEvent = { data?: { statement?: { verb?: { id?: string }; result?: { score?: { raw?: number; max?: number } } } } };
type Dispatcher = { on: (name: string, cb: (e: XAPIEvent) => void) => void; off?: (name: string, cb: (e: XAPIEvent) => void) => void };

/**
 * An H5P game from the PC, played with the free standalone H5P player. No internet, no ads.
 * When the game reports a score (xAPI "completed" or "answered" with a score), `onScore`
 * is called once.
 */
export function H5PPlayer({ game, onScore }: { game: ArcadeGame; onScore: (score: number, max: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const reported = useRef(false);
  const scoreCb = useRef(onScore);
  scoreCb.current = onScore;

  useEffect(() => {
    if (!el.current || !game.folder) return;
    let cancelled = false;
    const listener = (e: XAPIEvent) => {
      const st = e.data?.statement;
      const verb = st?.verb?.id ?? "";
      const s = st?.result?.score;
      if (reported.current || !s || typeof s.raw !== "number" || !s.max) return;
      if (!/completed|answered/.test(verb)) return;
      reported.current = true;
      scoreCb.current(s.raw, s.max);
    };
    void (async () => {
      try {
        const mod = (await import("h5p-standalone")) as unknown as { H5P?: new (el: HTMLElement, o: object) => Promise<void>; default?: { H5P: new (el: HTMLElement, o: object) => Promise<void> } };
        const Player = mod.H5P ?? mod.default!.H5P;
        await new Player(el.current!, {
          id: game.id,
          h5pJsonPath: `/api/h5p-content/${encodeURIComponent(game.folder!)}`,
          frameJs: "/api/h5p-player/frame.bundle.js",
          frameCss: "/api/h5p-player/styles/h5p.css",
          frame: false,
          copyright: false,
          export: false,
          embed: false,
          fullScreen: false,
        });
        if (cancelled) return;
        const h5p = (window as unknown as { H5P?: { externalDispatcher?: Dispatcher } }).H5P;
        h5p?.externalDispatcher?.on("xAPI", listener);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      (window as unknown as { H5P?: { externalDispatcher?: Dispatcher } }).H5P?.externalDispatcher?.off?.("xAPI", listener);
    };
  }, [game.id, game.folder]);

  return (
    <div className="size-full overflow-auto rounded-2xl bg-white p-2 text-black">
      {error ? <p className="p-6 text-center text-lg text-red-700">This game couldn't start: {error}</p> : <div ref={el} />}
    </div>
  );
}
