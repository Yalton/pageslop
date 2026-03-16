# Project Research Summary

**Project:** Pageslop — Intelligent Bookmark Manager
**Domain:** Full-stack web app with async scraping pipeline, hybrid AI/rule classification, graph visualization, and uptime monitoring
**Researched:** 2026-03-16
**Confidence:** MEDIUM-HIGH (features HIGH, architecture HIGH, stack MEDIUM-HIGH, pitfalls MEDIUM)

## Executive Summary

Pageslop is an intelligent bookmark manager that competes in a space recently vacated by Pocket (shut down July 2025), with differentiation through zero-folder auto-classification, a relational graph view connecting bookmarks by shared tags, and BYOK LLM support that keeps hosting costs at zero. Building this correctly means designing around async enrichment from day one: users save a URL and get an immediate response; all scraping, classification, and uptime monitoring happen in background workers via a job queue. The architecture is not a simple CRUD app — it is a lightweight data pipeline with a web front-end on top.

The recommended approach is a Next.js 15 + PostgreSQL + pg-boss stack (no Redis needed) deployed with a split target: Vercel or Cloudflare Pages for the web app, and a persistent worker service (Render paid tier or Railway) for background jobs. Classification is two-tier: a rule-based engine using `compromise` and `keyword-extractor` runs for every user for free; an optional BYOK LLM path replaces the heuristics for users who supply their own OpenAI or Anthropic key. The graph view is derived via a PostgreSQL JOIN on shared tags — no graph database needed at bookmark-manager scale.

The three most dangerous risks are: (1) syncing the save action to scraping, which destroys UX and must be async from the first line of code; (2) using SVG-based D3 for the graph, which freezes at ~1,000 nodes and requires a full rewrite to Canvas/WebGL if chosen; and (3) storing BYOK API keys in plain text, which is a billing-fraud risk. All three are "hard to retrofit" failures — they must be designed correctly from Phase 1.

## Key Findings

### Recommended Stack

The stack is built around Next.js 15 (App Router, Server Actions) with React 19, TypeScript, Tailwind CSS 4, and shadcn/ui components. For persistence, PostgreSQL 16 via Neon (serverless Postgres) with Drizzle ORM is the recommended combination — it handles relational data, full-text search (GIN + tsvector), and the job queue (via pg-boss's SKIP LOCKED pattern) in a single service, avoiding Redis entirely. Authentication is handled by Better Auth 1.5.x, which replaced the deprecated Lucia Auth (March 2025) as the community-recommended email/password solution for Next.js App Router.

The content extraction pipeline pairs `@mozilla/readability` (highest extraction accuracy, 642 npm dependents) with jsdom for server-side DOM emulation, and Cheerio as a fast fallback for metadata-only pages. Classification runs on `compromise` (NLP, 240KB, no native deps) and `keyword-extractor` (TF-IDF scoring). Graph visualization uses `react-force-graph` (WebGL-backed, handles thousands of nodes). Biome replaces ESLint + Prettier.

**Core technologies:**
- **Next.js 15 + React 19**: Full-stack framework — App Router + Server Actions cover the API surface without a separate backend; v15 is the stable LTS choice over the still-maturing v16
- **PostgreSQL 16 (Neon)**: Primary store — handles relational data, FTS via tsvector + GIN, and job queue via SKIP LOCKED; Neon's serverless billing and Vercel integration are ideal for a free-to-host project
- **Drizzle ORM 0.45.x**: SQL-first, TypeScript-native, ~7.4KB bundle with no cold-start penalty on serverless
- **Better Auth 1.5.x**: Email/password auth with scrypt hashing and OWASP compliance; Lucia is deprecated, Auth.js v5 is OAuth-optimized and heavier than needed
- **pg-boss**: PostgreSQL-backed job queue — eliminates Redis; exactly-once delivery with transactional guarantees covers scraping, classification, and uptime monitoring
- **@mozilla/readability + jsdom + Cheerio**: Two-tier content extraction; Readability for article body, Cheerio for OG metadata fallback
- **compromise + keyword-extractor**: Rule-based NLP classification; ~240KB total, no model downloads, runs server-side
- **react-force-graph 1.48.x**: WebGL-rendered force-directed graph; handles thousands of nodes with built-in React API

### Expected Features

The Pocket shutdown in July 2025 created a large migration market. Users expect the complete bookmark table stakes from day one, and the research is confident about what differentiates Pageslop: graph view (no competitor has it), auto-description (only AI-gated competitors have it), and free uptime monitoring (competitors charge for dead-link detection).

**Must have (table stakes):**
- Save link + auto-fetch title/OG image — core primitive; missing it is a non-starter
- Tag-based organization with autocomplete — users think in tags, not folders
- Full-text search across title, tags, description, URL — retrieval is as critical as saving
- Browser extension (Chrome + Firefox) — paste-into-web-app friction is deal-breaking
- Import from browser bookmarks (HTML) — users have years of existing bookmarks
- Export to JSON/HTML — no export = no trust
- Duplicate detection on save — basic hygiene
- Authentication / per-user data isolation — links are private

**Should have (competitive differentiators):**
- Rule-based auto-tagging and classification — works for everyone, no LLM key required
- Auto-generated description from page content — answers "why did I save this?"
- Grouped/clustered view by classification — navigable without folders (core positioning)
- Uptime indicator (green/red dot) — live status; rare in bookmark managers, free for users
- BYOK LLM key setting — enhanced classification/description for power users
- Relational graph view (v1.x, after classification is stable) — no competitor has this

**Defer (v2+):**
- REST API for link submission — power user automation; post-launch trigger
- Bookmarklet — fallback for non-Chrome/Firefox users; add when requested
- Advanced uptime history + alerts — significant infra; v1 status dot covers 80% of need
- Mobile PWA optimizations — post-launch; responsive web covers mobile use cases
- Collaborative/shared collections — fundamentally different product; single-user v1

**Confirmed anti-features to avoid:** Manual folder hierarchy, read-it-later/reader mode, social sharing, offline-first, real-time collaboration.

### Architecture Approach

Pageslop follows an async enrichment pipeline architecture: the API accepts a URL and returns 202 immediately after inserting a `status: pending` link record; a job queue (pg-boss) dispatches scraping and classification to background workers running in a separate persistent process. The data layer is entirely PostgreSQL — no graph database (edges derived via tag co-occurrence JOIN), no Redis (pg-boss uses SKIP LOCKED), no separate search service (PostgreSQL FTS with GIN index). The graph is computed relationally, not stored structurally, which is appropriate for bookmark-manager scale (tens of thousands of links per user) and avoids operational complexity.

**Major components:**
1. **Next.js App Router (API + Web UI)** — link ingestion, search, auth enforcement, graph data serving; all routes scoped by `userId` from session
2. **pg-boss job queue on PostgreSQL** — async decoupling between API writes and background enrichment; handles scraping, classification, and uptime ping jobs with transactional guarantees
3. **Scrape Worker** — two-tier: Cheerio fast path (90% of pages, ~100ms, ~5MB RAM); Playwright fallback for JS-heavy SPAs (expensive, triggered only when Cheerio returns empty content)
4. **Classifier Worker** — rule engine always runs (compromise NLP + keyword-extractor); BYOK LLM is an additive second pass when user has a key configured
5. **Monitor Worker** — scheduled pg-boss repeatable jobs per link; HTTP HEAD pings; writes latest `is_up` status only (no history in v1)
6. **PostgreSQL (Neon)** — single data store: links, tags, link_tags, users, uptime_status, raw_content (separate table from links to avoid bloating list queries); FTS via tsvector generated column + GIN index
7. **react-force-graph (WebGL)** — client-side graph rendering; nodes = links, edges = shared tags derived on-query from PostgreSQL JOIN

### Critical Pitfalls

1. **Blocking the save action on scraping** — Scraping takes 2–30 seconds. If the POST /api/links handler waits for scraping before returning, the save feels broken and serverless platforms (Vercel 10s limit) will time out. Fix: insert immediately with `status: pending`, enqueue scrape job, return 202. This pattern must be the starting architecture — it is expensive to retrofit.

2. **SVG-based force graph** — D3 SVG graphs freeze at ~1,000 nodes (one DOM element per node/edge). At 5,000+ nodes a power user's tab will crash. The renderer choice is architectural: use Canvas/WebGL (`react-force-graph` wraps three.js). Do not build SVG-based and plan to optimize later.

3. **Plain-text BYOK API key storage** — Storing user LLM API keys in plain text creates billing-fraud risk if the database is compromised. Keys must be AES-256 encrypted at rest, masked in API responses, and stripped from logs. This decision must be made before any BYOK UI is built.

4. **Classification taxonomy lock-in** — Hardcoding tags as a database `ENUM` makes it impossible to add user tags, and creates divergence between rule-based and LLM-generated tag formats. Use flexible string-based tags with a `source` field (`rule`, `llm`, `user`) and a normalization layer from schema design.

5. **Free hosting platform incompatibility** — Vercel cannot run persistent background workers (serverless functions time out; no persistent process). Uptime monitoring and the scrape/classify worker queue require a persistent process. Deploy the worker on Render (paid, $7/mo) or Railway from the start — not as a later migration.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Auth, DB Schema, Async Save Core

**Rationale:** Everything else depends on the user/link data model and the async enrichment pattern. This phase contains the two most expensive-to-retrofit decisions: database schema (tag flexibility, FTS index, raw_content separation) and the async save flow (202 pattern, pg-boss queue setup). Getting these wrong requires restructuring all downstream work.

**Delivers:** User registration/login, paste-URL-and-save with immediate response, link stored as `pending`, basic list view with pending state indicator, deployment split (Vercel + persistent worker host)

**Addresses:** Authentication, save a link, duplicate detection (exact URL match on insert)

**Avoids:**
- Pitfall: Blocking save on scraping (async-first from line 1)
- Pitfall: Classification taxonomy lock-in (flexible string tags, source field, GIN index in schema)
- Pitfall: FTS performance (tsvector generated column + GIN index in initial migration)
- Pitfall: Free hosting + persistent worker mismatch (infrastructure split decided here)
- Pitfall: Missing user_id filter on queries (Drizzle query patterns scoped to userId from the start)

**Research flag:** Standard patterns — no additional research needed for auth, Drizzle schema, or Next.js App Router setup.

---

### Phase 2: Content Enrichment Pipeline — Scraping + Rule-Based Classification

**Rationale:** Scraping and classification are the core product value and must be built before the UI can show meaningful data. The two-tier scraper (Cheerio fast path, Playwright slow path) must be designed together — not Cheerio first with Playwright bolted on. Rule-based classification runs independently of any LLM key and defines the tag vocabulary.

**Delivers:** Background scraping of saved links (title, OG image, body text), rule-based auto-tagging, auto-generated description (first meaningful sentence / meta description), link card with title/description/tags showing after enrichment, `status: ready` state

**Addresses:** Auto-fetch title, auto-generated description, rule-based auto-tagging, visual thumbnail/card view

**Uses:** pg-boss (scrape + classify queues), @mozilla/readability + jsdom, Cheerio, compromise, keyword-extractor, Playwright (slow-path fallback)

**Avoids:**
- Pitfall: SPA scraping failure (two-tier scraper designed from the start, not retrofitted)
- Pitfall: AI over-reliance (rule engine always runs; AI is additive; all AI fields editable)
- Pitfall: No scrape timeout (hard timeout: 5s fast path, 30s headless; circuit breaker for repeat-failing domains)
- Pitfall: Full page content in links table (raw_content stored in separate table)
- Anti-pattern: Using Playwright for everything (default to Cheerio, Playwright only on empty content)

**Research flag:** May benefit from a research-phase pass on the two-tier scraper design patterns and Playwright browser pool management if the team hasn't built scraping pipelines before.

---

### Phase 3: Search, List View, Import/Export

**Rationale:** With classified links in the database, search and organized browsing become valuable. Full-text search relies on the GIN index already in the schema from Phase 1 — it's mostly a query and UI task here. Import/export are low-complexity but high-trust features that convert existing users.

**Delivers:** Full-text search (PostgreSQL FTS), grouped/clustered list view by classification category, paginated link list with virtual scroll, import from browser bookmarks (HTML), export to JSON + HTML

**Addresses:** Full-text search, grouped/clustered view, import, export, unbounded scale handling (pagination/virtual scroll from Phase 3, not bolted on at Phase 5)

**Uses:** PostgreSQL `plainto_tsquery`, `ts_rank`, TanStack Query (client-side search state), virtual list component

**Avoids:**
- Pitfall: Full-table ILIKE search (FTS index already in schema; this phase writes the query)
- Pitfall: Loading all bookmarks at once (pagination designed here, before graph)
- Anti-feature: Read-it-later mode (explicitly out of scope)

**Research flag:** Standard patterns — PostgreSQL FTS is well-documented; no research-phase needed.

---

### Phase 4: Uptime Monitoring

**Rationale:** Uptime monitoring is independent of the classification system (it only needs links to exist) and shares the pg-boss queue infrastructure already built in Phase 2. It is a clear v1 differentiator (competitors charge for this) and relatively low complexity if the job queue architecture is correct.

**Delivers:** Green/red uptime dot per link card, scheduled HTTP HEAD pings per link, pg-boss repeatable jobs at configurable interval, last-checked timestamp display

**Addresses:** Broken/dead link detection (uptime monitoring)

**Uses:** pg-boss repeatable jobs, HTTP HEAD with 5s timeout, uptime_status table (latest status only)

**Avoids:**
- Pitfall: Uptime monitoring consuming disproportionate infrastructure (pg-boss concurrency limits, jitter, per-user monitor cap, deduplication of shared URLs)
- Pitfall: Serverless-only deployment (persistent worker already established in Phase 1)
- Anti-feature: Uptime history + alerts (status dot only in v1)

**Research flag:** Standard patterns for job queue scheduling. No research-phase needed.

---

### Phase 5: Browser Extension + BYOK LLM

**Rationale:** Browser extension requires a stable API (available after Phase 1) and stable classification (Phase 2). BYOK LLM requires the classifier to be solid so the LLM enhancement is genuinely additive. Grouping these together reduces context-switching: both involve external integrations with security implications (MV3 CORS, API key handling).

**Delivers:** Chrome + Firefox Manifest V3 browser extension (one-click save, pre-filled URL), BYOK LLM key settings UI (encrypted storage, masked display, format validation), LLM-enhanced classification and description for users with a key

**Addresses:** Browser extension, BYOK LLM integration

**Uses:** Manifest V3 service worker + messaging API, Better Auth session token in extension, AES-256 key encryption, classify.worker.ts LLM conditional branch

**Avoids:**
- Pitfall: BYOK key stored in plain text (AES-256 encryption, masking, log stripping)
- Pitfall: Extension CORS via content script (all external fetch through service worker background script)
- Pitfall: MV3 service worker termination (idle-restart tested; no persistent connections assumed)
- Anti-pattern: Storing full LLM key server-side without encryption

**Research flag:** MV3 is well-documented but has surprising edge cases; recommend a research-phase pass on the specific patterns for session token handling in extensions and chrome.storage.session vs. chrome.storage.local tradeoffs.

---

### Phase 6: Relational Graph View

**Rationale:** The graph is the signature differentiator but is the last phase because it is only useful when classification is accurate and the link collection has enough volume to show meaningful connections. Rushing the graph before classification is validated produces a disconnected, useless graph that sets wrong expectations. At this phase, tag data is mature and edge derivation can be validated against real user data.

**Delivers:** Force-directed graph of all user bookmarks (nodes) connected by shared tags (edges), WebGL rendering via react-force-graph, basic zoom/pan/click navigation, default view capped at most-connected nodes, tag-based filtering

**Addresses:** Relational graph view (P2 feature from FEATURES.md)

**Uses:** react-force-graph 1.48.x (WebGL), GET /api/graph endpoint (PostgreSQL tag co-occurrence JOIN), TanStack Query for graph data fetching

**Avoids:**
- Pitfall: SVG-based force graph (WebGL renderer selected at this phase, not SVG)
- Pitfall: Graph showing all bookmarks by default (cap at top 200 most-connected nodes)
- Pitfall: Eager edge computation on read (materialize graph_edges view or use cached result; refresh post-classify)
- Anti-pattern: Using a graph database (PostgreSQL JOIN is sufficient; no Neo4j)

**Research flag:** Graph performance at 1,000+ nodes needs validation during implementation — react-force-graph WebGL thresholds should be stress-tested with synthetic data. Recommend a research-phase pass if graph filtering/clustering behavior needs to go beyond the basic force-directed layout.

---

### Phase Ordering Rationale

- **Database schema decisions are load-bearing and front-loaded:** Tag flexibility, FTS indexes, raw_content separation, and user_id scoping are all defined in Phase 1. Changing these post-data is expensive.
- **Async enrichment first, UI second:** The 202 pattern and job queue must exist before any enrichment feature is built. This prevents the most expensive refactor path (synchronous save → async refactor).
- **Classification before graph:** Graph edges are tags; without quality classification, the graph is disconnected. Phase 2 (classification) must be validated before Phase 6 (graph) is meaningful.
- **Worker infrastructure shared:** Phases 2 and 4 (scraping and uptime monitoring) share the same pg-boss worker infrastructure. Establishing it in Phase 2 means Phase 4 is additive, not duplicative.
- **Extension after stable API:** The browser extension calls the same POST /api/links endpoint built in Phase 1. Building the extension before the API is stable creates rework.
- **Graph last:** The graph is a power-user feature that requires a populated, well-classified collection to be useful. Shipping it last maximizes the signal-to-noise quality of the initial release.

### Research Flags

Phases likely needing a research-phase pass during planning:
- **Phase 2 (Scraping pipeline):** Two-tier Cheerio + Playwright design is well-understood in principle, but Playwright browser pool management, worker process memory constraints, and retry/circuit-breaker patterns have implementation-specific complexity. Recommend research if the team is new to scraping pipelines.
- **Phase 5 (Browser Extension):** MV3 service worker lifecycle has known edge cases (idle termination, storage API differences). Recommend research on session token handling, chrome.storage.session, and CORS-safe messaging patterns before building.
- **Phase 6 (Graph):** react-force-graph WebGL thresholds and level-of-detail strategies benefit from stress testing and possibly a research pass on graph clustering approaches for the default capped view.

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1:** Auth (Better Auth docs are comprehensive), Drizzle schema design, Next.js App Router setup, Neon connection — all have high-quality official documentation.
- **Phase 3:** PostgreSQL FTS is extensively documented; TanStack Query pagination is standard; HTML bookmark import format is a fixed standard.
- **Phase 4:** pg-boss repeatable jobs are well-documented; HTTP uptime monitoring is a solved problem.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core stack (Next.js 15, PostgreSQL, Drizzle, Better Auth) verified against official changelogs and npm. Graph visualization (react-force-graph) and NLP (compromise) are MEDIUM — community-corroborated but fewer primary sources. |
| Features | HIGH | Based on direct competitor analysis (Raindrop.io, Karakeep) and real market context (Pocket shutdown July 2025). Feature expectations are well-grounded. |
| Architecture | HIGH | Core patterns (async enrichment, two-tier scraper, derived graph, BYOK classification) are well-established in practitioner and academic literature. Graph scaling thresholds are MEDIUM — empirically reported but environment-dependent. |
| Pitfalls | MEDIUM | Critical pitfalls (blocking save, SVG graph, plain-text keys, taxonomy lock-in, hosting mismatch) are verified across multiple sources. Some specifics (exact node count thresholds, exact pg-boss concurrency limits) are training-data-informed and should be validated during implementation. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **graph performance thresholds:** Research cites ~1,000 SVG nodes as the collapse threshold and ~10,000 WebGL nodes as the comfortable limit. These should be validated with synthetic data during Phase 6 implementation before committing to the default "top 200 nodes" cap.
- **Playwright memory footprint on chosen worker host:** Render paid tier ($7/mo) runs a persistent Node.js process. Concurrent Playwright sessions are memory-heavy. If classification volume spikes, the worker may OOM. Plan to profile Playwright concurrency limits on the actual host during Phase 2.
- **pg-boss on Neon cold starts:** pg-boss requires a persistent connection for SKIP LOCKED. Neon's scale-to-zero behavior may conflict with a long-lived pg-boss process. This needs validation during Phase 1 infrastructure setup — the worker may need a non-serverless connection pool (e.g., direct connection, not HTTP pooler).
- **BYOK LLM client-side vs. server-side proxy decision:** Research presents both options (client calls LLM API directly using key retrieved per-session vs. server proxies using encrypted stored key). The final decision involves cost-security tradeoffs not fully resolved in research. Recommend explicit decision during Phase 5 planning.

## Sources

### Primary (HIGH confidence)
- [Next.js 16 release blog](https://nextjs.org/blog/next-16) — v15.x stable LTS confirmation
- [Better Auth changelog](https://better-auth.com/changelog) — v1.5.5 confirmed current
- [Better Auth email/password docs](https://better-auth.com/docs/authentication/email-password) — scrypt, OWASP compliance
- [BullMQ Architecture Docs](https://docs.bullmq.io/guide/architecture) — queue patterns
- [Offscreen Documents in Manifest V3 — Chrome Developers](https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3) — MV3 patterns
- [PostgreSQL FTS vs Elasticsearch — Neon](https://neon.com/blog/postgres-full-text-search-vs-elasticsearch) — FTS capability confirmation
- [Hybrid LLM/Rule-Based Approaches (arXiv)](https://arxiv.org/pdf/2404.15604) — two-stage classification pattern
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) — v0.45.1 stable confirmed
- [Mozilla Readability npm](https://www.npmjs.com/package/@mozilla/readability) — 642 dependents, extraction benchmark
- [pg-boss GitHub](https://github.com/timgit/pg-boss) — SKIP LOCKED queue confirmed

### Secondary (MEDIUM confidence)
- [Best Bookmark Managers 2026 — Bookmarker.cc](https://bookmarker.cc/blog/best-bookmark-managers-2026) — market feature expectations
- [Karakeep GitHub](https://github.com/karakeep-app/karakeep) — competitor feature reference
- [Best Libraries for Large Force-Directed Graphs](https://weber-stephen.medium.com/the-best-libraries-and-methods-to-render-large-network-graphs-on-the-web-d122ece2f4dc) — SVG vs Canvas thresholds
- [BYOK Security — IronCore Labs](https://ironcorelabs.com/byok/) — encryption architecture
- [Render vs Vercel comparison](https://render.com/docs/render-vs-vercel-comparison) — hosting platform limitations
- [Drizzle vs Prisma 2026 — Bytebase](https://www.bytebase.com/blog/drizzle-vs-prisma/) — ORM comparison
- [Neon vs Supabase — DesignRevision](https://designrevision.com/blog/supabase-vs-neon) — hosting tradeoffs
- [Pocket shutdown 2025 — Webcull](https://webcull.com/blog/2025/05/pocket-is-shutting-down) — market context

### Tertiary (LOW confidence / training-data-informed)
- WebSearch: Tailwind v4 + shadcn/ui + Next.js 15 compatibility — confirmed via multiple corroborating sources but no single authoritative reference
- WebSearch: compromise NLP library current status — npm page + community references; needs validation against current v14.x docs during Phase 2

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
