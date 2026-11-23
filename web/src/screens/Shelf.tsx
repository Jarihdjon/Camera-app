import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { api, type ChildUnit } from "@/lib/api";
import { themeStyle } from "@/lib/themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Row = Awaited<ReturnType<typeof api.units>>[number];

/** The journal shelf: every unit, each in its own colour, like the Inquirer's Journal. */
export function Shelf({ onOpen, onBack }: { onOpen: (u: ChildUnit) => void; onBack: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => void api.units().then(setRows).catch(() => setRows([])), []);

  return (
    <div className="mx-auto max-w-5xl px-5 pb-12 pt-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="lg" onClick={onBack}>← Back</Button>
        <h1 className="text-4xl text-glow">My Inquirer's Journal</h1>
      </div>
      <p className="mt-2 text-lg text-muted-foreground">Pick a unit. Read the story, solve the puzzles, then plan a story of your own.</p>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows?.map((r, i) => (
          <motion.button
            key={r.id}
            type="button"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => void api.unit(r.id).then(onOpen)}
            style={{ ["--unit" as string]: r.color ?? "var(--primary)" }}
            className="relative flex min-h-48 cursor-pointer flex-col items-start gap-2 overflow-hidden rounded-3xl border-2 border-[var(--unit)] bg-card p-6 text-left shadow-2xl backdrop-blur-md"
          >
            <span className="absolute inset-0 -z-10 bg-gradient-to-br from-[var(--unit)]/45 to-transparent" />
            <div className="flex w-full items-center justify-between">
              <span className="grid size-12 place-items-center rounded-full bg-[var(--unit)] font-display text-2xl font-semibold text-white">{i + 1}</span>
              {r.done ? <Badge variant="success">Done ✓</Badge> : <span className="text-4xl">{themeStyle(r.theme).emoji}</span>}
            </div>
            <span className="font-display text-2xl font-semibold leading-tight">{r.title}</span>
            {r.pypTheme && <span className="text-base text-muted-foreground">{r.pypTheme}</span>}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
