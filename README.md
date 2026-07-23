# 🐍 Anaconda Park

An open-world, server-authoritative multiplayer snake battle-royale set in a living city park.
Grow · Explore · Compete · Survive.

## Quick start

```bash
npm run install:all   # install root + backend + frontend deps (first time only)
npm run dev           # starts the backend (:4000) AND the frontend (:3000) together
```

Then open **http://localhost:3000**.

> The frontend proxies `/api` and `/socket.io` to the backend, so you only visit port 3000.
> If you ever run the client from a different origin, append `?server=http://localhost:4000`.

Run pieces individually if you prefer:

```bash
npm run dev:backend   # authoritative game server on :4000
npm run dev:frontend  # Vite dev client on :3000
```

Production build: `npm run build` (backend → `backend/dist`, frontend → `frontend/dist`).

## Controls

| Action  | PC                        | Mobile                 |
|---------|---------------------------|------------------------|
| Move    | Mouse aim **or** WASD / arrows | Drag the on-screen joystick |
| Boost   | Hold **Shift** or left mouse | **BOOST** button       |
| Ability | **Space** (Coil Guard)    | **ABILITY** button     |
| Pause   | **Esc**                   | Pause chip (top-left)  |

## Game design

- **Growth stages** — Baby → Young → Adult → Elite → Titan. Higher score = bigger snake, more Defense.
- **Stats** — Health (100), Score, Defense (damage reduction), Speed %.
- **Power-ups** — 🍒 Cherry +10 · 🍄 Mushroom +15 · 🍎 Apple +25 · 🐸 Frog +30 · ⭐ Star +50 · 🥚 Egg (big prize) · 🛡️ Shield (invulnerable) · ⚡ Speed (boost).
- **Combat rule** — hit a snake with a *lower* score and you eat it; if a *higher*-score snake hits you, you lose health. Defense softens it, Shield blocks it.
- **Ability** — *Coil Guard*: a short dash + protective shield on a 12s cooldown.
- **Respawn options** — Stars (20⭐) · Watch Ad (free) · Wait 25s (free) · Ticket (instant).
- **Game modes** — Classic (FFA) · Battle Royale (shrinking storm) · Team (4v4) · Event (world events).
- **Missions** — Daily / Weekly / Event, plus **Achievements**, all tracked server-side.
- **World events** — Rain Storm, Volcano, Titan Boss Raid, Treasure Box Drop.

## Progression (v2)

- **Account Level 1→1000** with an XP curve, plus **Prestige** after 1000 (keeps skins & evolutions).
- **Snake Evolution** — Baby → Young → Adult → Elite → Titan → Legend, unlocked by **Account Level + Evolution XP** (earned from missions/events, *never* raw score) and switchable in Profile.
- **Match growth** is separate & temporary: fast early, slowing by score band, with a hard length cap.
- **Rank titles** (Bronze → Master, then Legend) shown on Home/Profile.
- All progression is **server-authoritative** — the client only sends inputs; the server validates and awards XP/levels/currency.

## App structure

Bottom navigation with one job per screen: **Home** (what to do next) · **Play** (modes + Global/Local matchmaking) · **Missions** (Daily/Weekly/Event/Achievements) · **Inventory** (skins/power-ups/coupons) · **Profile** (level, evolution, stats, prestige). Events, Social and Settings are reachable from Home / the top bar. Visual style is a **bright daytime** theme (white roads, green parks, blue water).

## Roadmap (not yet built)

- **Phase 2** — road-only movement on OpenStreetMap-derived stylized maps, buildings-with-purpose, traffic, intersections.
- **Phase 3** — Hunter social-deduction mode, team voice/text chat + ping wheel, real geo-IP regional servers, cross-platform cloud save, seasonal maps & world-progression city unlocks.

> Local Explorer / Global Adventure is currently a matchmaking **UI + region label**, not real geo-IP routing (Phase 3).

## Architecture

```
backend/   Node + Express + Socket.IO — authoritative 30 Hz simulation
  services/GameSessionService.ts   world sim: movement, combat, growth, buffs, ability
  services/GameSessionManager.ts   one live session per game mode
  services/{Auth,Economy,Mission,AntiCheat,Admin}Service.ts
  db/Database.ts                   in-memory profiles, missions, achievements, leaderboard
frontend/  Vite + TypeScript + Canvas
  game/GameClient.ts   socket transport (input, ability, respawn)
  game/Renderer.ts     world + snakes + skins + shields + minimap
  main.ts              screens, HUD, controls, dashboard UI
```

The server owns all state — clients only send input (angle + boost) and render broadcast snapshots.
