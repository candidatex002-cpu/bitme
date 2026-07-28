# 🚀 Deploying Snake Clash

## The one thing to understand first

The backend is a **long-lived, stateful process**: it runs an authoritative world simulation
on a 30 Hz `setInterval`, holds every match in memory, and serves Socket.IO WebSockets.

That **cannot run on Vercel, Netlify, Cloudflare Pages or any serverless/static host.** Those
platforms run a function per request and tear it down; there is no process to keep the world
ticking, and Vercel's serverless functions do not support WebSockets at all.

So the deployment is always two pieces:

| Piece | Where | Why |
|---|---|---|
| `frontend/` | Vercel / Netlify / any static host | Plain static SPA — perfect fit |
| `backend/`  | Render / Railway / Fly.io / a VPS | Needs a process that stays alive |

The frontend is then pointed at the backend's URL. They do **not** need to share a domain —
the backend allows cross-origin calls via `ALLOWED_ORIGINS`.

> A frontend deployed with **no** backend configured still works: the client detects it and
> runs the offline local engine (single-player with bots). All progress saves to
> `localStorage`. No console errors, no failed requests.

---

## 1. Deploy the backend

Pick one. All three are configured and verified — the repo already contains what each needs.

### Option A — Render (fastest: one click) ⭐ recommended to start

The repo ships a **Blueprint** (`render.yaml`), so Render configures itself.

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect this repo. Render reads `render.yaml` and proposes the service.
3. Set the one variable it must ask you for:
   `ALLOWED_ORIGINS = https://bitme-jade.vercel.app`
4. **Apply**.

`JWT_SECRET` is generated automatically and kept stable across deploys. A 1 GB disk is
mounted at `/var/data` so player profiles survive redeploys.

> **Plans.** `starter` (~$7/mo) stays awake. The `free` plan sleeps after 15 minutes idle —
> the first player then waits ~50 s for a cold start and any live match is dropped, which is
> rough for a realtime game. Free also has no disk, so switch `plan: free` **and** configure
> Supabase (below) if you want zero cost.

### Option B — Railway (no sleep, cheap)

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Set **Root Directory** to `backend` (Settings → Source).
3. Variables: `ALLOWED_ORIGINS`, and a `JWT_SECRET` you generate:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Railway detects the Dockerfile and deploys. Add a volume at `/data` for persistence.

### Option C — Fly.io (best latency per dollar)

`backend/fly.toml` and `backend/Dockerfile` are ready. From `backend/`:

```bash
fly launch --no-deploy --copy-config     # rename `app` in fly.toml first
fly volumes create game_data --size 1
fly secrets set JWT_SECRET="$(openssl rand -hex 32)" \
                ALLOWED_ORIGINS="https://bitme-jade.vercel.app"
fly deploy
```

`auto_stop_machines` is off on purpose — suspending a 30 Hz simulation between requests would
kill live matches.

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `ALLOWED_ORIGINS` | **Yes** | Your frontend origin, exact, no trailing slash. Unset = CORS open to `*` |
| `JWT_SECRET` | **Yes** | The server *refuses to boot* in production without it — deliberate. Keep it stable or every token is invalidated |
| `NODE_ENV=production` | Yes | Enables the guard above |
| `DATA_FILE` | Recommended | Point at a mounted disk, else progress dies on redeploy |
| `ADMIN_USER_IDS` | Optional | Who may reach `/api/admin/*` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Optional | Cloud persistence — see [SUPABASE.md](SUPABASE.md) |

### Verify

```bash
curl https://your-backend.onrender.com/health
# {"status":"ok","uptime":12.3,"modes":0}
```

## 2. Deploy the frontend

The repo's `vercel.json` builds `frontend/` and serves it as a static SPA. Point it at the
backend with **one environment variable** in your host's dashboard:

```bash
VITE_SERVER_URL=https://your-backend.onrender.com
```

Then redeploy — Vite inlines it at build time, so **you must rebuild after changing it**.

That's all. The client resolves its backend in this order:

1. `?server=https://…` in the URL (ad-hoc testing)
2. `VITE_SERVER_URL` (build-time — use this for hosted deploys)
3. `<meta name="anaconda-server">` in `index.html` (used for the packaged Android build)
4. `localhost:4000` when running on Vite's dev port
5. Otherwise → **offline local engine**

## 3. Android / Capacitor

The packaged app can't use a build-time env var from your web host, so set the meta tag in
`frontend/index.html` before `npm run android:sync`:

```html
<meta name="anaconda-server" content="https://your-backend.onrender.com" />
```

Leave it commented out to ship an offline-only build.

---

## Troubleshooting

**`/api/*` returns 500 and `/health` returns 404 on Vercel**
: The classic symptom of a `vercel.json` that tries to host the backend on Vercel. Vercel has
  no `services` key, and a rewrite `destination` must be a string, not an object — an invalid
  destination 500s, and any path with no matching rewrite falls through to the SPA and 404s.
  Deploy the backend separately (above) and set `VITE_SERVER_URL`.

**`socket.io/?EIO=4&transport=polling` returns 500, retrying forever**
: Same cause — there is no Socket.IO server at that origin. Once `VITE_SERVER_URL` points at
  a real backend this resolves. With no backend configured the client no longer opens a
  socket at all; it goes straight to the local engine.

**Everything 401s after deploying**
: `JWT_SECRET` changed between deploys, invalidating existing tokens. The client
  re-authenticates as a guest automatically; players keep locally-cached progress. Set a
  stable `JWT_SECRET` to avoid it.

**CORS errors in the console**
: `ALLOWED_ORIGINS` on the backend must contain the frontend's exact origin, scheme included
  (`https://your-app.vercel.app`, no trailing slash).

**Progress resets after a backend redeploy**
: The file-backed store lives on ephemeral disk. Configure Supabase — see
  [SUPABASE.md](SUPABASE.md).
