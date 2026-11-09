# Technical Preferences

<!-- project.yaml at the repo root is the machine-readable source of truth for
     engine, specialists, naming, performance, platform, and testing.framework.
     This file is the human-readable LEGACY FALLBACK: agents and skills resolve
     each key from project.yaml first and fall back here only when the
     project.yaml key is absent. /setup-engine dual-writes both.
     Forbidden patterns and allowed libraries are NOT migrated — they live only
     in this file. Populated by /setup-engine; updated as decisions are made. -->

<!-- Фото Пазл: filled in by hand on 2026-11-09 when the studio was adopted.
     /setup-engine supports Godot, Unity and Unreal only, and project.yaml's
     engine.name accepts only those three, so this web project keeps its stack
     here and in CLAUDE.md. project.yaml has no engine block on purpose. -->

## Engine & Language

- **Engine**: Web (no game engine) — vanilla HTML5 + CSS + JavaScript, a Telegram Mini App
- **Language**: JavaScript — browser scripts without a build step; Node.js 26.x ES modules in `api/`
- **Rendering**: DOM + CSS for screens; Canvas 2D for puzzle pieces (`js/puzzle.js`)
- **Physics**: None

## Input & Platform

<!-- Written by /setup-engine. Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->

- **Target Platforms**: Mobile first (Telegram for iOS and Android); also Telegram Desktop and Telegram Web
- **Input Methods**: Touch; mouse on desktop
- **Primary Input**: Touch — drag and drop pieces
- **Gamepad Support**: None
- **Touch Support**: Full
- **Platform Notes**: Runs in the Telegram WebView; the smallest checked screen is 360×740. Progress is saved to localStorage plus Telegram CloudStorage. Bot messages and deep links (`/start f_…`, `d_…`, `t_…`, `?dz=1`) open the game.

## Naming Conventions

- **Classes**: module objects in PascalCase or capitals (`Prog`, `Store`, `DailyPz`, `UI`, `DATA`)
- **Variables**: camelCase
- **Signals/Events**: camelCase handlers (`onCallback`); progress changes go through `emit()`
- **Files**: lowercase, kebab-case when multiword (`daily.js`, `friend-identity.js`)
- **Scenes/Prefabs**: N/A — screens are names passed to `UI.show()` (`home`, `levels`, `daily`, `hero`, `profile`, `free`, `arena`, `friends`, `friendpage`, `cases`)
- **Constants**: SCREAMING_SNAKE (`COMMANDS_V`, `TIER_COINS`)
- **DOM / CSS**: element ids camelCase (`dzPlay`); CSS classes kebab-case (`dz-cta`, `btn-g`)

## Performance Budgets

- **Target Framerate**: 60 fps while dragging pieces on a mid-range phone
- **Frame Budget**: 16.6 ms
- **Draw Calls**: N/A (Canvas 2D) — a 6×6 board must stay smooth
- **Memory Ceiling**: [TO BE CONFIGURED]

## Testing

- **Framework**: None in the repository yet. Releases are checked with a headless-Chromium smoke run at 360×740 and Node scripts that call the `api/` handlers; `/test-setup` should move these into `tests/`
- **Minimum Coverage**: [TO BE CONFIGURED]
- **Required Tests**: Balance formulas, gameplay systems, networking (Arena, Daily puzzle, bot webhook)

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->
- Secrets (bot token, setup key, cron secret) in client files — Vercel environment variables only
- A client build step, bundler or npm runtime dependency
- More than 12 functions in `api/` (Vercel Hobby limit; 8 in use)
- Editing a shipped file inside an old `v<N>/` folder — copy it into the new version folder (README release process)
- A public showcase of player photos — removed on purpose (no moderation; README «Свідомо не зроблено»)
- Real-money payments — the economy runs on in-game coins only

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here -->
- Telegram Web Apps script `telegram-web-app.js` (loaded by `index.html`)
- Upstash Redis REST API through built-in `fetch` (`api/_lib/kv.js`, with an in-memory fallback for local runs)

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- [No ADRs yet — use /architecture-decision to create one]

## Engine Specialists

<!-- Written by /setup-engine when engine is configured. -->
<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: None — no engine specialist exists for a web stack; `gameplay-programmer` leads code work
- **Language/Code Specialist**: `gameplay-programmer` (client JavaScript); `network-programmer` (`api/`)
- **Shader Specialist**: N/A
- **UI Specialist**: `ui-programmer`
- **Additional Specialists**: `devops-engineer` (Vercel, cron, env), `security-engineer` (bot webhook, secrets), `performance-analyst`
- **Routing Notes**: Code reviews go to `lead-programmer`; cross-cutting technical decisions to `technical-director`

### File Extension Routing

<!-- Skills use this table to select the right specialist per file type. -->
<!-- If a row says [TO BE CONFIGURED], fall back to Primary for that file type. -->

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (primary language) | gameplay-programmer (`v<N>/*.js`, `js/*.js`); network-programmer (`api/**/*.js`) |
| Shader / material files | N/A |
| UI / screen files | ui-programmer (`v<N>/ui.js`, `*.css`, `index.html`) |
| Scene / prefab / level files | N/A — level data lives in `v12/data.js` (level-designer + gameplay-programmer) |
| Native extension / plugin files | N/A |
| General architecture review | lead-programmer |
