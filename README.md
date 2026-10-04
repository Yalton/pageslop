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

## Browser extension

The Firefox extension in `extension/` closes idle tabs and saves them to the **To Revisit** inbox of your Pageslop instance. A tab is closed only after the server confirms it saved that URL. If the server is unreachable, nothing closes and the toolbar badge shows a red `!`.

### Connect it

1. In Pageslop, open **Settings → Browser extension**, enter a name such as "Firefox laptop" and create a token. Copy it right away: the token is shown only once. Revoke it from the same card at any time.
2. Load the extension (see below), open its **Options** page, and enter your server URL (for example `https://pageslop.example.com`) and the token.
3. Click **Test connection**. Firefox asks for permission to access your server. Grant it. You should see ✓ with your account email.
4. Set the idle hours (default 6), the maximum number of open tabs (default 25) and any domains that must never close, then enable **Auto-close idle tabs** and save. Use **Preview next sweep** to see what would close.

Pinned, active, audible and private-window tabs, kept tabs, non-http pages and your Pageslop server's own pages are never closed. To keep a tab open regardless of idle time, right-click it and tick **Keep tab (never auto-close)**. With several tabs selected, the click applies to all of them. A kept tab stays kept across browser restarts until you close it, kept tabs do not count toward the maximum, and the popup shows how many tabs are kept. Sweeps run every 5 minutes. The popup can also stash on demand, stash the current tab, pause for an hour, or exclude the current domain. Stashed items you don't act on are archived after `STASH_EXPIRE_DAYS` days (default 14). Nothing is deleted.

Version 0.2.0 adds keep tabs and asks for two new permissions on update: tab context menus, and access to recently closed tabs (Firefox's wording for the `sessions` API, which stores the keep mark).

### Development

```bash
npm run ext:run    # launches a temporary Firefox profile with the extension loaded
npm run ext:lint   # web-ext lint
npm run ext:build  # zip in web-ext-artifacts/
```

You can also load it into your normal Firefox from `about:debugging` → **This Firefox** → **Load Temporary Add-on…** by selecting `extension/manifest.json`. Temporary add-ons are removed when Firefox restarts.

### Permanent install

Release Firefox only installs signed add-ons permanently. Submit the zip from `npm run ext:build` to [addons.mozilla.org](https://addons.mozilla.org/developers/) as an **unlisted** add-on. Signing is free and automatic, and unlisted add-ons are not shown publicly. Alternatively, sign from the command line with your AMO API credentials:

```bash
npx web-ext sign --source-dir extension --channel unlisted --api-key "$AMO_JWT_ISSUER" --api-secret "$AMO_JWT_SECRET"
```

Install the signed `.xpi` it produces by opening it in Firefox.

### Self-hosting

Each Pageslop instance belongs to a single owner. The extension talks only to the server URL you configure, and it asks for host permission for that origin alone. To run your own: deploy Pageslop, create your account, then set `ALLOW_SIGNUP=false` so nobody else can sign up, and point the extension at your instance.

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
