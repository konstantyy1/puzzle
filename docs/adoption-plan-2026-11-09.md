# Adoption Plan

> **Generated**: 2026-11-09
> **Project phase**: Concept (the studio's stage; the game itself is live at client v21)
> **Engine**: Web, no game engine (vanilla HTML5/JS Telegram Mini App); outside Godot/Unity/Unreal
> **Template version**: v1.2.0 (upstream commit `05ad7c8`)

Work through these steps in order. Check off each item as you complete it.
Re-run `/adopt` anytime to check remaining gaps.

**Found at adoption:** 0 GDDs, 0 ADRs, 0 stories; 100+ source files at the
repository root (`index.html`, `v<N>/`, `js/`, `api/`). Settings: rigor
`standard` (workflow `standard`, review mode `lean`), automation `guided`.

---

## Step 1: Fix Blocking Gaps

### 1a. The hooks cannot find the code root
The hooks only know `src/`, `Assets/` and `Source/`; this game's code sits at the
repository root, so automated code scans report NOT ASSESSED.
**Fix (done at adoption)**: `CLAUDE.md` → Project Structure names the code paths;
agents scan them directly. Do not move the game code: players load these paths.
**Time**: done
- [x] Code root documented in `CLAUDE.md`

### 1b. Studio files must not reach players
**Fix (done at adoption)**: `.vercelignore` keeps `.claude/`, `CLAUDE.md`,
`project.yaml`, `docs/`, `design/` and `production/` off the website.
**Time**: done
- [x] `.vercelignore` added; the live site returns 404 for `/CLAUDE.md`

---

## Step 2: Fix High-Priority Gaps

### 2a. No game concept document
**Fix (drafted at adoption)**: `design/gdd/game-concept.md`, reverse-documented
from the shipped game. Its pillars are inferred.
**Next**: the owner confirms the pillars (creative-director review).
**Time**: 5 min
- [x] Draft written
- [ ] Pillars confirmed by the owner

### 2b. No automated tests in the repository
Release checks (a headless smoke run at 360×740 and API scripts) ran outside the repository.
**Fix**: `/test-setup` — scaffold `tests/` for this web stack (Node's built-in test runner plus headless Chromium).
**Time**: 1 session
- [ ] `tests/` scaffolded and run before every release

### 2c. The stack is outside the studio's engines
`/setup-engine` supports Godot, Unity and Unreal only, so its outputs were written
by hand: `CLAUDE.md` → Technology Stack, `.claude/docs/technical-preferences.md`,
`docs/engine-reference/web/VERSION.md`. `engine.name` stays unset in
`project.yaml` (its values are Godot | Unity | Unreal).
**Time**: done; re-verify quarterly
- [x] Stack documented
- [ ] Re-verify `docs/engine-reference/web/VERSION.md` (its `Last verified` date) every quarter

---

## Step 3: Bootstrap Infrastructure

### 3a. Register existing requirements (creates tr-registry.yaml)
Run `/architecture-review` once the first ADRs (Step 4b) exist; this run
bootstraps the TR registry from the GDDs and ADRs.
**Time**: 1 session
- [ ] tr-registry.yaml created

### 3b. Create control manifest
Run `/create-control-manifest`
**Time**: 30 min
- [ ] docs/architecture/control-manifest.md created

### 3c. Create sprint tracking file
Run `/sprint-plan update`
**Time**: 5 min
- [ ] production/sprint-status.yaml created

### 3d. Set authoritative project stage
At Concept there is no gate to run (Concept is the default stage). Saved at
adoption: `project.stage: Concept` in `project.yaml` and `production/stage.txt`.
**Time**: done
- [x] `project.stage` in `project.yaml` written (legacy `production/stage.txt` also updated)

---

## Step 4: Medium-Priority Gaps

### 4a. Systems index and GDDs for the shipped systems
Run `/map-systems` (writes `design/gdd/systems-index.md`), then
`/reverse-document design <path>` and `/design-review` per system.
**Time**: 1 session per system
- [ ] Puzzle board: `js/puzzle.js`, `js/media.js`
- [ ] Campaign and progression: `v12/data.js`, `v12/prog.js`
- [ ] Economy (coins, cases, workshop): `v12/prog.js`, `v11/cases.js`
- [ ] Arena, heroes and seasons: `v20/arena.js`, `api/arena.js`
- [ ] Daily puzzle and reminders: `v21/daily.js`, `api/daily.js`, `api/remind.js`
- [ ] Friends, duels and 2×2 teams: `v18/social.js`, `v5/team.js`, `api/team.js`
- [ ] Puzzles from the chat: `api/bot.js`, `api/queue.js`, `v13/queue.js`

### 4b. ADRs for decisions already made
Run `/architecture-decision` for each, recorded as already accepted.
**Time**: 30 min each
- [ ] No build step; client files versioned in `v<N>/` folders, with auto-update through `version.json`
- [ ] Vercel Functions + Upstash Redis, and the Redis key schema
- [ ] Saves in localStorage + Telegram CloudStorage
- [ ] Telegram media through the `api/media.js` proxy (the bot token never reaches the client)

### 4c. Art bible and Visual Identity Anchor
Run `/art-bible`, sections 1–4 (the Concept → Systems Design gate needs the anchor).
**Time**: 1 session
- [ ] Visual identity written

### 4d. Accessibility and interaction patterns
Run `/ux-design` to write `design/accessibility-requirements.md` and `design/ux/interaction-patterns.md`.
**Time**: 1 session
- [ ] Both written

---

## Step 5: Optional Improvements

- [ ] Localization plan: the UI is Ukrainian only (`/localize`)
- [ ] Live-ops calendar for Arena seasons and the Daily puzzle (`/team-live-ops`)
- [ ] Performance check on a low-end phone (`/perf-profile`)

---

## What to Expect from Existing Stories

Existing stories continue to work with all template skills. New format checks
(TR-ID validation, manifest version staleness) auto-pass when the fields are
absent — so nothing breaks. They won't benefit from staleness tracking until
regenerated. Do not regenerate stories that are in progress or done.

This project had no stories at adoption.

---

## Re-run

Run `/adopt` again after completing Step 3 to verify all blocking and high gaps
are resolved. The new run will reflect the current state of the project.
