# Security Policy

## API Keys & Secrets

F1Forge follows strict secrets hygiene for a public repository:

| Secret | Location | Committed to git? |
|--------|----------|-------------------|
| `.env` | Project root | **No** — in `.gitignore` |
| OpenAI API Key | `.env` → `OPENAI_API_KEY` | **No** |
| RapidAPI Key | `.env` → `RAPIDAPI_KEY` | **No** |
| JWT Secret | `.env` → `JWT_SECRET` | **No** |

**The `.env` file is never committed.** Only `.env.example` (with placeholder values) is tracked.

## How to Run Locally

1. Copy the template: `cp .env.example .env`
2. Fill in your actual API keys in `.env`
3. Your keys stay local — they are never pushed to GitHub

## Adding Your OpenAI Key

```bash
# In your .env file:
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

**Where to get it:** https://platform.openai.com/api-keys

Once added, restart the server — the AI Assistant will switch from fallback mode to full GPT-4o responses.

## Adding Your RapidAPI Key (for live job listings)

```bash
# In your .env file:
RAPIDAPI_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Steps:**
1. Sign up free at https://rapidapi.com
2. Search for "JSearch" and subscribe (free: 500 requests/month)
3. Copy your API key from the dashboard

Once added, Job Discovery will pull real-time listings from LinkedIn, Indeed, and Glassdoor.

## Deployment Security Checklist

When deploying to production (Vercel, Render, Railway, AWS, etc.):

- [ ] Set environment variables in your hosting platform's dashboard — never in code
- [ ] Rotate `JWT_SECRET` to a fresh 64-char random hex: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- [ ] Set `NODE_ENV=production` 
- [ ] Set `CLIENT_URL` to your actual frontend domain
- [ ] Enable HTTPS only
- [ ] Never expose backend port directly — put it behind a reverse proxy (nginx/Vercel)

## Reporting a Vulnerability

If you discover a security issue, please open a GitHub Issue marked **[SECURITY]** or email directly. Do not post exploit details publicly.
