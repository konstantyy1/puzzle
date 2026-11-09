# Tests — «Фото Пазл»

The game has no build step and no dependencies, so the tests use only what comes with Node.js 22 or newer.

| Folder | What it checks | Run |
|---|---|---|
| `unit/` | Pure rules: the Kyiv calendar of the Daily Puzzle, the Telegram sign-in check, campaign data, client–server parity | `npm test` |
| `integration/` | API functions end to end with the in-memory store and a fake Telegram: Daily Puzzle, reminders, bot commands, arena matchmaking and rating | `npm test` |
| `smoke/` | `critical-paths.md` (the release checklist) and `browser-smoke.mjs` (the game in a headless phone-sized browser) | see below |

`npm test` needs no network, no Redis and no secrets: the API falls back to its in-memory store when Redis is not configured, and the tests sign Telegram data with a test bot token.

## Browser smoke

Needs Playwright, which is not a game dependency:

```bash
npm i --no-save playwright && npx playwright install chromium
python3 -m http.server 8765 &
node tests/smoke/browser-smoke.mjs http://127.0.0.1:8765/
```

It stubs the Telegram WebApp and the `/api` calls, opens every screen at 320, 360 and 414 px, presses every button once, plays the Daily Puzzle and campaign level 1 to the win screen, reloads to check that progress is kept, starts an arena fight against the offline bot, and prints a JSON report. Exit code 1 means errors were found. `CHROMIUM_PATH` picks a browser binary; `SMOKE_SHOTS=<folder>` saves screenshots.

Not covered automatically: a real phone inside Telegram, CloudStorage sync, custom puzzles from bot media, online fights between two people.

## Rules

- A new rule in `api/` or in the game data comes with a test in `unit/` or `integration/`.
- A bug fix comes with a test that fails without the fix.
- Test files end in `.test.mjs`; shared helpers live in `helpers.mjs`; the browser smoke's page helpers live in `smoke/smoke-lib.mjs`.
- The site does not ship this folder (see `.vercelignore`).
