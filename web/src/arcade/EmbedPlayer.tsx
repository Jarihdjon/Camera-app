import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { api, type ArcadeGame } from "@/lib/api";
import { Button } from "@/components/ui/button";

/**
 * Another site's game, shown in a frame.
 *
 * The frame is sandboxed: the game can run, but it can't open popups or take the whole app
 * to another page. Nothing about Yav is sent to the site (no referrer).
 *
 * If the site won't show inside a frame (some refuse), nothing loads; after a few seconds
 * Sparky says so and offers to open it in a new tab instead.
 *
 * Whatever the game says to the app (window.postMessage) is logged for the parent, so we
 * can learn which services report a finish or score.
 */
export function EmbedPlayer({ game }: { game: ArcadeGame }) {
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const origin = game.url ? new URL(game.url).origin : "";

  useEffect(() => {
    const t = window.setTimeout(() => setBlocked((b) => b || !loaded), 8000);
    return () => window.clearTimeout(t);
  }, [loaded]);

  useEffect(() => {
    let sent = 0;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow || sent >= 30) return;
      sent++;
      let data: string;
      try {
        data = typeof e.data === "string" ? e.data : JSON.stringify(e.data);
      } catch {
        data = String(e.data);
      }
      void api.arcade.message(game.id, e.origin, data.slice(0, 2000)).catch(() => {});
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [game.id, origin]);

  if (!game.url) return null;
  return (
    <div className="relative size-full">
      <iframe
        ref={frame}
        src={game.url}
        title={game.title}
        className="size-full rounded-2xl border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms"
        allow="fullscreen; autoplay"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
      />
      {blocked && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/70 p-6 text-center">
          <div className="max-w-md space-y-4">
            <p className="font-display text-2xl">🤖 Hmm, this game won't open in here.</p>
            <p className="text-lg text-muted-foreground">Some game sites only play on their own page.</p>
            <Button size="kid" onClick={() => window.open(game.url!, "_blank", "noopener,noreferrer")}><ExternalLink /> Open it in a new tab</Button>
          </div>
        </div>
      )}
    </div>
  );
}
