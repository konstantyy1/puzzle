# Claude Code Game Studios -- Game Studio Agent Architecture

Indie game development managed through 49 coordinated Claude Code subagents.
Each agent owns a specific domain, enforcing separation of concerns and quality.

**This project:** «Фото Пазл» (Photo Puzzle) — a jigsaw-puzzle Telegram Mini App,
bot @fotopuzzle_bot. The game is live: players are on client v21, and every push
to `main` reaches production. The studio was adopted into this existing game on
2026-11-09 (upstream `Donchitos/Claude-Code-Game-Studios` v1.2.0, commit `05ad7c8`).

## Technology Stack

- **Engine**: Web, no game engine — vanilla HTML5 + CSS + JavaScript (DOM screens, Canvas 2D puzzle) running in Telegram as a Mini App (`telegram-web-app.js`)
- **Language**: JavaScript — plain browser scripts without a build step; Node.js 26.x ES modules on the server
- **Backend**: Vercel Functions in `api/` (Hobby plan: at most 12 functions, cron at most daily) + Upstash Redis (REST)
- **Version Control**: Git, GitHub `konstantyy1/puzzle`; a push to `main` deploys production on Vercel
- **Build System**: None — Vercel serves the repository as-is (preset "Other", no build command)
- **Asset Pipeline**: None — images in `assets/`; player puzzles come from Telegram media via `api/media.js`

> **Note**: The engine-specialist agents (Godot, Unity, Unreal) do not apply to
> this project. `engine.name` in `project.yaml` accepts only those three, so it
> stays unset on purpose. Route code work to the engine-agnostic agents:
> `gameplay-programmer`, `ui-programmer`, `network-programmer` (`api/`),
> `devops-engineer` (Vercel), `security-engineer`, `performance-analyst`; reviews
> to `lead-programmer` and `technical-director`.

## Project Structure

@.claude/docs/directory-structure.md

**This project's code root is the repository root, not `src/`.** The engine is
outside the Godot/Unity/Unreal table, so the hooks report the code root as
unresolved; scan and edit these paths directly:

- `index.html` — lists, in order, every client file the game loads
- `v<N>/` — client modules; each file sits in the folder of the version that last changed it
- `js/`, `css/`, `assets/` — base client files and images
- `api/` and `api/_lib/` — Vercel serverless functions and shared server code
- `vercel.json`, `version.json` — function and cron config; live client version

Release process: `README.md` → «Як випускати нову версію» (copy the changed file
into `v<N+1>/`, repoint `index.html`, add `v<N+1>/update.js`, bump `version.json`).
Never restructure these folders — players load these exact paths.

## Engine Version Reference

<!-- ENGINE-REFERENCE-IMPORT: no game engine here. The web stack's pinned versions
     and rules live in docs/engine-reference/web/VERSION.md. The Godot, Unity and
     Unreal reference folders were not installed. -->
@docs/engine-reference/web/VERSION.md


## Technical Preferences

`project.yaml` at the repo root is the primary config store — engine, specialists,
naming, platform, performance, modes. Skills resolve it via `resolve_config`
(see `.claude/docs/config-resolution.md`).

`.claude/docs/technical-preferences.md` is the **legacy fallback**, read on demand
when a key is absent from `project.yaml`. It is not imported here: before
`/setup-engine` runs it is almost entirely `[TO BE CONFIGURED]` placeholders, and
after it runs `project.yaml` holds the real values.

**In this project** `/setup-engine` was not run (it supports Godot, Unity and
Unreal only). The stack was filled in by hand in
`.claude/docs/technical-preferences.md`; `project.yaml` holds the stage and the
modes.

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
  (exempt: `active.md` appends, agent memory, a subagent's new file at the path
  its orchestrating skill named; see `.claude/rules/agent-memory.md`)
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction
- A skipped or dismissed question is not an answer: act on nothing, re-ask in
  plain text and wait
- Started outside this file's folder? Warn first: hooks, deny rules and the
  ask-first mode load only when Claude Code starts here

See `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` for full protocol and examples.

### Working agreement with this project's owner

Set by the owner; where it conflicts with the defaults above, it wins.

- The owner is not a programmer. Write in simple Ukrainian. Ask only product
  questions (what players will see or get), as 2–3 plain options; never ask
  technical questions — the studio decides those itself.
- `modes.automation: guided` — small decisions: recommend and proceed; big ones
  (scope changes, deletions, schema changes): ask in plain words.
- Standing instruction: when the owner asks for a change, building, testing and
  publishing it (commit to `main`, Vercel deploy) is part of the request. Never
  hand the owner manual steps, ZIP files or uploads.
- Players never get studio files: keep `.vercelignore` covering `.claude/`,
  `CLAUDE.md`, `project.yaml`, `docs/`, `design/` and `production/`.

> **First session?** If the project has no engine configured and no game concept,
> run `/start` to begin the guided onboarding flow.

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

Read `.claude/docs/context-management.md` on demand — it is a reference, not
session context. Two of its conventions are load-bearing and cited by name
elsewhere in the repo, so they are restated here rather than lost:

- **`production/session-state/active.md` is the session checkpoint.** The file is
  the memory, not the conversation. Read it first after any compaction, crash, or
  `/clear`.
- **Helpers in `.claude/scripts/` emit observations, never verdicts.** A script
  that scores or judges will eventually contradict a mode or override it cannot
  see. (Cited by `artifact-check.sh` and `adr-dep-graph.sh`.)
