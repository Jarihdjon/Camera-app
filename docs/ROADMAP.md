# Roadmap and status

## Done: scaffolding

- Monorepo (npm workspaces): `server`, `web`, `shared`, `content/bank`.
- SQLite schema with every table from the plan, seeded skill map (maths starts higher).
- Learning engine: mastery with decay, step up after 3 wins and down after 2 misses, spaced
  repetition at 1/3/7/14 days, unit planner (weakest strand focus, strongest strand challenge,
  theme rotation, no repeat format, parent pins). Planner is not yet wired to generation.
- Answer checking in code: forgiving spelling for short answers, arithmetic evaluated for maths.
  Answer keys are stripped before anything reaches the iPad.
- Wallet with separate currencies (minutes / blocks / gems), daily unit cap, "Use my time" log.
- Word Hunter: every word tappable, glossary meanings read aloud, each tap earns a gem and
  goes into the Word Vault with a review date.
- Writing: printable one-page sheet (CSS print), camera upload, in-browser blank-page check,
  upload unlocks the next step, photo goes to the journal and the review queue.
- Parent area behind a PIN (scrypt hash, signed httpOnly cookie): review queue, settings, spend.
- Claude wrapper: text-only, cached style guide, structured output validated by the same
  schema, refusal handling, every call logged with cost, hard monthly cap.
- PWA manifest and service worker that caches today's session.
- Windows scripts: start, setup (firewall, start at login, nightly backup, keep-awake), backup.
- CI: typecheck, tests, build.

## Done: rich UI

- Tailwind v4 + shadcn/ui, always-dark space theme, self-hosted Fredoka and Nunito fonts (work offline).
- Original animated robot companion: blinking eyes that follow taps, mood expressions, lip-sync to speech,
  hover bob, springy antenna, cheer jump with booster flame, waving arm, parts slots for unlocks.
- Animated starfield, screen transitions, floating mission cards, rocket progress track, flying gems and blocks,
  counting wallet, confetti, scanner animation on photo upload, calm shadcn parent area.

## Done: robot upgrade

- Orange cape that flutters at rest and streams out on a cheer; LED dot-matrix eyes and mouth with a soft halo;
  glossier shell with highlights and a rim glow; floating hands and feet with booster flames.
- Unlockable parts (capes, visors, boots) from gems ever earned, so spending never re-locks anything.
  Robot workshop screen to wear them (`POST /api/robot/equip`). Catalogue in `shared/src/robotParts.ts`.

## Done: Inquirer's Journal and Ask Sparky

- The six Inquirer's Journal units are in the content bank (`content/bank/002` to `007`), converted by
  `scripts/import-journal.mjs`. Units follow the PYP inquiry cycle: Tune in, Find out, Sort out, Go further,
  Reflect, Take action, with a phase rail in each unit's colour.
- New activity types: word detective, keyword-marked questions (with "one from each group"), fill the gaps
  with decoys, maths with "about" answers and worked solutions, open questions, reflection, Story Mountain
  sheet, self-check. Two tries, then the answer is shown kindly; the paragraph to look at appears after a miss.
- Journal shelf to pick any unit; today's two missions stay on the home screen.
- **Ask Sparky** (changes the plan's "no free chat in version 1"): he can type or dictate questions while in a
  unit. Answers are grounded in that unit only. Safety and personal questions go to a grown-up without any AI
  call; Claude classifies everything else as on-topic, off-topic (gentle redirect) or grown-up; replies that
  would give away the answer are swapped for the hint; a daily limit and the spend cap apply; without a key it
  still explains workbook words and gives hints. Every question is in the parent area, flagged ones highlighted.
  Parents can switch it off (`askEnabled`) or change the daily limit (`askDailyLimit`). It runs on Claude Haiku 5.5
  (`askModel`), separate from the model that writes units (`claudeModel`).

## Done: chapters, saved progress and adaptive content

- **Star Station hub** with chapter planets that unlock in order. Each chapter is a path of stages:
  story stages (one inquiry unit each), a **Word Vault review** built from what is due for him, and a
  **chapter challenge** built from the chapter's own items, leaning towards his weakest skills. Finishing a
  challenge unlocks the next planet. Up to 3 stars per stage (finished, 2 or fewer second tries, curious),
  never taken away; new stars earn gems towards robot parts. Chapters are in `content/chapters.json`.
- **Saved progress:** his place inside a unit is saved after every step and answer (`unit_progress`), and the
  hub offers "Keep going". Stage completion is stored per chapter (`stage_progress`), for bank and generated units.
- **Learning from him** (`server/src/engine/learner.ts`): a snapshot of mastery and level per skill and strand,
  due words, missed questions, and theme preferences. Questions he misses twice are booked for review on the
  1/3/7/14 day schedule, and review answers move items along it. At level 1 to 2 in a strand the paragraph to
  look at shows straight away; at maths level 4 to 5 a bonus times-table stretch is added.
- **New chapters at his level** (`server/src/ai/queue.ts`): when he starts his last chapter (and nightly at
  8pm), Claude writes a new planet of two story units from a text-only learner summary, themed on his favourite
  interests. Units must pass the schema plus quality checks (reading level, glossary words in the story,
  answers findable in their paragraph, maths computed); one retry each; stops at the monthly cap.
- Parent **Progress** tab: strand and skill mastery, next focus, Word Vault, chapters and stars, manual unlock,
  and retiring a Claude-written chapter.

## Phase 0: iPad checks (week one, on his iPad)

- [ ] Add to Home Screen opens full screen.
- [ ] Robot voice: is an Australian voice installed? (Settings > Accessibility > Spoken Content > Voices)
- [ ] Lip-sync: does the voice send word-boundary events? If not, the robot falls back to a generic talking loop.
- [ ] Animation smoothness: starfield, floating cards and confetti at a steady frame rate.
- [ ] Camera upload from the home-screen app over http.
- [ ] Print my sheet opens AirPrint for the Canon. If not, fall back to a PDF via the share sheet.
- [ ] Blank-page check thresholds on real photos of his paper.
- [ ] three.js test scene frame rate, to choose 3D or isometric for the block world.

## Phase 1: version 1 (the thin slice)

- [ ] Wire the planner to generation: queue units after each session and overnight.
- [ ] Generated hints, robot lines and the weekly digest.
- [ ] Word Vault review quizzes on the spaced schedule; mystery word.
- [ ] "Say it in your own words" paraphrase step.
- [ ] Block world (three.js or isometric) with daily briefs and snapshots.
- [ ] More robot parts and a celebration when a new part unlocks; free daily build minutes; mystery crates; two-mission choice.
- [ ] Journal timeline, Word Vault and growth charts for Yav.
- [ ] Parent area: weekly digest, allowance editor, steering pins, AI log viewer, PIN change, reset.
- [ ] Remaining content-bank units (the six Inquirer's Journal units).

## Later

Robot-programming puzzles, story and invention maker, show-and-tell clips stored on the PC.
