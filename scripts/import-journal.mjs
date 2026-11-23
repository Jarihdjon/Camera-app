// Converts the Inquirer's Journal prototype (a single HTML file) into content-bank units.
// Usage: node scripts/import-journal.mjs <path-to-The_Inquirers_Journal.html>
// Writes content/bank/002-*.json to 007-*.json. Run the server tests afterwards to validate them.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const src = readFileSync(process.argv[2], "utf8");
const start = src.indexOf("const UNITS=[");
const end = src.indexOf("/* ---------- helpers");
if (start < 0 || end < 0) throw new Error("Could not find the UNITS data in that file");
// The block is a plain data literal; evaluate it in an empty sandbox.
const UNITS = vm.runInNewContext(src.slice(start, end).replace("const UNITS=", "UNITS=") + ";UNITS", {});

const INTEREST = ["everyday", "space", "animals", "nature", "animals", "animals"];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const PYP = { "How We Organize Ourselves": "How We Organise Ourselves" };

function mathsFrom(c) {
  const lhs = c.work.split("=")[0];
  let expression = lhs.includes("→") ? String(c.lo) : lhs.replace(/−/g, "-").replace(/×/g, "*").trim();
  if (!/^[\d\s+\-*/()]+$/.test(expression)) expression = String(c.lo);
  // eslint-disable-next-line no-new-func
  const v = Function(`return (${expression})`)();
  if (v < c.lo || v > c.hi) throw new Error(`Working "${c.work}" gives ${v}, outside ${c.lo}-${c.hi}`);
  return { expression, tolerance: Math.max(c.hi - v, v - c.lo) };
}

UNITS.forEach((u, i) => {
  const n = String(i + 2).padStart(3, "0");
  const id = `bank-${n}-${slug(u.title)}`;
  const p = (k) => `b${n}-${k}`;
  const unit = {
    id,
    title: u.title,
    theme: INTEREST[i],
    source: "bank",
    color: u.color,
    inquiry: {
      pypTheme: PYP[u.theme] ?? u.theme,
      centralIdea: u.idea,
      keyConcepts: u.kc,
      learnerProfile: u.lp,
      tuneIn: u.tune,
      reflect: u.reflect,
    },
    passage: {
      title: u.title,
      text: u.story.join("\n\n"),
      glossary: u.vocab.map((v) => ({ word: v.w, meaning: v.o[v.a].replace(/^./, (c) => c.toUpperCase()) + "." })),
    },
    vocab: u.vocab.map((v, k) => ({
      id: p(`vocab${k + 1}`),
      kind: "word-meaning",
      skill: "reading.word-meaning",
      difficulty: 2,
      word: v.w,
      options: v.o,
      correctIndex: v.a,
      hint: `Find "${v.w}" in the story and read the sentence around it.`,
    })),
    questions: u.qs.map((q, k) =>
      q.open
        ? { id: p(`q${k + 1}`), kind: "open", skill: "reading.inference", difficulty: 2, prompt: q.q, model: q.model }
        : {
            id: p(`q${k + 1}`),
            kind: "short-answer",
            skill: /^why|^what was different|^according/i.test(q.q) ? "reading.inference" : "reading.recall",
            difficulty: 2,
            prompt: q.q,
            match: "keyword",
            accept: q.accept ?? [],
            ...(q.groups ? { groups: q.groups } : {}),
            model: q.model,
            hint: q.para !== undefined ? `Look again at paragraph ${q.para + 1}.` : "Look back at the story.",
            ...(q.para !== undefined ? { para: q.para } : {}),
          },
    ),
    gapFill: {
      id: p("gaps"),
      kind: "gap-fill",
      skill: "writing.fill-blank",
      difficulty: 2,
      prompt: "Which word fits each sentence?",
      sentences: u.gaps.map((g) => ({ text: g.s, answer: g.a })),
      decoys: u.decoys,
    },
    corner: u.corner.map((c, k) =>
      c.kind === "num"
        ? { id: p(`c${k + 1}`), kind: "maths", skill: "maths.word-problems", difficulty: 2, prompt: c.q, ...mathsFrom(c), unit: c.unit, working: c.work, hint: "Try drawing it, or count on your fingers." }
        : { id: p(`c${k + 1}`), kind: "open", skill: "inquiry.why-questions", difficulty: 2, prompt: c.q, model: c.model },
    ),
    writing: {
      id: p("writing"),
      kind: "writing",
      skill: "writing.story-mountain",
      difficulty: 2,
      prompt: u.seed,
      format: "story-mountain",
      starters: [],
      sentences: 3,
      mode: "print",
    },
  };
  const file = path.join("content/bank", `${n}-${slug(u.title)}.json`);
  writeFileSync(file, JSON.stringify(unit, null, 2) + "\n");
  console.log("wrote", file);
});
