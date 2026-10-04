# Pageslop

An intelligent bookmark manager that automatically classifies, tags, describes, and organizes saved links. Paste a URL and Pageslop does the rest — no folders to create, no tags to type, no management overhead.

## Features

- **Instant save** — Paste a URL, get title, image, and metadata fetched automatically
- **Auto-classification** — Rule-based tag generation, descriptions, and category assignment with no user effort
- **BYOK LLM** — Bring your own Anthropic API key for higher-quality AI-powered tags and descriptions
- **Search & filter** — Client-side full-text search across titles, tags, descriptions, and URLs
- **Tag browsing** — Browse all tags with counts, click to filter
- **Grouped view** — View links clustered by category with collapsible sections
- **Uptime monitoring** — Scheduled health checks with green/red/gray status dots per link
- **Relational graph** — Force-directed visualization showing how bookmarks connect through shared tags
- **Import/export** — Import browser bookmark HTML files, export as JSON or HTML
- **Email verification** — Secure signup with email verification via Zoho SMTP
- **Password reset** — Forgot password flow with email reset links

## Tech Stack

- **Framework:** Next.js 15 (App Router, standalone output)
- **Database:** PostgreSQL 16 with Drizzle ORM
- **Auth:** Better Auth (email/password, email verification)
- **Queue:** pg-boss for async scraping, enrichment, and monitoring jobs
- **LLM:** Anthropic Claude API (optional, BYOK)
- **UI:** Tailwind CSS, shadcn/ui, Radix primitives
- **Graph:** react-force-graph-2d (Canvas 2D rendering)
- **Email:** Nodemailer with Zoho SMTP
- **Deployment:** Docker Compose (app + worker + postgres)

## Quick Start

### Docker (recommended)

```bash
cp .env.example .env
# Edit .env with your credentials
docker compose up -d
```

The app auto-pushes the database schema on first startup. Access at `http://localhost:3847`.

### Development

```bash
npm install
cp .env.example .env
# Edit .env — set DATABASE_URL to a local Postgres instance

# Push schema
npx drizzle-kit push

# Start dev server
npm run dev

# Start worker (separate terminal, requires Node 20+)
node --env-file=.env --import tsx src/workers/scrape.worker.ts
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_URL_DIRECT` | Direct PostgreSQL connection (for pg-boss LISTEN/NOTIFY) |
| `BETTER_AUTH_SECRET` | Random 32+ character secret for session signing |
| `BETTER_AUTH_URL` | Public URL of the app (e.g., `https://pageslop.citreum.com`) |
| `ENCRYPTION_KEY` | 64-character hex string for AES-256-GCM API key encryption |
| `SMTP_HOST` | SMTP server hostname (default: `smtp.zoho.com`) |
| `SMTP_PORT` | SMTP port (default: `465`) |
| `SMTP_USER` | SMTP login email |
| `SMTP_PASS` | SMTP password or app-specific password |
| `SMTP_FROM` | Sender display (e.g., `Pageslop <noreply@yourdomain.com>`) |
| `ALLOW_SIGNUP` | `false` disables new account sign-up server-side. Default `true` |
| `NEXT_PUBLIC_ALLOW_SIGNUP` | `false` hides sign-up links in the UI. Inlined at build time, so rebuild after changing. Default `true` |
| `STASH_EXPIRE_DAYS` | Days before stashed links in the inbox or read state are auto-archived (never deleted). Default `14` |

## Architecture

```
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Next.js   │ ← API routes + SSR
                    │   (app)     │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌──▼───┐ ┌──────▼──────┐
       │  PostgreSQL  │ │pg-boss│ │   Anthropic  │
       │   (data)     │ │(queue)│ │   API (BYOK) │
       └─────────────┘ └──┬───┘ └─────────────┘
                           │
                    ┌──────▼──────┐
                    │   Worker    │ ← scrape, enrich,
                    │             │   monitor, import
                    └─────────────┘
```

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| `app` | 3847 | Next.js web server |
| `worker` | — | Background job processor (scrape, enrich, monitor) |
| `db` | 5433 | PostgreSQL 16 |

## License

Proprietary. All rights reserved.
