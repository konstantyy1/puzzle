# Game Concept: Фото Пазл (Photo Puzzle)

*Created: 2026-11-09*
*Status: Draft*

> **Reverse-documented from the shipped game** (client v21, live) when the studio
> was adopted. It describes what players already have. Items marked *(inferred)*
> are intent read from the game that still needs the owner's confirmation.
> Sources: `README.md`, `v12/data.js`, `v12/prog.js`, `v20/arena.js`,
> `v21/daily.js`, `api/`.

---

## Elevator Pitch

> It's a jigsaw-puzzle game inside Telegram where you turn any photo, sticker,
> GIF or video from your chats into a puzzle — then race friends and other
> players to put it together.

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | Casual jigsaw puzzle with competitive (PvP) and collection layers |
| **Platform** | Mobile first: Telegram Mini App on iOS and Android; also Telegram Desktop and Web |
| **Target Audience** | Telegram users who enjoy quick casual games with friends (see Target Player Profile) |
| **Player Count** | Single-player campaign and Daily puzzle; online 1v1 Arena; 2×2 team battles; friend duels |
| **Session Length** | 1–5 minutes per puzzle; about 10 minutes per visit *(inferred)* |
| **Monetization** | None — in-game coins only, no real payments |
| **Estimated Scope** | Live game that grows release by release (client v21) |
| **Comparable Titles** | Magic Jigsaw Puzzles, Jigsaw Puzzles Epic *(inferred)* |

---

## Core Fantasy

Your own pictures become the game: the sticker a friend just sent, yesterday's
photo or a moving GIF turns into a puzzle in seconds, and you are the fastest
puzzler in your chat. *(inferred)*

---

## Unique Hook

It's like a classic jigsaw app, AND ALSO any media from your Telegram chats
becomes a puzzle in one tap (animated stickers and GIFs keep moving inside the
pieces), and assembling is also how you fight: in the Arena every correct piece
hits your opponent.

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics (What the player FEELS)

*(inferred from the shipped features — confirm the ranking with the owner)*

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Sensation** (sensory pleasure) | 3 | Own photos; animated stickers and GIFs inside pieces; snap sound, haptics, confetti |
| **Fantasy** (make-believe, role-playing) | 6 | 7 Arena heroes with super-strikes |
| **Narrative** (drama, story arc) | N/A | — |
| **Challenge** (obstacle course, mastery) | 2 | Stars and timed levels, 3×3 to 6×6 boards, Arena ELO and leagues, ranking of the day |
| **Fellowship** (social connection) | 4 | Friends, duels, 2×2 team battles, invites by link |
| **Discovery** (exploration, secrets) | 7 | 20 campaign chapters of new pictures; cases |
| **Expression** (self-expression, creativity) | 5 | Puzzles from own media; avatars, backgrounds, frames, themes |
| **Submission** (relaxation, comfort zone) | 1 | Calm piece-by-piece assembly in short sessions |

### Key Dynamics (Emergent player behaviors)

- Players send stickers, GIFs and photos to the bot to make puzzles of what their chat is talking about.
- Players return every day for the Daily puzzle, the streak bonus and their place in the ranking of the day.
- Players climb Arena leagues and seasons and spend coins on hero upgrades.
- Players invite friends by link to duel and to team up 2×2.

### Core Mechanics (Systems we build)

1. **Jigsaw board**: drag-and-drop assembly on 3×3 to 6×6 grids (Canvas 2D), with hints and a "corners" helper.
2. **Puzzles from Telegram media**: any photo, sticker, GIF or video sent to the bot becomes a puzzle (`api/bot.js`, `api/media.js`, `v13/queue.js`).
3. **Campaign**: 200 levels in 20 chapters, up to 3 stars per level; chapters unlock by total stars; some levels are timed.
4. **Arena**: online 1v1 (ranked and casual). Each correct piece deals `150 / N × attack × combo` damage (N = pieces on the board; crits multiply it) and charges energy for the hero's super-strike. ELO, leagues, monthly seasons, and a bot opponent when nobody is found.
5. **Progression and economy**: coins and XP from levels (`10 + 5 × chapter + 5 × stars`, +20 for a first clear), the daily chest, gifts, streaks, quests and achievements; coins buy cases, hero upgrades and cosmetics.

---

## Player Motivation Profile

### Primary Psychological Needs Served

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Autonomy** (freedom, meaningful choice) | Any own picture becomes a puzzle; free choice of mode, board size and hero | Supporting |
| **Competence** (mastery, skill growth) | Stars, best times, Arena ELO and leagues, ranking of the day | Core |
| **Relatedness** (connection, belonging) | Friends, duels, 2×2 teams, puzzles made from shared chat media | Supporting |

### Player Type Appeal (Bartle Taxonomy)

- [x] **Achievers** (goal completion, collection, progression) — How: stars, 200 levels, achievements, daily quests, streaks, cosmetics
- [ ] **Explorers** (discovery, understanding systems, finding secrets) — How: new chapters and cases only; a minor appeal
- [x] **Socializers** (relationships, cooperation, community) — How: friends, invites, duels, 2×2 team battles
- [x] **Killers/Competitors** (domination, PvP, leaderboards) — How: Arena ELO, leagues, seasons, anonymous leaderboards, ranking of the day

### Flow State Design

- **Onboarding curve**: chapter 1 «Перші кроки» needs no stars; later chapters unlock by stars earned (board sizes per level are not documented yet).
- **Difficulty scaling**: bigger boards (up to 6×6), timed levels, ELO matchmaking in the Arena.
- **Feedback clarity**: stars and time after each level, damage numbers in battle, place in the ranking of the day.
- **Recovery from failure**: instant retry; in the Arena a bot steps in when nobody is found.

---

## Core Loop

### Moment-to-Moment (30 seconds)
Pick up a piece and drop it into place: it snaps, with sound and haptics. In the
Arena the same move hits the opponent.

### Short-Term (5-15 minutes)
Finish a campaign level (stars and coins), an Arena battle, or the Daily puzzle.

### Session-Level (30-120 minutes)
Visits are much shorter, about 10 minutes: the daily chest, gift and streak,
quests, a few levels or battles, maybe a case. *(inferred)*

### Long-Term Progression
200 campaign levels; hero levels and upgrades; league and season rank;
collections of avatars, backgrounds and frames.

### Retention Hooks
- **Curiosity**: the next chapter's pictures; what the next case holds
- **Investment**: coins, upgraded heroes, the daily streak
- **Social**: friends, invites, team battles, the evening bot reminder (opt-in)
- **Mastery**: Arena ELO and seasons, the ranking of the day

---

## Game Pillars

*(inferred from the shipped game — confirm with the owner)*

### Pillar 1: Your pictures, your puzzle
Any picture from Telegram (photo, sticker, GIF or video) becomes a puzzle in one tap.

*Design test*: If a feature makes it slower or harder to turn your own media into a puzzle, the own-media path wins.

### Pillar 2: A quick game in the chat
One puzzle fits into a minute or two, inside Telegram, on a 360×740 phone.

*Design test*: If we're debating between more depth and fewer taps or a shorter session, this pillar says we choose fewer taps and the shorter session.

### Pillar 3: Fair play together
Competition stays fair and friendly: the same Daily puzzle for everyone, only the first attempt counts, anonymous leaderboards, nothing to buy with real money.

*Design test*: If a mechanic gives an advantage that cannot be earned by playing, we cut it.

### Anti-Pillars (What This Game Is NOT)

- **NOT pay-to-win or real-money**: the economy runs on in-game coins only; payments would break Pillar 3.
- **NOT a public gallery of player photos**: removed on purpose, because publishing other people's photos without moderation is unsafe (README «Свідомо не зроблено»).
- **NOT a heavy app**: no install and no build step; it opens instantly inside Telegram.

---

## Inspiration and References

| Reference | What We Take From It | What We Do Differently | Why It Matters |
| ---- | ---- | ---- | ---- |
| Classic mobile jigsaw apps (e.g. Magic Jigsaw Puzzles) | Calm drag-and-drop assembly, board sizes, collections | Pictures come from the player's own chats; animated pieces | Proves the calm jigsaw loop holds players |
| Puzzle battlers (e.g. Puzzle Quest) *(inferred)* | Solving powers attacks; heroes, energy, super-strikes | A real-time 1v1 jigsaw race instead of turns | Turns a solo activity into a duel |
| Daily puzzle games (e.g. Wordle) *(inferred)* | One shared puzzle a day, first attempt counts, streaks | Ranking of the day inside Telegram, opt-in bot reminder | A daily reason to come back |

**Non-game inspirations**: sharing stickers and GIFs in Telegram chats. *(inferred)*

---

## Target Player Profile

*(inferred — confirm with the owner)*

| Attribute | Detail |
| ---- | ---- |
| **Age range** | To confirm: teens and adults who use Telegram |
| **Gaming experience** | Casual |
| **Time availability** | Short breaks during the day; a few minutes in the evening |
| **Platform preference** | Phone, inside Telegram |
| **Current games they play** | Telegram mini-games, casual mobile puzzles |
| **What they're looking for** | A quick game to play with friends right in the messenger, with their own pictures |
| **What would turn them away** | Long loading, real-money pressure, confusing screens |

---

## Technical Considerations

| Consideration | Assessment |
| ---- | ---- |
| **Recommended Engine** | Web, no engine: already shipped (see `CLAUDE.md` → Technology Stack) |
| **Key Technical Challenges** | Smooth dragging on low-end phones; animated stickers, GIFs and video inside pieces; real-time 1v1 over serverless functions and Redis; differences between Telegram apps |
| **Art Style** | 2D: a bright UI; the pictures are photos and player media |
| **Art Pipeline Complexity** | Low |
| **Audio Needs** | Minimal: sound effects (`v4/sound.js`) |
| **Networking** | Client-server: Vercel Functions + Upstash Redis |
| **Content Volume** | 200 campaign levels in 20 chapters; 7 heroes; a new Daily puzzle every day; unlimited custom puzzles |
| **Procedural Systems** | Piece shuffling; the Daily puzzle uses a shared seed, so every player gets the same layout |

---

## Risks and Open Questions

### Design Risks
- Players who finish the 200 campaign levels may run short of goals besides the Arena and the Daily puzzle *(inferred)*
- The coin economy (cases, upgrades, rewards) has not been balance-checked as a whole

### Technical Risks
- Vercel Hobby limits: at most 12 functions (8 used) and one cron run a day
- Preview deployments share the production Redis database
- Older Telegram apps may lack newer Mini App methods

### Market Risks
- Discovery inside Telegram depends on invites and sharing *(inferred)*

### Scope Risks
- Every release copies changed files into a new `v<N>/` folder, so the repository keeps growing; unused old files must be removed

### Open Questions
- Are the three pillars right? Confirm with the owner.
- Who is the main player: friends playing together, or strangers in the Arena? Answer from the owner's input and play data.

---

## MVP Definition

The core loop has shipped and the game is live (client v21).

**Core hypothesis**: Players enjoy assembling puzzles made from their own Telegram media in short sessions, alone and against others.

**Required for MVP** (shipped):
1. The jigsaw board with drag-and-drop
2. Puzzles from Telegram media through the bot
3. Campaign levels with stars

**Explicitly NOT in MVP** (layers on top of the core loop, also shipped):
- Arena, heroes and seasons
- Daily puzzle and bot reminders
- Friends, duels and 2×2 teams
- Cases, workshop and cosmetics

### Scope Tiers (if budget/time shrinks)

| Tier | Content | Features | Timeline |
| ---- | ---- | ---- | ---- |
| **MVP** | Campaign + own puzzles | Core loop | Shipped |
| **Vertical Slice** | — | — | Not used (live game) |
| **Alpha** | — | — | Not used (live game) |
| **Full Vision** | Current live content | Everything in v21 | Live; grows with each release |

---

## Next Steps

- [ ] Owner confirms the pillars (creative-director review)
- [x] Technology stack in `CLAUDE.md` (written at adoption; `/setup-engine` does not cover a web stack)
- [ ] Visual Identity Anchor (`/art-bible`)
- [ ] Map the shipped systems (`/map-systems`) → `design/gdd/systems-index.md`
- [ ] Reverse-document each core system (`/reverse-document design <path>`, then `/design-review`)
- [ ] `/gate-check` Concept → Systems Design
- [ ] Plan the next release (`/sprint-plan new`)
