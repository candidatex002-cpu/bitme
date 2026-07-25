# ☁️ Supabase cloud sync (§11)

Server-side profiles/progress/leaderboard can sync to **Supabase** so player data
survives redeploys and is shared across every server instance. It's **optional and
env-gated** — with no keys set, the backend uses the local file store exactly as before.

## How it works

- On boot the backend loads the local file snapshot, then (if configured) **pulls the
  latest snapshot from Supabase** and applies it over the top.
- On every debounced save it writes the file **and upserts the snapshot to Supabase**.
- Implemented with the Supabase **REST API via `fetch`** — no SDK dependency added.
  See `backend/src/db/SupabaseSync.ts`.

## 1. Create the table

In the Supabase SQL editor:

```sql
create table if not exists game_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
```

## 2. Set the env vars (server only)

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role key>   # server-side only — never ship to clients
SUPABASE_STATE_ID=main                    # optional; the row id to store under
```

Use the **service_role** key on the server (it bypasses RLS). Keep it secret — set it in
your host's environment (Render/Railway/Fly/etc.), never in client code or the repo.

## 3. Deploy the backend somewhere stateful

Host `backend/` on a platform that keeps a process alive (Render, Railway, Fly.io, a VPS…)
and point the app at it via the `<meta name="anaconda-server">` tag (see `ANDROID.md`).
On serverless (e.g. Vercel functions) the file store is ephemeral — Supabase becomes the
durable store, though a long-lived process is still recommended for the Socket.IO world.

## Notes / next steps

- Current model stores the whole game snapshot as one `jsonb` row — simple and correct for a
  single authoritative server. For horizontal scale, split into per-user rows
  (`profiles` keyed by `userId`) and load/save individually; `SupabaseSync` is the single
  place to change.
- The **client** still caches the session in `localStorage` for offline/instant load; the
  hosted backend + Supabase is the cross-device source of truth once deployed.
