# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is the maintainer: a technical self-hoster who runs Pageslop for their own daily use. A public AGPL-3.0 release for other technical self-hosters comes second; strangers running it is a welcome extra, not the design target. An instance usually has one user.

Daily use centres on two jobs:

- **Triaging To Revisit**: going through tabs the Firefox extension saved and closed, and reading, keeping or archiving each one.
- **Paste and find later**: saving a link by pasting its URL, then coming back to it through search, tags or categories.

## Product Purpose

Pageslop is a self-hosted bookmark manager that keeps the user's saved web organised without manual work. Pasting a URL is the whole job: the title, image and metadata are fetched, and tags, a description and a category are filled in automatically. Success means links get saved quickly, idle tabs stop piling up, and anything saved can be found again.

## Positioning

No single feature carries the product. Its value is the combination, in one place the user owns:

- idle tabs close themselves into a To Revisit inbox (Firefox extension);
- organising takes no effort: rule-based tagging, or the user's own LLM key;
- the saved links stay searchable by the user and by scripts and AI agents through the REST API and MCP server.

## Operating Context

- Runs as a Docker Compose stack (app, worker, PostgreSQL) on the user's own server, behind a reverse proxy with HTTPS.
- Links are saved by pasting into the dashboard or the mobile save dialog, by the Firefox extension, by importing browser bookmark HTML, or through the API.
- Many saved links are self-hosted services on the user's LAN (private IPs, homelab hostnames), which the uptime checks watch.
- Used on desktop and on a phone.

## Capabilities and Constraints

- Saving and enrichment: scraping, screenshots (Chromium in the worker), rule-based classification, and optional Anthropic API key (BYOK) for better tags and descriptions.
- Organising and finding: search across titles, tags, descriptions and URLs; tag browsing with counts; grid, list, by-category and by-site views; filters and sort; bulk select, tag, archive and delete with undo.
- To Revisit inbox fed by the Firefox extension; archive and restore.
- Uptime monitoring with a status dot per link.
- Relationship graph of links through shared tags.
- Import of browser bookmark HTML; export as JSON or HTML.
- REST API and MCP server for scripts and agents.
- Email and password auth (Better Auth) with email verification; sign-up can be closed after the first account.
- Keyboard: cards open with Enter; `/`, `n`, `j`/`k` and `?` shortcuts on the dashboard.
- Stack: Next.js 15 App Router, Drizzle ORM, pg-boss, Tailwind CSS with shadcn/ui.
- Licence: AGPL-3.0.

## Brand Commitments

- Name: Pageslop.
- The Firefox extension is being renamed away from "Tab Stash" (pageslop-06z); the new name is undecided.

## Evidence on Hand

- Screenshots of the real product: `docs/screenshots/` (dashboard, grouped, graph, detail, tags, mobile).
- API and MCP documentation: `docs/api.md`, `docs/mcp.md`.
- A demo video of the tab auto-close flow is planned but does not exist yet (pageslop-pbi).
- No users, testimonials, usage numbers or press exist. Future work must not invent any.

## Product Principles

1. **Built for one owner first.** Optimise for the maintainer's own daily use; release readiness must not add friction to it.
2. **Saving costs nothing.** One paste, or no action at all for idle tabs; organising happens without the user's work.
3. **Everything saved can be found again.** Search, tags, categories and the inbox serve retrieval, not collecting.
4. **The user owns it.** Self-hosted, own LLM key, open API and MCP access; no dependence on a hosted service.
5. **The whole is the product.** The extension, auto-organising and agent access are one system and should feel like one.
