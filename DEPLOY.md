# Deploying F1Forge to Render (free)

The app is packaged as **one service**: the Express server builds and serves the
React app *and* the API together. No separate frontend host needed.

## 1. Push to GitHub
From the repo root (`/Users/vigneshreddy/Desktop/f1-forge`):

```bash
# create an EMPTY repo on github.com first (e.g. f1forge), then:
git remote add origin https://github.com/<your-username>/f1forge.git
git push -u origin main
```

Secrets are safe: `.env` and the runtime datastore are gitignored — nothing
sensitive is pushed. All API keys live only in Render's dashboard.

## 2. Deploy on Render
1. Go to https://render.com → sign in (free) → **New +** → **Blueprint**.
2. Connect your GitHub and pick the `f1forge` repo. Render reads `render.yaml`
   and configures the web service automatically.
3. When prompted, set the two secret env vars:
   - **`GROQ_API_KEY`** — your free key from https://console.groq.com (powers AI Assistant, Resume, Salary, Tracker chatbots).
   - **`RAPIDAPI_KEY`** — your JSearch key (so real jobs show even when LinkedIn blocks the cloud IP).
   (`NODE_ENV`, `AI_PROVIDER=groq`, and a generated `JWT_SECRET` are set for you.)
4. Click **Apply**. First build takes ~3–5 min (`npm install --include=dev && npm run build`).
5. You'll get a URL like `https://f1forge.onrender.com`. Update the `CLIENT_URL`
   env var to that exact URL (Settings → Environment) and save.

That URL is what you put on LinkedIn. New users register their own accounts.

## 3. Things to know about the free deploy
- **Jobs in the cloud:** LinkedIn often blocks datacenter IPs. The app tries
  LinkedIn first, then automatically falls back to **JSearch** (your RapidAPI
  key) so the deployed feed always shows real jobs. JSearch's free tier is
  ~200 req/month — results are cached 20 min to stretch it.
- **Cold starts:** Render's free tier sleeps after ~15 min idle; the first hit
  after sleeping takes ~30–50s to wake. Fine for a portfolio link.
- **Data persistence:** the JSON datastore is ephemeral on Render (resets on
  redeploy/restart) and re-seeds demo data on boot. For permanent user data,
  add a Render Persistent Disk (paid) or wire the Postgres schema (already in
  `server/src/db/schema.sql`) — not required for launch.
- **Code execution (Practice IDE):** runs via the public Wandbox API + in-browser
  JS — no setup. For unlimited/all-language, set `PISTON_URL` to a self-hosted
  Piston (see `docker-compose.yml`).

## Enabling "Continue with Google" (optional)
The Google button only appears when OAuth credentials are configured; without
them it stays hidden (email/password login always works). To enable it:

1. Go to https://console.cloud.google.com → create a project →
   **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
   - Authorized redirect URI: `https://f1forge.onrender.com/api/auth/google/callback`
3. In Render → your service → **Environment**, add:
   - `GOOGLE_CLIENT_ID` — from the OAuth client
   - `GOOGLE_CLIENT_SECRET` — from the OAuth client
   - `GOOGLE_CALLBACK_URL` — `https://f1forge.onrender.com/api/auth/google/callback`
4. Save — Render redeploys and the button appears automatically.

## Local production test (optional)
```bash
npm run build
PORT=5077 NODE_ENV=production npm start
# open http://localhost:5077
```
