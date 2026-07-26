# Anaconda Park — Sprint V5 status & §12 QA

Both packages **build clean** (`npm run build`) and the backend suite is **23/23 green**
(`cd backend && npm test`). Every gameplay change was applied in the authoritative server
**and** the client local engine (the offline/deployed build) so behaviour matches everywhere.

## Section status

| # | Sprint item | Status |
|---|-------------|--------|
| 1.1 | Settings bug | ✅ In-game settings (Pause): handedness / SFX / music apply live, gameplay resumes without restart, controls never disabled, persisted. |
| 1.2 / 2 | Game modes don't change gameplay | ✅ 6 modes with distinct rules: **Free Roam** (rename), **Explorer** (story), **Battle Royale** (timer + shrinking storm + last-standing), **Team** (team scoring), **Classic Snake / Nokia** (true solo: walls+self kill, no bots), **Event** (disabled). Solo forced to local engine. |
| 3 | Health system | ✅ Health bar hidden in normal play, shows on damage/combat. Hazards deal damage: 🌵 cactus, 🔥 lava, ☠️ poison; local engine has a full loop (hazard hp-loss → elimination, food heals, shield/super immune). |
| 4 | Home redesign | ✅ Clean header (logo/notifications/settings/avatar), welcome (name/level/rank/stars/XP), big action grid, Social in bottom nav, tutorial clutter removed, Leaderboard page. |
| 5 | First-time experience | ✅ Welcome → name/avatar/country/language → **live username availability + suggestions** → Legend story → interactive tutorial → Home. Shown once; replayable from Settings. |
| 6 | Profile management | ✅ Edit Profile (avatar, display name with 7-day cooldown + validation, title, country, region), Favourite Snake, Match History. Username is the permanent unique id. |
| 7 | Matchmaking | ✅ **Global Adventure** = one option, auto best-server (no country picking). **Local Explorer** = Country → State → City, defaults from country, browsable. |
| 8 | Map size / 25 players | ✅ World 3200 → **6000** (single shared `WORLD` constant across engine + renderer + backend), scaled food/stars/obstacles, bot density ~20–24 (real players replace bots). True 25-player *live load* needs the hosted server deployed. |
| 9 | Professional icons | 🟡 In progress (SVG asset system + custom renderers being added). |
| 10 | Game-state validation | ✅ Each mode loads its own config/objectives/timer/scoring/respawn (tested). |
| 11 | Save system / Supabase | ✅ File persistence + client cache + **optional Supabase cloud sync** (env-gated, `SUPABASE.md`). Needs your Supabase project + a hosted stateful backend to activate. |
| 12 | QA | This doc + 23 automated tests. |

## §12 QA checklist

| Check | How it's verified |
|-------|-------------------|
| Every settings option works | Code + in-game panel; live handedness/audio. Needs a device tap-test. |
| Handedness switching updates controls | ✅ Live class swap on the HUD; input re-established on resume. |
| All modes launch correct rules | ✅ Automated: `modes load distinct rules`; mode→engine wiring. |
| Health & damage function | ✅ Automated: `environmental hazard burns hp then eliminates`, `shield protects`. |
| Profile creation & editing | ✅ Onboard + edit endpoints; cooldown/validation. Needs UI click-test. |
| Username uniqueness enforced | ✅ Automated: validation/availability/suggestions/onboarding + duplicate rejection. |
| Story intro & tutorial only for new users | ✅ localStorage-gated (`ap_onboarded`, `ap_story_seen`, `ap_tutorial_seen`); replayable from Settings. |
| Global & Local matchmaking | ✅ Global auto-server; Local country→state→city. Real geo-routing is Phase-3 infra. |
| Map supports ≥25 players | ✅ Code capacity (world 6000, bots 24). Live 25-player load = **needs deployed server**. |
| UI icons production-quality | 🟡 Icon pack in progress. |
| Data saves to Supabase & restores | ✅ Adapter + hydrate/flush wiring + `SUPABASE.md`. **Needs your keys** to test end-to-end. |
| No console errors / broken nav | ✅ Startup 401-cascade fixed; typecheck + build clean. Needs a full manual click-through. |

## Still needs YOUR infrastructure (not code)

- **§9** final SVG icon assets (in progress on your side).
- **§11** a Supabase project + `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`, and the backend
  hosted on a stateful platform (Render/Railway/Fly/VPS) for real cross-device save.
- **§8** provisioning the authoritative Socket.IO server for genuine 25-concurrent-player load
  (the deployed web/app build is the offline engine by design).
- **§14 (V4)** real AdMob ad-unit ids; live playtest / device QA pass.
