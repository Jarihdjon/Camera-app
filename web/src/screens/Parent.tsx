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

  async function login() {
    try {
      await api.parent.login(pin);
      setAuthed(true);
      setSettings(await api.parent.settings());
      setQueue(await api.parent.reviewQueue());
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
