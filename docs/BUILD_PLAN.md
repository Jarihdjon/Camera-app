# Yav's Learning Journey: Build Plan

Nov 23, 2026 · @Jono

## Goal and what the interview told us

Yav should want this app more than the videos he watches after school, and use it to grow his reading, writing and thinking. The interview shows where to aim.

- **Maths is his strength.** He adds and subtracts, understands place value, knows times tables to 6 or 7 and handles word problems. It becomes his confidence engine and the source of bonus challenge levels.
- **Word curiosity is the real reading gap.** He reads chapter books but skips words he does not know and sometimes misses what a sentence means, without asking. The app must make asking about words rewarding.
- **Writing stamina is short.** He dislikes writing and loses focus fast, so every writing task is tiny, varied and tied to something he built or cares about.
- **His hooks are building, collecting, exploring and characters.** Minecraft, Astro Bot, space, Lego and building robots become the theme of everything.
- **Timing and kit.** Year 2 (IB PYP) starts in about a month. He has his own latest iPad, a Canon printer with AirPrint, and everything runs on home Wi-Fi.

**How we will know it works.** These are proposed targets, to be adjusted after two weeks of real use:

- He opens the app unprompted on 4 of 5 school days.
- He finishes a 30 to 40 minute session without nagging.
- He asks the robot about at least 5 new words a week.
- He uploads at least 2 writing pages a week.

## Decisions locked from the interview

These choices are settled. Anything marked later is planned but not in version 1.

| Area | Decision |
| --- | --- |
| Personalisation | Hybrid: a checked content bank plus Claude-written passages, hints and feedback, using his first name and interests |
| Privacy | Only text and his first name go to the Claude API. Photos, voice and video stay on your PC |
| Writing unlock | A photo upload of his handwriting unlocks the next activity. You can review every page afterwards |
| Screen time | 15 minutes earned per completed unit, or credits from correct answers. You enforce actual limits with Apple Screen Time |
| Rewards | A block world that grows and a robot companion he names |
| Games | Block builder in version 1. Robot-programming puzzles and a story and invention maker later |
| Companion chat | No free chat in version 1. The robot speaks and he taps choices |
| Clips (later) | Show-and-tell of a build, and telling a story aloud before writing it. Stored on your PC only |
| Parent view | Weekly progress summary and a review queue for uploaded writing |
| Journal | Timeline of everything, growth charts, video clips |
| Subjects | Reading and vocabulary, writing, maths reasoning, science and inquiry in PYP style |
| Session | 30 to 40 minutes after school |
| Hosting | Windows PC at home, iPad over home Wi-Fi only |
| Code | In your GitHub repo |
| Claude cost | Average usage, with a hard monthly cap you can change in settings |

## A session from Yav's side

A daily session is two short learning units, then a build, and it ends with a clear finish. This is roughly 35 minutes, and each completed unit earns 15 minutes of free play.

1. **Arrive (1 minute).** His robot greets him by name, shows today's two-unit mission and his wallet of earned minutes.
2. **Unit A (12 to 15 minutes).**
   - A warm-up puzzle pitched slightly above his level, so he starts with a win.
   - A short passage themed to his interests, with Word Hunter: tap any word and the robot explains it, and each tap earns a word gem.
   - Four to six questions mixing one-word answers, inference and one two-step maths problem.
   - A micro-writing task. Some are on screen, and some are a print sheet.
3. **Unit B (12 to 15 minutes).** A different mix, such as science inquiry or a maths-heavy challenge, chosen by the learning engine from how Unit A went.
4. **Build (8 to 10 minutes).** He spends the blocks he earned in his world, then shows the robot what he made.
5. **Wrap (1 minute).** The robot recaps his new words, shows the wallet, and closes the day with a teaser for tomorrow so he comes back.

## The learning engine

The engine tracks what Yav knows skill by skill, then picks each next activity so he succeeds about four times in five. That is the stretch zone: hard enough to grow, easy enough to keep going. The 80% figure is a design target we will tune with real data.

### Skill map

| Strand | Skills tracked |
| --- | --- |
| Reading | Word meaning in context, recall, inference, understanding a whole sentence, the habit of asking about words |
| Writing | Fill-in-the-blank sentences, three-sentence responses, Story Mountain planning, later short stories |
| Maths | Place value, add and subtract, times tables from 6 and 7 up to 12, multi-step word problems, patterns and logic |
| Science and inquiry | PYP key concepts (form, function, causation, change, connection, perspective, responsibility), predictions, why-questions |

Each skill has a mastery score that rises on correct answers, falls on misses, and fades slowly if not practised.

### Choosing the next activity

1. Review anything due first, using spaced repetition at 1, 3, 7 and 14 days for words and weak skills.
2. Give his weakest strand one slot per session, and his strongest strand a challenge slot.
3. Step difficulty up after three easy wins in a row, and down after two misses, with a hint.
4. Never repeat the same format twice in a row, because his attention is short.
5. Rotate interest themes (Minecraft, Astro Bot, space, Lego, robots) so none wears out.
6. Respect your pins, such as a school unit or a skill you want more of.

### Word Hunter, the answer to his reading gap

- Every passage has tap-to-explain words. Tapping earns a word gem and never costs points, so asking becomes the winning move.
- Tapped and missed words go into a Word Vault. They come back in later passages and quick quizzes on the spaced schedule.
- After a hard sentence, an optional "say it in your own words" step offers three paraphrases to choose from. It trains him to notice when a sentence did not make sense.
- The robot occasionally hides a mystery word and gives a bonus gem for spotting it. That rewards noticing, which is the habit he lacks.

### Where Claude fits

- **Claude writes** passages of 80 to 150 words at his level, questions with answer keys, hints that point back to a paragraph without giving the answer, the robot's lines, and your weekly digest.
- **Code checks** the maths answers by computing them. One-word answers use accepted-answer lists with forgiving spelling, as in the prototype.
- **Content is made ahead.** Units are generated after each session and overnight, validated against a schema, and stored. Yav never waits for the AI. If generation fails, the app falls back to the content bank, which starts with the six Inquirer's Journal units.
- **Guardrails.** Prompts carry a style guide: Australian spelling, no scary content, and no redundant details (the grey koala rule). Only his first name is sent. A validator checks length, reading level and answer consistency. Every generated item is logged so you can audit it.

## Games, world and rewards

Rewards come in two separate currencies: play minutes for the outside world, and blocks and gems for his world inside the app. Keeping them apart stops the creative game from feeling like a ticket machine.

- **Play minutes.** Each completed unit earns 15 minutes. They are the time you grant for Minecraft and Astro Bot. Proposed default cap: 2 units, so 30 minutes, a day, adjustable by you.
- **Blocks and gems.** Earned by correct answers, Word Hunter taps and writing uploads. Spent on his world and on robot upgrades.
- **Cashing out.** The wallet shows his earned minutes. When he taps "Use my time" the app logs it and notifies you. The app cannot lock other apps, so you set the actual allowance with Apple Screen Time.

### Robot companion

He names it on day one. It starts as a plain robot and learning unlocks parts, such as arms, wheels, a jetpack and an antenna, which suits a boy who builds robots. It reacts to his effort and streaks with AI-written lines, spoken aloud using the iPad's built-in voice. It does not chat freely in version 1.

### Block world (version 1)

A small creative builder on a space-base theme, with touch controls to place, remove and rotate blocks. Daily briefs make the maths real, such as "build a landing pad that fits three robots" for area, counting and symmetry. He can save a snapshot of any build to his journal. We will confirm in week one whether a 3D version runs smoothly on his iPad, and fall back to an isometric view if it does not.

### Later games

- **Robot puzzles.** Guide a little robot through levels with step cards, introducing sequences and loops.
- **Story and invention maker.** He invents a creature or machine, then explains it, which feeds straight into his Story Mountain writing.

### Avoiding the toll-booth trap

If everything fun is locked behind work, learning starts to feel like a chore and the videos win. The design guards against it:

1. Some building time each day is free and not earned. Proposed: 5 minutes.
2. Mystery crates and surprise events add variety that he cannot predict.
3. He picks one of two missions each day, which gives him a say.
4. Nothing he has earned is ever taken away.

## Writing: print, write, upload

Writing happens on paper in short bursts. The app prepares a one-page sheet, he prints it from the iPad, writes, photographs the page, and the upload unlocks the next activity.

1. **A small task appears.** Three sentences at most: fill in the blanks, finish a sentence, describe what he just built, or plan one stage of his Story Mountain.
2. **He taps "Print my sheet".** The iPad opens its AirPrint dialog for the Canon printer. The sheet is one page with the task, big writing lines and no drawing.
3. **He writes by hand** away from the screen.
4. **He taps "Upload" and takes a photo** with the iPad camera. This works over plain home Wi-Fi without any certificate.
5. **A blank-page check runs in the browser.** It looks for enough ink-like marks and asks him to retake a blank or very dark photo. No AI sees the photo, which keeps the text-only privacy rule.
6. **The next activity unlocks.** The robot celebrates, the photo goes into his journal, and the page joins your review queue.
7. **You review it later.** Thumbs up, add a comment, or ask for a redo. A redo request never removes rewards he has earned.

**Built for a short attention span.** Tasks are sized for 3 to 5 minutes, he picks between two formats, and sentence starters remove the blank-page problem. His own builds and robot adventures supply the topics, so he writes about things he already wants to talk about.

**One thing to verify in week one.** Printing from the iPad home-screen app should open the AirPrint dialog, and we will test that on his iPad. If it does not, the app will open the sheet as a PDF so he can print it from the share sheet.

## Journal and parent area

Yav gets a journal that quietly records his journey, and you get a PIN-protected area that shows what is going on and lets you steer it.

### Yav's journal

- **Timeline.** Photos of his writing, snapshots of his builds, milestones such as a new times table, and robot upgrades, in date order.
- **Word Vault.** Every word he asked about or learned, which he can browse and be proud of.
- **Growth charts.** Simple visuals he can understand, such as "words I know" and "times tables I can do".
- **Clips (later).** Show-and-tell videos of his builds and stories told aloud, stored on your PC.

### Parent area

| Screen | What it does |
| --- | --- |
| Weekly digest | Claude-written summary from text-only data: strengths, struggles, words he asked about, what the engine will focus on next, and one dinner-table question |
| Review queue | His uploaded writing pages, with thumbs up, a comment, or a redo request |
| Allowance | Minutes earned per unit, daily cap, free build minutes, and his earned-minutes log |
| Steering | Pin topics, skills or a school unit you want more of |
| AI settings | Claude API key, monthly spend cap, current spend, and a log of everything generated for him |
| System | Backup status, PIN, and a reset option |

## Technical design

One Node server on your Windows PC serves the iPad web app, keeps everything in a local database, and calls Claude only with text.

&#91;embedded content: architecture · iPad, PC and Claude\]

The iPad talks only to the PC over home Wi-Fi. The PC sends Claude text prompts and never anything else.

| Part | Choice |
| --- | --- |
| Server | Node.js with TypeScript and Fastify, as a single process |
| Data | SQLite for progress, journal and settings. Uploaded photos and later clips as files in a data folder |
| App | React and Vite as a progressive web app. He adds it to the iPad home screen, so it opens full screen and caches today's session |
| Block world | three.js with touch controls, with an isometric canvas fallback if his iPad struggles |
| Voice | The iPad's built-in speech for read-aloud and the robot |
| Claude | Anthropic SDK from the server only. The API key lives in a local .env file and never reaches the iPad or the repo |
| AI cost control | A generation queue, the style guide cached across calls, schema-validated JSON, a spend counter and the hard monthly cap |
| Access | A fixed address for the PC on your router, a friendly name, and one Windows Firewall rule for the app's port. Parent area behind a PIN |
| Windows setup | A one-click start script, a Task Scheduler entry to start at login, a power plan that keeps the PC awake in his session hours, and a nightly backup |
| Repo | Your GitHub repo, with folders for server, web app, content bank and docs, and a README with the setup steps |

The main data tables are child, skill, attempt, word, unit, activity, wallet entry, upload, journal entry, world build, robot, generation log and settings.

## Release roadmap

The build runs in four phases, and each one has to pass a gate before the next starts. Version 1 is phase 1. I will add week estimates once the iPad tests in phase 0 are done, because they decide how much risk is left.

&#91;embedded content: roadmap · 4 phases, 3 gates\]

Phase 1 is the thin slice you chose. Gate 3 is the real test: whether he opens the app without being asked.

## Risks and open decisions

The biggest risks are that the novelty fades and that learning starts to feel like a chore. Both are design problems more than technical ones.

| Risk | Mitigation |
| --- | --- |
| Novelty fades after a few weeks | Rotating themes, mystery crates, new robot parts and new world areas every few weeks. We watch the unprompted-opens measure and tune |
| It feels like a toll booth | Free build time, a choice of two missions, and rewards that are never taken away |
| He games it with random taps or a blank photo | Attempt limits with hints, a check for suspiciously fast answers, the blank-page check, your review, and reward only for completed units |
| Screen Time is enforced outside the app | You set the allowance in Apple Screen Time. The app shows his wallet and notifies you. Agree the house rules with Yav up front |
| AI content is wrong or off-style | Maths computed by code, schema and reading-level validation, the content bank as fallback, and an audit log you can read |
| PC asleep or Wi-Fi drops mid-session | Keep-awake power plan, a fixed address for the PC, and the current session's content cached on the iPad so he can finish offline |
| iPad quirks with audio, camera or printing | A short test of each on his iPad in week one, before building further |
| Lost data | Nightly backup of the database and uploads to a folder you choose |

### Open decisions for you

Each has a default I will use unless you say otherwise.

- [ ] Daily cap on earned minutes. Default: 2 units, so 30 minutes.
- [ ] Free, unearned build time each day. Default: 5 minutes.
- [ ] GitHub repo name and visibility, and giving me access to it. Default: a private repo.
- [ ] Notification to your phone when he taps "Use my time". Default: in-app only, with a phone push added later if you want it.
- [ ] Monthly Claude spend cap. Default: A$20 hard stop, then the app falls back to the content bank. I will measure real spend in week one and report back.
- [ ] Start date. Default: a working trial on his iPad before Year 2 begins in about a month.
