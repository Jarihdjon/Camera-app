import { useEffect, useState } from "react";
import { api, type ArcadeCategory, type ParentArcade } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CATS: { id: ArcadeCategory; label: string }[] = [
  { id: "numbers", label: "🔢 Numbers" }, { id: "words", label: "🔤 Words" }, { id: "puzzles", label: "🧩 Puzzles" }, { id: "science", label: "🔬 Science" },
];

const select = "h-10 rounded-md border border-white/15 bg-black/30 px-3 text-sm";

/** Grown-ups: add games from other services (by link) or H5P files, and manage the shelf. */
export function ParentArcadeTab() {
  const [data, setData] = useState<ParentArcade | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [link, setLink] = useState({ link: "", title: "", category: "words" as ArcadeCategory, skill: "" });
  const [h5p, setH5p] = useState<{ file: File | null; title: string; category: ArcadeCategory; skill: string }>({ file: null, title: "", category: "numbers", skill: "" });
  const [hosts, setHosts] = useState("");
  const load = async () => {
    const d = await api.parent.arcade.get();
    setData(d);
    setHosts(d.hosts.join(", "));
  };
  useEffect(() => {
    void load();
  }, []);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  async function addH5p() {
    if (!h5p.file) return;
    const form = new FormData();
    // Text fields first, then the file, so the server reads them all.
    form.append("title", h5p.title);
    form.append("category", h5p.category);
    if (h5p.skill) form.append("skill", h5p.skill);
    form.append("file", h5p.file);
    await run(async () => {
      const r = await api.parent.arcade.addH5p(form);
      if (r.missing.length) throw new Error(`Added "${r.title}", but it's missing game code (${r.missing.join(", ")}). In Lumi, export it again with "include libraries" so it can play.`);
    }, "H5P game added to the shelf.");
    setH5p({ ...h5p, file: null, title: "" });
  }

  if (!data) return <p className="p-4">Loading…</p>;
  return (
    <div className="space-y-4">
      {msg && <p className={msg.ok ? "rounded-lg bg-success/15 p-3 text-success" : "rounded-lg bg-pink/15 p-3 text-pink"}>{msg.text}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Add a game from a website</CardTitle>
          <CardDescription>
            Paste the game's share link or its embed code (from Educaplay, Wordwall, LearningApps and similar). It plays inside the app in a safe frame.
            Some sites don't let their games play inside other apps; then Yav gets a button to open it in a new tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Input className="sm:col-span-2" placeholder="Share link or <iframe …> embed code" value={link.link} onChange={(e) => setLink({ ...link, link: e.target.value })} />
          <Input placeholder="Name on the shelf, e.g. Animal word search" value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} />
          <div className="flex gap-2">
            <select className={select} value={link.category} onChange={(e) => setLink({ ...link, category: e.target.value as ArcadeCategory })}>
              {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <Button disabled={!link.link || !link.title} onClick={() => void run(() => api.parent.arcade.addLink({ link: link.link, title: link.title, category: link.category }), "Game added to the shelf.").then(() => setLink({ ...link, link: "", title: "" }))}>Add game</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add an H5P game (plays offline, reports his score)</CardTitle>
          <CardDescription>
            Make one with the free Lumi editor on this PC (e.g. Find the words, Memory game, Drag the words, Crossword), then export it as an .h5p file
            with libraries included. Pick a skill and his score will count towards it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Input type="file" accept=".h5p" className="sm:col-span-2" onChange={(e) => setH5p({ ...h5p, file: e.target.files?.[0] ?? null })} />
          <Input placeholder="Name on the shelf (optional)" value={h5p.title} onChange={(e) => setH5p({ ...h5p, title: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <select className={select} value={h5p.category} onChange={(e) => setH5p({ ...h5p, category: e.target.value as ArcadeCategory })}>
              {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select className={select} value={h5p.skill} onChange={(e) => setH5p({ ...h5p, skill: e.target.value })}>
              <option value="">No skill</option>
              {data.skills.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button disabled={!h5p.file} onClick={() => void addH5p()}>Upload</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>On the shelf</CardTitle></CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Game</TableHead><TableHead>Shelf</TableHead><TableHead>Played</TableHead><TableHead>Best</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {data.games.map((g) => (
              <TableRow key={g.id} className={g.hidden ? "opacity-50" : ""}>
                <TableCell>
                  <span className="font-medium">{g.title}</span> <Badge className="ml-1">{g.kind === "h5p" ? "H5P" : new URL(g.url!).hostname}</Badge>
                  {g.skill && <span className="ml-2 text-xs text-muted-foreground">→ {g.skill}</span>}
                </TableCell>
                <TableCell>
                  <select className={select} value={g.category} onChange={(e) => void run(() => api.parent.arcade.update(g.id, { category: e.target.value as ArcadeCategory }), "Moved.")}>
                    {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </TableCell>
                <TableCell>{g.plays}×</TableCell>
                <TableCell>{g.best != null ? `${Math.round(g.best * 100)}%` : "–"}</TableCell>
                <TableCell className="space-x-2 whitespace-nowrap">
                  <Button size="sm" variant="secondary" onClick={() => void run(() => api.parent.arcade.update(g.id, { hidden: !g.hidden }), g.hidden ? "Back on the shelf." : "Hidden.")}>{g.hidden ? "Show" : "Hide"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remove "${g.title}"?`)) void run(() => api.parent.arcade.remove(g.id), "Removed."); }}>Remove</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trusted game sites</CardTitle>
          <CardDescription>Only games from these sites (and their subdomains) can be added. Separate with commas.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input value={hosts} onChange={(e) => setHosts(e.target.value)} />
          <Button onClick={() => void run(() => api.parent.arcade.setHosts(hosts.split(/[,\s]+/).filter(Boolean)), "Trusted sites saved.")}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What online games said</CardTitle>
          <CardDescription>Messages games sent to the app. If a site reports finishing or a score here, it can be hooked up to reward Yav automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.messages.length === 0 ? <p className="text-muted-foreground">Nothing yet.</p> : (
            <ul className="space-y-1 font-mono text-xs">
              {data.messages.map((m, i) => <li key={i}><span className="text-muted-foreground">{m.created_at} {m.title}:</span> {m.data}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
