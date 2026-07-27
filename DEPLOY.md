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

Any host that runs a Node process. Example — **Render**:

- **Root directory:** `backend`
- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Health check path:** `/health`

Environment variables:

```bash
PORT=4000                                  # most hosts inject this automatically
ALLOWED_ORIGINS=https://your-frontend.vercel.app   # comma-separated; REQUIRED in production
ADMIN_USER_IDS=usr_your_admin_id           # who may reach /api/admin/*
JWT_SECRET=<a long random string>          # set this — do not ship the default
```

> **`ALLOWED_ORIGINS` matters.** Left unset, CORS falls open to `*` for local dev
> convenience. Always set it in production.

For data that survives redeploys and works across multiple instances, also set the Supabase
variables — see **[SUPABASE.md](SUPABASE.md)**. Without them the backend uses a local file
store, which most PaaS hosts wipe on every deploy.

Verify it's up:

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
