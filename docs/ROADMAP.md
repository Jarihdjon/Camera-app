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
