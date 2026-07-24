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
| 10 | **Persistence** | **Server**: file-backed DB (`data/anaconda-db.json`, atomic + debounced writes, flush on exit, `DATA_FILE` env override) — profiles/progress/leaderboard survive restarts on any stateful host. **Client**: session cached locally so stars/level/skins survive app close / restart / offline; a 401 or offline fetch no longer wipes progress. |
| 15 | **Rewards marketplace** | Dedicated **Rewards** page (from Home) + `RewardsService`: data-driven catalog (no hard-coded brands — "approved provider" labels), **regional availability**, **dynamic pricing** (scarcity), **stock limits**, **min-level thresholds**. Redeem deducts Stars, decrements stock, issues a persisted voucher code. `GET /api/rewards/catalog` + `POST /api/rewards/redeem`. |
| — | **Android packaging** | Capacitor config (`capacitor.config.json`), root scripts (`android:init/sync/open`), safe-area insets, configurable backend via `<meta name="anaconda-server">`, and `ANDROID.md` with the full Play Store flow. |

## 🟡 Needs your infrastructure / accounts to finish

These are coded up to the integration boundary but require credentials or a hosted
service that can't live in the repo:

- **§10 Multi-node / cross-device cloud save** — the file-backed DB now survives restarts on
  a single stateful host, but for horizontal scaling / true cross-device sync, swap
  `Database.load()`/`flush()` for Postgres / Redis / Firestore. (On serverless like Vercel the
  filesystem is ephemeral — host the backend somewhere with a disk, or plug in a cloud DB.)
- **§15 Reward fulfilment** — the marketplace, catalog, pricing, stock and voucher issuance are
  built; hooking real gift-card / partner delivery to an **authorized provider** (and moving the
  catalog+stock into the DB for durable inventory) is the remaining integration.
- **§14 AdMob** — a clean **ad boundary** now exists (`frontend/src/game/AdService.ts`):
  rewarded / interstitial / lobby-banner / app-open methods, routed through the app (rewarded
  respawn, between-match interstitial, banner hidden during gameplay). To go live, install the
  Google Mobile Ads Capacitor plugin, call `ads.attachPlugin()` + `ads.configure()` with your
  real app-id/ad-unit-ids, and declare ads in the Play Console. No live ad ids ship here.
- **§16 Performance** — client renders on a 60 FPS rAF loop, server runs 30 Hz; formal
  device profiling (Android/iPhone battery, memory, network compression) not yet measured.
- **§17 Security** — Strong by construction: the client only ever sends *angle + boost*; the
  server computes **all** positions, so speed/teleport/position hacks are structurally
  impossible. Packet-flood limiting + malformed-input (NaN/Infinity) rejection are in place, and
  stars/score/purchases/redemptions are all server-validated. Remaining: enforce **WSS/HTTPS in
  prod**, rotate/short-TTL tokens, and a full server-side authorization audit.

## 🧪 Tests (§11)

`cd backend && npm test` — 17 passing (Node's built-in runner, no extra deps). Covers auth,
economy, rewards (region/pricing/stock/guards), progression, **DB persistence round-trip**, and
the authoritative game session (4 linked wormholes, small starting size, **head-to-head-only
combat**, head-into-body-doesn't-kill, milestone growth gate, pause protection). Frontend E2E /
device UI passes are still manual.

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
