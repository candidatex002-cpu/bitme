# 📱 Anaconda Park — Android / Google Play packaging

The game is a web app (Vite + Canvas). We ship it to the Play Store as a native
Android shell using **Capacitor** — the web build runs inside a WebView, so one
codebase serves web *and* mobile.

> The packaged app is fully playable **offline** via the built-in local simulation
> engine (bots, moving stars, wormholes, obstacles, wrap-around world). For real
> online multiplayer, point it at a hosted backend (see step 5).

## Prerequisites (on your machine — one time)

- **Node 18+** and npm
- **Android Studio** (Giraffe or newer) with the Android SDK + a device/emulator
- **JDK 17** (bundled with recent Android Studio)

## Build & open the Android project

```bash
# from the repo root
npm install                 # pulls in @capacitor/core, cli, android
npm run android:sync        # builds the frontend AND copies it into the native project
npm run android:init        # FIRST TIME ONLY — creates the ./android project
npm run android:sync        # run again so the fresh build is synced in
npm run android:open        # opens the project in Android Studio
```

`capacitor.config.json` (repo root) already sets:
- `appId`: `com.myheroarc.anacondapark`  ← change to your own reverse-domain id
- `appName`: `Anaconda Park`
- `webDir`: `frontend/dist`

## Run on a device / emulator

In Android Studio press ▶ **Run**, or from the CLI: `npx cap run android`.

## 5. Point the app at your backend (optional — for online multiplayer)

Edit `frontend/index.html` and uncomment / set:

```html
<meta name="anaconda-server" content="https://your-backend.example.com" />
```

Then `npm run android:sync` again. Without it, `serverBase()` returns empty on the
`capacitor://` origin and the app automatically falls back to the offline engine.

Host the backend (`backend/`) anywhere that supports WebSockets (Render, Railway,
Fly.io, a VPS…). Note: Vercel serverless does **not** hold a persistent Socket.IO
process — that's exactly why the local engine fallback exists for the web build.

## 6. Build a signed release (AAB for the Play Store)

1. In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**.
2. Create (or reuse) an **upload keystore** — keep the `.jks` file and passwords safe;
   losing them means you can't update the app.
3. Choose the **release** build variant → produces `app-release.aab`.
4. Upload the `.aab` in the [Play Console](https://play.google.com/console) under a new app.

### Play Console checklist before submitting
- App icon + feature graphic + screenshots (phone & tablet)
- Privacy policy URL (required — the app stores profile/progress locally and, if you
  enable ads/analytics, discloses that in the Data Safety form)
- Content rating questionnaire
- Target audience & ads declaration (see AdMob note below)
- Target API level meeting Google's current minimum

## AdMob (see sprint §14)

Monetization integration points exist in the app UI (rewarded-ad respawn, interstitial
hooks). To go live you must add the **Google Mobile Ads** Capacitor/Cordova plugin and
your **real AdMob app id + ad-unit ids**, then declare ads in the Play Console. No live
ad ids ship in this repo.
