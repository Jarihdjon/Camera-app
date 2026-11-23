# Yav's Learning Journey

A learning app for one child, hosted on a Windows PC at home and used on an iPad over home Wi-Fi.
Reading and vocabulary, writing, maths reasoning and PYP-style inquiry, themed around building,
space and robots, with a robot companion, a block world and earned play minutes.

The plan this is built from is in [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md).

## Privacy in one paragraph

Everything lives on the PC in `data/` (git-ignored). Only text and his first name go to the
Claude API. Photos of his writing, and later voice and video clips, never leave the PC. The
Claude API key stays in `.env` on the PC and is never sent to the iPad or committed.

## Repo layout

| Folder | What's in it |
| --- | --- |
| `server/` | Node + TypeScript + Fastify. SQLite (Node's built-in driver), learning engine, answer checking, Claude calls |
| `web/` | React + Vite progressive web app for the iPad. Tailwind v4 + shadcn/ui components (`web/src/components/ui`), `motion` animations, the robot companion (`web/src/components/robot`) |
| `shared/` | The unit schema (zod) and skill map, used by both server and web |
| `content/bank/` | Checked units that work without the AI. Each must pass the schema or the server won't start |
| `content/chapters.json` | The starting chapters (planets) and their stages, using the bank units |
| `scripts/windows/` | One-click start, one-time setup (firewall, start at login, backups, keep-awake), backup |
| `docs/` | Build plan, architecture notes, roadmap |
| `data/` | Created at runtime: database, uploads, clips. Never committed |

## Running it on the Windows PC

1. Install **Node.js 22 LTS** (22.13 or later) from nodejs.org, and Git.
2. Clone the repo, then in the repo folder:
   ```
   copy .env.example .env
   notepad .env          (add your Claude API key; optional, the app works without it)
   npm install
   npm run build
   npm start
   ```
3. The server prints the address to open on the iPad, e.g. `http://192.168.1.20:5174`.
4. One-time setup, in PowerShell **as Administrator**:
   ```
   powershell -ExecutionPolicy Bypass -File scripts\windows\setup.ps1
   ```
   This adds a firewall rule for port 5174 on Private networks only, starts the server at
   login, schedules a nightly backup, and stops the PC sleeping on mains power.
5. In your router, give the PC a fixed address (DHCP reservation) so the iPad link never changes.

After that, `scripts\windows\start.bat` starts everything with one click.

## On the iPad

Open the address in Safari, tap Share, then **Add to Home Screen**. It opens full screen like an app.
On first open, type his first name, then he names his robot.

**Parent area:** press and hold the top-left corner of the home screen for two seconds, then enter
the PIN. The starting PIN is `INITIAL_PARENT_PIN` in `.env` (default `2468`); change it straight away.

## Developing

```
npm run dev        # server on :5174 with reload, web on :5173 with hot reload (proxies /api)
npm test           # engine, answer checking, API and blank-page check tests
npm run typecheck
```

## UI components

The UI uses [shadcn/ui](https://ui.shadcn.com) components on Radix, configured in `web/components.json`.
Add more with `npx shadcn@latest add <name>` from the `web/` folder.

The robot companion is an original SVG character animated with `motion`. It blinks, follows taps, changes expression
with mood, and lip-syncs to the iPad voice using the speech engine's word-boundary events (`web/src/components/robot/lipsync.ts`).
Screens call `useRobot().say(text, mood)` to make it speak.

## Adding a content-bank unit

Copy `content/bank/001-moon-base-garden.json`, change the ids, and restart. The schema in
`shared/src/schemas.ts` enforces 80 to 150 word passages, 4 to 6 questions, at most three
sentences of writing, and valid answer keys. Maths answers are computed from `expression`, never typed in.
