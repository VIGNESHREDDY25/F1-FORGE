<div align="center">

# F1Forge

### The career operating system for international students on F1 / OPT

Live LinkedIn job discovery, an immigration-aware AI assistant, 3,000+ coding problems with an in-browser IDE, AI resume tailoring, alumni referral automation, and visa-deadline tracking — every job-search tool an international student needs, in one platform.

**[Live Demo →](https://f1forge.onrender.com)** &nbsp;·&nbsp; one-click demo login, no signup required

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)

</div>

---

## Why I built this

International students face a job search that generic tools ignore: OPT unemployment limits, STEM extension windows, the H1B lottery clock, prevailing-wage rules, and finding employers who actually sponsor. F1Forge brings the entire workflow into one product that understands those constraints.

## Features

| Module | What it does |
|--------|--------------|
| **Job Discovery** | Real LinkedIn jobs scraped live, filterable by posting recency (1h → 1 month), seniority, remote, and H1B sponsorship. Up to ~250 roles per search, each with company logo and an AI résumé-match score. |
| **AI Career Assistant** | A chat assistant fluent in OPT, CPT, STEM OPT, H1B, cap-gap and prevailing wage — cites regulatory sources. |
| **Practice** | The full free LeetCode catalog (3,000+ problems) browsable by topic (arrays, graphs, DP, trees, backtracking…) with a live in-browser IDE running Python, JavaScript, Java and C++. |
| **Resume Optimizer** | ATS scoring, before/after bullet rewrites, missing-keyword analysis, and a one-click **job-tailored résumé exported as .docx**. |
| **Referral & Outreach** | Generates LinkedIn searches for alumni from your school and recruiters at any company, with ready-to-send, personalized outreach messages. |
| **Application Tracker** | Kanban pipeline with a built-in AI assistant ("what are my application statuses?"). |
| **Salary Advisor** | F1-aware compensation guidance (total comp, prevailing wage, negotiation), with a CPT/OPT/H1B comp guide. |
| **Visa Compliance** | OPT/CPT countdowns, unemployment-day tracking, STEM windows, and H1B deadline alerts. |
| **H1B Companies & News** | Sponsorship data and a live immigration/tech news feed. |

## Tech stack

- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand, Framer Motion, Recharts
- **Backend** — Node.js, Express, TypeScript, JWT auth, Zod validation
- **AI** — OpenAI-compatible API (Groq / Llama 3.3) for assistant, resume, salary & tracker intelligence
- **Data sources** — LinkedIn guest jobs, JSearch, LeetCode, RSS news feeds
- **Code execution** — Wandbox / self-hostable Piston, with an in-browser JS fallback
- **Deploy** — Single service (Express serves the built SPA + API), Render blueprint included

## Getting started

```bash
# install
npm install

# configure — copy the example and fill in your keys
cp .env.example .env

# run both client (5173) and API (5001)
npm run dev
```

Open http://localhost:5173.

### Environment

Set these in `.env` (see `.env.example` for the full list):

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | AI features (free key from console.groq.com) |
| `RAPIDAPI_KEY` | Live job listings via JSearch |
| `JWT_SECRET` | Auth token signing |

The app runs without keys too — AI falls back to a curated answer bank and jobs to a curated set.

## Production build

```bash
npm run build          # builds client + server
npm start              # serves SPA + API on $PORT
```

See [DEPLOY.md](DEPLOY.md) for one-click deployment to Render.

## Project structure

```
client/   React + TypeScript SPA (pages, components, stores, API client)
server/   Express + TypeScript API (routes, services, JSON datastore)
```

## License

MIT
