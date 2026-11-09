# Smoke Test: Critical Paths — «Фото Пазл»

**Purpose**: the core checks before every release (about 15 minutes by hand).
**Run via**: `/smoke-check` reads this file. Most of it is automated: `npm test`
(server, bot and game data) and `node tests/smoke/browser-smoke.mjs <url>` (the game in a phone-sized browser).
**Update**: add an entry when a new core system ships.

## Core stability (always run)

1. The game opens from the bot (`/start` → «🎮 Грати») to the home screen with no errors. *(browser smoke, Telegram stubbed)*
2. Every screen opens: home, levels, Daily Puzzle, hero, profile, free puzzle, arena, friends, friend page, cases. *(browser smoke)*
3. No screen is wider than the phone at 320, 360 and 414 px; every button responds without errors. *(browser smoke)*

## Core mechanic

4. Campaign: level 1 starts, the picture can be assembled, the win screen shows stars and coins. *(browser smoke)*
5. Daily Puzzle: the same picture for everyone; only the first attempt goes into the day ranking; the ranking shows your place. *(npm test + browser smoke)*
6. Arena: a search finds another player or, after about 9 seconds, a bot; the fight ends with a result screen; ranked results change the rating once. *(npm test + browser smoke)*
7. Custom puzzle from a sticker, GIF, photo or video sent to the bot. *(by hand: needs real Telegram media)*
8. Bot: `/start`, `/help`, `/daily`, `/stop` answer; the evening reminder reaches only players who switched it on and have not played today. *(npm test)*

## Data integrity

9. Progress (coins, stars, levels, heroes) is still there after closing and reopening the game. *(browser smoke: reload; Telegram CloudStorage by hand)*
10. Leaderboards show only anonymous names, and a name can never inject page code. *(browser smoke: a name with HTML in it)*
11. Only data signed by Telegram for this bot is accepted. *(npm test)*

## Performance

12. Dragging pieces stays smooth (60 fps target on a mid-range phone). *(browser smoke gives a rough number; by hand on a phone)*
13. Memory does not keep growing over 5 minutes of play. *(by hand; browser smoke reports the heap size)*
