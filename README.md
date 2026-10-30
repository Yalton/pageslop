# Pageslop

A self-hosted bookmark manager that classifies, tags, describes and organizes saved links for you. Paste a URL and Pageslop does the rest: no folders to create, no tags to type.

![All links in the card grid, with images, categories and tags filled in automatically](docs/screenshots/dashboard.png)

## Features

- **Instant save**: paste a URL; title, image and metadata are fetched automatically
- **Auto-classification**: rule-based tags, descriptions and categories with no effort from you
- **Bring your own LLM key**: add an Anthropic API key for better AI-generated tags and descriptions
- **Search and filter** across titles, tags, descriptions and URLs
- **Tag browsing** with counts, and a **grouped view** by category
- **Uptime monitoring**: scheduled health checks with a status dot per link
- **Relationship graph**: a force-directed view of how bookmarks connect through shared tags
- **Import and export**: import browser bookmark HTML files, export as JSON or HTML
- **Browser extension** (Firefox) that saves idle tabs to a "To Revisit" inbox and closes them
- **REST API and MCP server** for scripts and AI agents ([docs/api.md](docs/api.md), [docs/mcp.md](docs/mcp.md))

## Screenshots

| Grouped by category | Relationship graph |
| --- | --- |
| ![Links grouped into collapsible category sections](docs/screenshots/grouped.png) | ![Force-directed graph linking bookmarks through shared tags](docs/screenshots/graph.png) |

| Link details | Tags |
| --- | --- |
| ![Link detail panel with description, category, uptime check and editable tags](docs/screenshots/detail.png) | ![Tag overview with link counts](docs/screenshots/tags.png) |

<p align="center"><img src="docs/screenshots/mobile.png" alt="Pageslop on a phone, links grouped by category" width="300"></p>

## Tech stack

Next.js 15 (App Router), PostgreSQL 16 with Drizzle ORM, Better Auth (email and password), pg-boss for background jobs, Puppeteer/Chromium for screenshots, Tailwind CSS with shadcn/ui, and Docker Compose for deployment.

## Self-hosting with Docker

You need Docker with the Compose plugin, `openssl`, and about 2 GB of free RAM (the worker runs Chromium).

```bash
git clone https://github.com/Yalton/pageslop.git
cd pageslop
./scripts/setup.sh                 # or: ./scripts/setup.sh https://links.example.com
docker compose up -d --build
```

`scripts/setup.sh` writes `.env` and `.env.db` with fresh random secrets and never overwrites existing files. The first start builds the images and creates the database schema, which takes a few minutes.

Open <http://localhost:3847> and sign up. If you have not configured SMTP, the verification link is printed in the app log:

```bash
docker compose logs app | grep '\[email\]'
```

Once your account exists, consider closing registration: set `ALLOW_SIGNUP=false` and `NEXT_PUBLIC_ALLOW_SIGNUP=false` in `.env`, then run `docker compose up -d --build`.

### Running on a server

The app is published on `127.0.0.1:3847` by default, so it is reachable only from the host itself. Put a reverse proxy with HTTPS in front of it (Caddy, nginx, Traefik, Cloudflare Tunnel), and set `BETTER_AUTH_URL` in `.env` to the public URL, for example `https://links.example.com`.

Sign-in needs HTTPS. The session cookie is marked `Secure`, which browsers accept over plain HTTP only on `localhost`. To reach the app directly on another interface, set `PAGESLOP_BIND` (and optionally `PAGESLOP_PORT`) in `.env`.

Auth rate limiting keys on the client IP, read from `TRUSTED_IP_HEADER` (default `x-forwarded-for`). Set it to the header your proxy writes, for example `cf-connecting-ip` behind Cloudflare. If you expose the app port without a proxy that overwrites that header, set `TRUSTED_IP_HEADER=none`; otherwise clients can send a fake IP and get around the sign-in rate limit.

A minimal Caddyfile:

```
links.example.com {
    reverse_proxy 127.0.0.1:3847
}
```

### Services

| Service  | Port                        | Description                                         |
| -------- | --------------------------- | --------------------------------------------------- |
| `app`    | 3847 on `127.0.0.1`         | Next.js web server; applies the schema on start     |
| `worker` | none                        | Background jobs: scraping, enrichment, monitoring, import |
| `db`     | none (compose network only) | PostgreSQL 16, data in `./data/postgres`            |

The worker runs Chromium inside its sandbox, using the seccomp profile in `chromium-seccomp.json`.

### Updating

```bash
git pull
docker compose up -d --build
```

Schema changes are applied automatically when the app container starts.

### Backups

All state lives in PostgreSQL plus the `screenshots` volume. To dump the database:

```bash
docker compose exec db pg_dump -U pageslop pageslop > pageslop-$(date +%F).sql
```

## Configuration

Settings live in `.env` (read by the app and worker) and `.env.db` (read only by the database). See [.env.example](.env.example) and [.env.db.example](.env.db.example) for comments on every value.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_URL_DIRECT` | Direct PostgreSQL connection (for pg-boss LISTEN/NOTIFY) |
| `BETTER_AUTH_URL` | Public URL of the app, for example `https://links.example.com` |
| `BETTER_AUTH_SECRET` | Session signing secret, at least 32 random characters (`openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | 64 hex characters for encrypting stored API keys (`openssl rand -hex 32`) |
| `TRUSTED_IP_HEADER` | Header(s) holding the client IP for auth rate limiting, comma-separated (e.g. `cf-connecting-ip`, `x-real-ip`). Default `x-forwarded-for`. `none` trusts no header (use it when the port is exposed without a proxy). Set `TRUSTED_PROXIES` to your proxy IPs/CIDRs to resolve a multi-hop `x-forwarded-for` chain |
| `PAGESLOP_BIND` | Address Docker Compose publishes the app on. Default `127.0.0.1` |
| `PAGESLOP_PORT` | Host port for the app. Default `3847` |
| `SMTP_HOST` | SMTP server. Leave empty to write emails to the app log instead of sending them |
| `SMTP_PORT` | SMTP port. Default `465` |
| `SMTP_SECURE` | `true` for implicit TLS, `false` for STARTTLS. Default: `true` on port 465 |
| `SMTP_USER` | SMTP login |
| `SMTP_PASS` | SMTP password or app password |
| `SMTP_FROM` | Sender, for example `Pageslop <noreply@example.com>` |
| `ALLOW_SIGNUP` | `false` disables new account sign-up server-side. Default `true` |
| `NEXT_PUBLIC_ALLOW_SIGNUP` | `false` hides sign-up links in the UI. Inlined at build time, so rebuild after changing. Default `true` |
| `CONTACT_EMAIL` | Contact address shown on the privacy and terms pages |
| `NEXT_PUBLIC_EXTENSION_DOCS_URL` | Where the settings page links for extension setup. Defaults to this README |
| `STASH_EXPIRE_DAYS` | Days before stashed links in the inbox or read state are auto-archived (never deleted). Default `14` |

The privacy and terms pages under `src/app/(legal)/` are a starting point written for a small hosted instance. If you run Pageslop for other people, review them for your situation.

## Development

Requires Node.js 22 and PostgreSQL 16.

```bash
npm ci

# A throwaway database, if you don't have one
docker run -d --name pageslop-dev-db -p 127.0.0.1:5432:5432 \
  -e POSTGRES_USER=pageslop -e POSTGRES_PASSWORD=pageslop -e POSTGRES_DB=pageslop postgres:16-alpine

cp .env.example .env
# In .env: point both DATABASE_URL lines at
# postgresql://pageslop:pageslop@localhost:5432/pageslop, set BETTER_AUTH_URL=http://localhost:3000,
# and fill in BETTER_AUTH_SECRET and ENCRYPTION_KEY.

npm run db:migrate    # create the schema
npm run dev           # web app on http://localhost:3000
npm run worker        # background worker, in a second terminal
```

Checks:

```bash
npx tsc --noEmit
npm test
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Browser extension

The Firefox extension in `extension/` closes idle tabs and saves them to the **To Revisit** inbox of your Pageslop instance. A tab is closed only after the server confirms it saved that URL. If the server is unreachable, nothing closes and the toolbar badge shows a red `!`.

### Connect it

1. In Pageslop, open **Settings → Browser extension**, enter a name such as "Firefox laptop" and create a token. Copy it right away: the token is shown only once. Revoke it from the same card at any time.
2. Load the extension (see below), open its **Options** page, and enter your server URL (for example `https://links.example.com`) and the token.
3. Click **Test connection**. Firefox asks for permission to access your server. Grant it. You should see ✓ with your account email.
4. Set the idle hours (default 6), the maximum number of open tabs (default 25) and any domains that must never close, then enable **Auto-close idle tabs** and save. Use **Preview next sweep** to see what would close.

Pinned, active, audible and private-window tabs, kept tabs, non-http pages and your Pageslop server's own pages are never closed. To keep a tab open regardless of idle time, right-click it and tick **Keep tab (never auto-close)**. With several tabs selected, the click applies to all of them. A kept tab stays kept across browser restarts, and so does a duplicated tab or a closed tab you reopen. The extension also remembers kept pages by URL, so a tab reopened by a session manager add-on is kept again, and any other tab on the same page counts as kept. Untick the box to forget a page. A kept page that no open tab has shown for 30 days is forgotten. Kept tabs do not count toward the maximum.

Sweeps run every 5 minutes. The popup can also stash on demand, stash the current tab, pause for an hour, or exclude the current domain. Stashed items you don't act on are archived after `STASH_EXPIRE_DAYS` days (default 14). Nothing is deleted. On Firefox for Android the extension needs version 142 or later.

The extension talks only to the server URL you configure, and asks for host permission for that origin alone.

### Load it for development

```bash
npm run ext:run    # launches a temporary Firefox profile with the extension loaded
npm run ext:lint   # web-ext lint
npm run ext:build  # zip in web-ext-artifacts/
```

You can also load it into your normal Firefox from `about:debugging` → **This Firefox** → **Load Temporary Add-on…** by selecting `extension/manifest.json`. Temporary add-ons are removed when Firefox restarts.

### Install it permanently

Release Firefox only installs signed add-ons permanently. Signing is free on [addons.mozilla.org](https://addons.mozilla.org/developers/) as an **unlisted** add-on, which is not shown publicly. Add-on IDs are unique on AMO, so first change `browser_specific_settings.gecko.id` in `extension/manifest.json` to an ID of your own, such as `tab-stash@yourdomain.com`. Then either upload the zip from `npm run ext:build`, or sign from the command line with your AMO API credentials:

```bash
npx web-ext sign --source-dir extension --channel unlisted --api-key "$AMO_JWT_ISSUER" --api-secret "$AMO_JWT_SECRET"
```

Install the signed `.xpi` it produces by opening it in Firefox.

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
       ┌──────▼──────┐ ┌───▼───┐ ┌──────▼──────┐
       │ PostgreSQL  │ │pg-boss│ │  Anthropic  │
       │   (data)    │ │(queue)│ │  API (BYOK) │
       └─────────────┘ └───┬───┘ └─────────────┘
                           │
                    ┌──────▼──────┐
                    │   Worker    │ ← scrape, enrich,
                    │             │   monitor, import
                    └─────────────┘
```

The worker fetches pages that users save. All of its outbound requests, including Chromium's, go through an SSRF guard that refuses private, loopback, link-local and cloud metadata addresses (`src/lib/net/`).

## Security

Please report vulnerabilities privately; see [SECURITY.md](SECURITY.md).

## License

Pageslop is free software under the [GNU Affero General Public License v3.0](LICENSE). If you run a modified version as a network service, the AGPL requires you to offer its source code to the people who use it.
