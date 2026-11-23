import { useState } from "react";
import { api, type ParentProgress } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Centre } from "../App";

/** PIN-protected parent area. Calm and functional. Phase 1 adds the digest, allowance editor and steering. */
export function Parent({ onBack }: { onBack: () => void }) {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState("");
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [queue, setQueue] = useState<Awaited<ReturnType<typeof api.parent.reviewQueue>>>([]);
  const [questions, setQuestions] = useState<Awaited<ReturnType<typeof api.parent.questions>>>([]);
  const [answers, setAnswers] = useState<Awaited<ReturnType<typeof api.parent.responses>>>([]);
  const [progress, setProgress] = useState<ParentProgress | null>(null);

  async function login() {
    try {
      await api.parent.login(pin);
      setAuthed(true);
      setSettings(await api.parent.settings());
      setQueue(await api.parent.reviewQueue());
      setQuestions(await api.parent.questions());
      setAnswers(await api.parent.responses());
      setProgress(await api.parent.progress());
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
      <Centre>
        <Card className="w-full max-w-sm">
          <CardHeader><CardTitle>Grown-ups only</CardTitle><CardDescription>Enter the parent PIN.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input type="password" inputMode="numeric" className="h-12 text-center text-2xl tracking-[0.5em]" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void login()} autoFocus />
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={onBack}>Back</Button><Button className="flex-1" onClick={() => void login()}>Enter</Button></div>
          </CardContent>
        </Card>
      </Centre>
    );

  const pending = queue.filter((u) => u.review_status === "pending").length;
  return (
    <div className="mx-auto max-w-5xl bg-background/85 px-5 py-6 text-base backdrop-blur min-h-screen">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <h1 className="text-2xl">Parent area</h1>
      </div>
      <Tabs defaultValue="progress">
        <TabsList className="flex-wrap">
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="review">Review queue {pending > 0 && <Badge className="ml-1">{pending}</Badge>}</TabsTrigger>
          <TabsTrigger value="questions">Questions he asked {questions.some((q) => q.flagged) && <Badge className="ml-1 bg-pink/20 text-pink">!</Badge>}</TabsTrigger>
          <TabsTrigger value="answers">His thinking</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="review">
          {queue.length === 0 && <p className="text-muted-foreground">No pages yet.</p>}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {queue.map((u) => (
              <Card key={u.id} className="gap-0 overflow-hidden p-0">
                <img src={`/api/uploads/${u.id}/file`} alt="Writing page" loading="lazy" className="aspect-[3/4] w-full object-cover" />
                <div className="flex flex-col gap-2 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{new Date(u.created_at + "Z").toLocaleDateString("en-AU")}</span>
                    <Badge variant={u.review_status === "thumbs-up" ? "success" : u.review_status === "redo" ? "outline" : "default"}>{u.review_status}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void review(u.id, "thumbs-up")}>👍</Button>
                    <Button size="sm" variant="outline" onClick={() => void review(u.id, "redo")}>Ask for a redo</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="progress">{progress && <ProgressTab p={progress} reload={async () => setProgress(await api.parent.progress())} />}</TabsContent>
        <TabsContent value="questions">
          <p className="mb-3 text-sm text-muted-foreground">Everything he asked the robot, and its reply. Flagged questions were about feelings, safety or personal things, and the robot told him to talk to a grown-up.</p>
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>He asked</TableHead><TableHead>Robot replied</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
              <TableBody>
                {questions.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No questions yet.</TableCell></TableRow>}
                {questions.map((q) => (
                  <TableRow key={q.id} className={q.flagged ? "bg-pink/10" : ""}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(q.created_at + "Z").toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                    <TableCell className="font-medium">{q.question}</TableCell>
                    <TableCell className="text-muted-foreground">{q.reply}</TableCell>
                    <TableCell>{q.flagged ? <Badge className="bg-pink/20 text-pink">talk to him</Badge> : <Badge variant="outline">{q.kind}</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="answers">
          <p className="mb-3 text-sm text-muted-foreground">Open answers, tune-in ideas, reflections and self-checks. These are not marked: they're for talking about together.</p>
          <div className="grid gap-3">
            {answers.length === 0 && <p className="text-muted-foreground">Nothing yet.</p>}
            {answers.map((a) => (
              <Card key={a.id} className="gap-1 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{a.kind}</Badge>{a.unit_id.replace(/^bank-\d+-/, "").replace(/-/g, " ")}
                  <span className="ml-auto">{new Date(a.created_at + "Z").toLocaleDateString("en-AU")}</span>
                </div>
                <p className="whitespace-pre-line">{a.talk_later ? <i>He chose to talk about this one with you.</i> : a.text || <i>(skipped)</i>}</p>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="settings">
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Setting</TableHead><TableHead>Value</TableHead></TableRow></TableHeader>
              <TableBody>
                {settings && Object.entries(settings).map(([k, v]) => (
                  <TableRow key={k}><TableCell className="font-medium">{k}</TableCell><TableCell className="font-mono text-xs">{JSON.stringify(v)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const STRAND_LABEL: Record<string, string> = { reading: "Reading", writing: "Writing", maths: "Maths", inquiry: "Science & inquiry" };

/** What the app has learned about him, what it will focus on next, and his journey so far. */
function ProgressTab({ p, reload }: { p: ParentProgress; reload: () => Promise<void> }) {
  const bar = (m: number) => (m >= 0.7 ? "bg-success" : m >= 0.45 ? "bg-primary" : "bg-pink");
  return (
    <div className="grid gap-4">
      <Card className="gap-3 p-5">
        <CardTitle>How he's going</CardTitle>
        <CardDescription>Mastery rises with right answers, falls with misses, and fades slowly without practice. Green is secure, gold is building, pink is still learning.</CardDescription>
        {p.strands.map((st) => (
          <div key={st.strand} className="grid gap-1">
            <div className="flex justify-between text-sm"><span className="font-semibold">{STRAND_LABEL[st.strand] ?? st.strand}</span><span className="text-muted-foreground">level {st.level} of 5 · {Math.round(st.mastery * 100)}%</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${bar(st.mastery)}`} style={{ width: `${st.mastery * 100}%` }} /></div>
          </div>
        ))}
        <p className="text-sm"><b>Next focus:</b> {STRAND_LABEL[p.weakest]} gets the most support and review; {STRAND_LABEL[p.strongest]} gets the stretch questions.</p>
        <p className="text-sm text-muted-foreground">{p.wordsLearned} words in his Word Vault · {p.dueWords} words and {p.dueItems} questions due for review · ⭐ {p.stars} stars</p>
      </Card>

      <Card className="gap-2 p-5">
        <CardTitle>Skills in detail</CardTitle>
        <Table>
          <TableHeader><TableRow><TableHead>Skill</TableHead><TableHead>Mastery</TableHead><TableHead>Level</TableHead><TableHead>Answers</TableHead></TableRow></TableHeader>
          <TableBody>
            {p.skills.map((k) => (
              <TableRow key={k.id}>
                <TableCell>{k.label} <span className="text-xs text-muted-foreground">({STRAND_LABEL[k.strand]})</span></TableCell>
                <TableCell><div className="h-2 w-28 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${bar(k.mastery)}`} style={{ width: `${k.mastery * 100}%` }} /></div></TableCell>
                <TableCell>{k.difficulty}</TableCell>
                <TableCell className="text-muted-foreground">{k.attempts}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="gap-3 p-5">
        <CardTitle>Chapters</CardTitle>
        {p.chapters.map((c) => (
          <div key={c.id} className="grid gap-1 border-b border-white/10 pb-2">
            <div className="flex items-center justify-between"><span className="font-semibold">{c.emoji} {c.number}. {c.title}</span><Badge variant={c.status === "done" ? "success" : c.status === "open" ? "default" : "outline"}>{c.status}</Badge></div>
            <div className="flex flex-wrap gap-2 text-sm">
              {c.stages.map((s) => (
                <span key={s.id} className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5">
                  {s.status === "done" ? "✓" : s.status === "open" ? "○" : "🔒"} {s.title} {s.stars > 0 && `⭐${s.stars}`}
                  {s.status === "locked" && <button type="button" className="ml-1 cursor-pointer text-xs text-primary underline" onClick={() => void api.parent.unlock(c.id, s.id).then(reload)}>unlock</button>}
                </span>
              ))}
            </div>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          {p.generating ? "Claude is writing his next planet now." : "When he starts his last chapter, Claude writes a new one at his level (within the monthly cap)."}
          {p.lastGeneration && ` Last attempt ${new Date(p.lastGeneration.created_at + "Z").toLocaleDateString("en-AU")}: ${p.lastGeneration.valid ? "passed the checks" : `rejected (${p.lastGeneration.error?.slice(0, 120)})`}.`}
        </p>
        {p.generatedChapters.map((g) => (
          <div key={g.id} className="flex items-center justify-between text-sm">
            <span>{g.title} <Badge variant="outline">written by Claude</Badge></span>
            {g.status === "ready" ? <Button size="sm" variant="outline" onClick={() => void api.parent.retireChapter(g.id).then(reload)}>Retire</Button> : <span className="text-muted-foreground">retired</span>}
          </div>
        ))}
      </Card>
    </div>
  );
}
