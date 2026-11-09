# Web Stack — Version Reference

> Last verified: 2026-11-09

This project has no game engine. Its "engine" is the web platform inside Telegram
plus a Vercel and Upstash backend. Agents read this file instead of a Godot, Unity
or Unreal `VERSION.md`.

| Field | Value |
|---|---|
| **Engine** | Web (no game engine): vanilla HTML5 / CSS / JavaScript |
| **Client runtime** | Telegram Mini App in the Telegram apps' WebView (iOS, Android, Desktop, Web) |
| **Telegram client API** | Telegram Web Apps script `telegram-web-app.js`, loaded by `index.html` |
| **Bot** | Telegram Bot API through a webhook (`api/bot.js`); command menu versioned in `api/_lib/cmds.js` |
| **Server runtime** | Vercel Functions, Node.js 26.x, ES modules (`"type": "module"`) |
| **Database** | Upstash Redis REST API (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) |
| **Hosting limits** | Vercel Hobby: at most 12 functions (8 used); cron at most once a day (`vercel.json`) |
| **Client version** | v21 (`version.json`) |
| **Pinned** | 2026-11-09 |

## Knowledge Gap

Telegram adds Mini App features with new Bot API versions, so methods newer than
the model's training data may exist, and older Telegram apps may lack newer ones.

1. Check the official docs before using a `Telegram.WebApp` method or a Bot API field.
2. Feature-detect (`Telegram.WebApp.isVersionAtLeast(...)`, or check that the method exists) and keep a fallback: the game must still open in a plain browser.
3. Vercel and Upstash change limits and runtimes; confirm a limit in their docs before relying on it.

## Rules for agents

- Keep the client build-free: plain `<script>` tags listed in `index.html`; no bundler and no npm packages in the client.
- One serverless function per file in `api/`; shared code goes to `api/_lib/` (not a function). Stay at or under 12 functions.
- Secrets stay in Vercel environment variables. The bot token never reaches the browser — Telegram files go through `api/media.js`.
- Redis keys are a shared live schema (`u:<uid>`, `dz:<day>`, `dzd:<day>:<uid>`, `rem:on`, `bot:cmds`, …): treat any change to them as a schema change and ask first.
- Preview deployments use the same Redis database as production.

## Official documentation

- Telegram Mini Apps: https://core.telegram.org/bots/webapps
- Telegram Bot API: https://core.telegram.org/bots/api
- Vercel Functions: https://vercel.com/docs/functions
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Upstash Redis REST API: https://upstash.com/docs/redis/features/restapi
