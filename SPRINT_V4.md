# Anaconda Park — Sprint V4 status

Honest status of every requirement. **Both `backend` and `frontend` build clean**
(`npm run build`). Every gameplay change was applied in **two** places — the
authoritative server (`backend/`) *and* the client-side local engine
(`frontend/src/game/GameClient.ts`) that runs on the Vercel/offline build — so
behaviour matches whether or not a live server is reachable.

## ✅ Done (implemented + compiling)

| # | Requirement | What changed |
|---|-------------|--------------|
| 1 | **Snake collision** | Only **head-to-head** eliminates; higher score survives, tie kills both; body contact never kills. Removed the old head-into-body death. Server `resolveCombat()` + local engine + README. |
| 2 | **Dynamic obstacles** | 🌳🪨🌲🌵🌼🪵🪷⛰ spawn scaled by average lobby score (10→18→26), wide lanes guarantee a navigable path, sanctuary kept clear. Blocking props *soft-push* (never kill). Rendered in world + on minimap. |
| 3 | **Moving stars** | Dedicated set of ≤20 drifting stars: slow random motion, occasional stops / direction changes, respawn on collect after a short delay. Removed stars from the random food roll. |
| 4 | **Mobile controls** | Whole-screen steering removed. Fixed transparent joystick (bottom-left, ~30% opacity, always visible) is the *only* movement input; right cluster = Boost / Ability / Zoom / Minimap-toggle. Pinch-zoom + multi-touch aware. |
| 5 | **Camera zoom** | Mouse wheel + `+`/`-` (desktop), pinch + zoom button (mobile). Smooth eased interpolation, clamped focus↔reveal, folded on top of stage auto-zoom. No shake. |
| 6 | **Infinite world** | True toroidal wrap-around: no borders, no wall damage. Movement, body-follow, combat, food pickup, bot AI and the **renderer** (camera, LERP, snake chain, food, obstacles, portals, zones) all use shortest-toroidal-delta so the seam is seamless. |
| 7 | **Wormholes** | Spawn on a 5-min cadence, live 1 min, then relocate. Entering teleports to a random safe spot with a short cooldown. Shown in-world (with countdown) + on the minimap. |
| 8 | **Dynamic safe zone** | The Safe Sanctuary relocates every 5 min, heals + protects inside (no PvP), always shown on the minimap. |
| 9 | **Live UI** | HUD (score, health, stage, ability CD, event timer, team scores, leaderboard) already refreshes every 30 Hz tick via `updateHUD()` — no manual refresh. |
| 12 | **Mobile pause** | `visibilitychange` / `blur` auto-pause; server marks the player **inactive → frozen, no damage** (`player_pause`/`player_resume`); local engine freezes the player; session snapshot saved. |
| 13 | **Respawn screen** | Three paths already present: Watch Ad, Stars (20⭐), Ticket, plus free wait + "End match". |
| 10 | **Persistence (client)** | Session (token + profile) cached locally so stars/level/skins survive **app close / restart / offline**; a 401 or offline fetch no longer wipes progress. *(Server-side authoritative store still needed — see below.)* |
| — | **Android packaging** | Capacitor config (`capacitor.config.json`), root scripts (`android:init/sync/open`), safe-area insets, configurable backend via `<meta name="anaconda-server">`, and `ANDROID.md` with the full Play Store flow. |

## 🟡 Needs your infrastructure / accounts to finish

These are coded up to the integration boundary but require credentials or a hosted
service that can't live in the repo:

- **§10 Authoritative / cross-device persistence** — `backend/src/db/Database.ts` is
  **in-memory**; it resets on server restart and doesn't sync across devices. Wire it to
  a real store (Postgres / Redis / Firestore). The client cache above covers single-device
  restart resilience in the meantime.
- **§14 AdMob** — respawn/ad UI hooks exist; add the Google Mobile Ads plugin + your real
  app-id/ad-unit-ids and declare ads in the Play Console. No live ad ids ship here.
- **§15 Coupon/Rewards marketplace** — coupon capture + inventory exist; a configurable,
  region-aware **Rewards catalog** (stock limits, dynamic pricing, approved partners only)
  needs a catalog service + admin. Not yet built.
- **§16 Performance** — client renders on a 60 FPS rAF loop, server runs 30 Hz; formal
  device profiling (Android/iPhone battery, memory, network compression) not yet measured.
- **§17 Security** — `AntiCheatService` validates packet frequency and the server is
  authoritative; short-lived tokens exist. Hardening for the full threat list (speed/teleport
  hacks, transport encryption/WSS in prod, server-side authorization audit) still to do.
- **§11 Functional QA** — no automated test suite yet; needs a pass across every screen/flow.

## Files touched this sprint

- `backend/src/services/GameSessionService.ts` — collision, wrap world, stars, wormholes,
  sanctuary, obstacles, pause protection
- `backend/src/server.ts` — pause handlers, broadcast now includes sanctuary/portals/obstacles
- `backend/src/types/index.ts` — obstacle/star/wormhole/pause types
- `frontend/src/game/GameClient.ts` — local engine parity for all of the above + wrap + server override
- `frontend/src/game/Renderer.ts` — camera zoom, obstacle render, toroidal rendering, minimap markers
- `frontend/src/main.ts` — fixed joystick, zoom input, auto-pause, session persistence
- `frontend/src/style.css` — visible touch controls, zoom/minimap buttons, safe-area insets
- `frontend/index.html`, `capacitor.config.json`, `package.json`, `ANDROID.md` — packaging
