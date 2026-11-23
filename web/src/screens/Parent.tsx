import { useState } from "react";
import { api } from "@/lib/api";
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

  async function login() {
    try {
      await api.parent.login(pin);
      setAuthed(true);
      setSettings(await api.parent.settings());
      setQueue(await api.parent.reviewQueue());
      setQuestions(await api.parent.questions());
      setAnswers(await api.parent.responses());
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
      <Tabs defaultValue="review">
        <TabsList>
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
