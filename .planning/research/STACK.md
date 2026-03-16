# Stack Research

**Domain:** Intelligent bookmark manager web app (full-stack, self-hosted classification, graph visualization)
**Researched:** 2026-03-16
**Confidence:** MEDIUM-HIGH (core stack HIGH, graph visualization MEDIUM, NLP layer MEDIUM)

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x (stable LTS) | Full-stack React framework | v16 shipped Oct 2025 but is still maturing; v15 is the battle-tested choice for a new production project right now. App Router + Server Actions handle the API surface without a separate backend. Turbopack dev stable. |
| React | 19.x | UI runtime | Required by Next.js 15. Concurrent features and Server Components are load-bearing for the graph + list views at scale. |
| TypeScript | 5.x | Type safety | Non-negotiable for a project with complex domain types (links, tags, graphs, job queues). Next.js ships with first-class TS support. |
| Tailwind CSS | 4.x | Styling | v4 dropped the JS config file; theme variables live in CSS directly. Standard pairing with Next.js 15. Zero runtime cost. |
| shadcn/ui | latest (CLI-based) | Component primitives | Copy-owned components mean no version lock-in. Fully compatible with Tailwind v4 and React 19. Covers all standard UI patterns (dialogs, tables, forms, badges). |

### Database

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PostgreSQL | 16.x | Primary data store | Handles relational data (users, links, tags, link-tag joins), full-text search (GIN index + tsvector), and SKIP LOCKED for job queue — all in one system. Avoids running Redis just for queues. |
| Neon | managed | Serverless Postgres hosting | Best serverless Postgres for Vercel/Next.js. Scale-to-zero billing ideal for a free-to-host project. 500 MB free tier. Preview branch per PR. Native Next.js/Vercel integration. |
| Drizzle ORM | 0.45.x | Database access layer | SQL-first, TypeScript-native. ~7.4 KB bundle, zero dependencies, no cold-start penalty. Prisma 7 closed the cold-start gap but Drizzle remains leaner for this workload. v1 beta exists but 0.45.x is the stable production choice today. |

### Authentication

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Better Auth | 1.5.x | Email/password auth | Lucia Auth deprecated March 2025. Auth.js v5 (NextAuth) is functional but optimized for OAuth flows and makes email/password intentionally harder. Better Auth emerged in 2025 as the community-recommended replacement: first-class email/password support, scrypt hashing, OWASP-compliant email enumeration protection, native Next.js App Router plugin. |

### Background Jobs

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| pg-boss | latest (v10.x) | Job queue for scraping + uptime monitoring | Built on PostgreSQL SKIP LOCKED. Eliminates Redis as a dependency. Exactly-once delivery with transactional guarantees. Perfect fit: scrape-on-save, periodic uptime pings, and async classification all fit the job model. BullMQ (Redis-based) is overkill and adds infra cost for this workload volume. |

### Content Extraction

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @mozilla/readability | latest | Extract main article content from saved URLs | Used by Firefox Reader View. Highest median extraction score (0.970) in benchmarks. 642 dependent npm packages vs 17 for @extractus/article-extractor — wider adoption signals reliability. Pair with jsdom to run server-side. |
| jsdom | latest | DOM emulation for Readability | Required to run @mozilla/readability in Node.js (it expects a DOM). Lightweight for this use case. |
| Cheerio | latest | Fallback HTML parsing + metadata extraction | When Readability returns nothing (non-article pages), Cheerio extracts OG tags, `<title>`, `<meta>` description. 70% faster than browser-based scraping for static HTML. |

### Rule-Based Classification (NLP)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| compromise | latest (v14.x) | Lightweight server-side NLP for tag extraction | Part-of-speech tagging, noun phrase extraction, entity recognition — all in ~240 KB, no native dependencies. English-only matches the v1 scope. No model downloads, no Python subprocess. |
| keyword-extractor | latest | TF-IDF-style keyword scoring | Complements compromise: extracts statistically significant terms from page body text. Provides ranked keyword list as tag candidates before LLM enhancement. |

### Graph Visualization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| react-force-graph | 1.48.x | Interactive force-directed graph | WebGL-powered (`three.js` canvas), handles thousands of nodes smoothly. 2D mode sufficient for bookmark graph — avoids 3D complexity. Built-in zoom, pan, drag, click events. Ships as a React component (no D3 integration glue needed). |

### Search

| Technology | Purpose | Why Recommended |
|------------|---------|-----------------|
| PostgreSQL FTS (built-in) | Full-text search across links, tags, descriptions | GIN index on a `tsvector` column handles the full-text search requirement without adding Meilisearch or Typesense as separate services. At bookmark-collection scale (even hundreds of thousands of rows), PostgreSQL FTS is fast enough and avoids extra infra cost. If search quality becomes a pain point post-MVP, Meilisearch can be added later. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.x | Schema validation | All API inputs, form validation, LLM response parsing. Required everywhere data crosses a boundary. |
| React Hook Form | 7.x | Form state management | Works with Zod resolvers. Covers the save-link form, settings, auth forms. |
| TanStack Query | 5.x | Server state / data fetching on client | Manage graph data fetching, search results, and link list pagination on the client. Avoid — in Server Components where possible, but essential for real-time graph interactions. |
| SWR | — | Alternative to TanStack Query | Use only if TanStack feels heavy. Standard for simpler fetch-revalidate patterns. TanStack Query preferred when background refetch + optimistic updates are needed. |
| axios / node-fetch | — | HTTP client for scraping URLs | Use the built-in `fetch` (Node 18+) for simple URL fetching. Only reach for axios if you need interceptors for the browser extension API client. |
| date-fns | 3.x | Date manipulation | Uptime monitoring timestamps, relative time display. Lighter than dayjs or moment. |
| nanoid | 5.x | ID generation | Browser extension + bookmarklet need a way to generate IDs client-side. Safer than Math.random(). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Biome | Lint + format | Single tool replacing ESLint + Prettier. Significantly faster. Ships with sensible defaults for TypeScript React projects. |
| Drizzle Kit | DB migrations + schema push | CLI companion to drizzle-orm. `drizzle-kit generate` for migration files, `drizzle-kit push` for local dev. |
| Vitest | Unit testing | Native ESM support, Jest-compatible API, fast. Test classification rules, keyword extraction, and utility functions. |
| Playwright | E2E testing | Browser automation if needed for integration tests against the extension or auth flows. Overkill for v1 MVP — add post-launch. |

---

## Installation

```bash
# Core framework
npx create-next-app@15 pageslop --typescript --tailwind --app --src-dir --import-alias "@/*"

# Auth
npm install better-auth

# ORM + DB
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit

# Background jobs
npm install pg-boss

# Content extraction / NLP
npm install @mozilla/readability jsdom cheerio compromise keyword-extractor

# Graph
npm install react-force-graph

# Utilities
npm install zod react-hook-form @hookform/resolvers @tanstack/react-query date-fns nanoid

# Dev tools
npm install -D @biomejs/biome vitest @vitejs/plugin-react
npx shadcn@latest init
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 15 | Remix | If your team deeply values web standards / progressive enhancement and hates RSC. Remix's nested loader model is excellent, but Next.js has wider ecosystem support and Vercel deployment integration. |
| Next.js 15 | SvelteKit | If your team is Svelte-first. SvelteKit has real performance advantages but smaller ecosystem and fewer shadcn-equivalent components. |
| Drizzle ORM | Prisma 7 | If you want a more abstracted schema-first DX and your team finds raw SQL uncomfortable. Prisma 7 (pure TS, no Rust engine) is now viable for serverless. |
| pg-boss | BullMQ | If job volume exceeds ~500K/day or you need cross-language worker support. BullMQ requires Redis — adds a service to manage and pay for. |
| Better Auth | Auth.js v5 | If you add OAuth providers as a primary feature. Auth.js shines with multi-provider OAuth. For email/password-only v1, it's heavier than needed. |
| PostgreSQL FTS | Meilisearch | Once search quality becomes a product differentiator (typo tolerance, faceted filters, ranking tuning). Don't add it pre-MVP. |
| react-force-graph | Cytoscape.js | If you need advanced layout algorithms (hierarchical, grid, dagre) beyond force-directed. Cytoscape has more layout options but heavier API. |
| react-force-graph | Sigma.js | If the graph grows beyond ~50K edges. Sigma.js WebGL renderer handles more extreme scale but has poor documentation and harder React integration. |
| @mozilla/readability | @extractus/article-extractor | If you need metadata extraction (OG image, author, publish date) in one package. Has only 17 npm dependents vs 642 — lower confidence in reliability. |
| Neon | Supabase | If you want built-in auth + storage as a BaaS. Supabase free tier includes auth, but we're using Better Auth and don't need Supabase's add-ons — paying for features we'd be ignoring. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Lucia Auth | Officially deprecated March 2025; no longer maintained | Better Auth 1.5.x |
| NextAuth v4 | Deprecated. Use Auth.js v5 if you go that route, but Better Auth is preferred for email/password | Better Auth 1.5.x |
| Redis (standalone) | Adds infra cost and complexity just for job queues. Overkill at this scale | pg-boss on top of existing PostgreSQL |
| Meilisearch / Typesense (from day one) | PostgreSQL FTS is sufficient for bookmark collections. Adding a search service pre-MVP is premature optimization | PostgreSQL GIN index + tsvector |
| Prisma v4 or older | The Rust query engine causes cold start issues on serverless. Use Prisma v7 if you must use Prisma | Drizzle ORM 0.45.x |
| Puppeteer / Playwright for scraping | Launching full Chrome to scrape a URL is ~10x slower and uses ~10x more memory than Cheerio + Readability. Most pages serve static HTML adequate for extraction. | @mozilla/readability + Cheerio; only escalate to Playwright if a page is JS-only |
| D3.js (direct) | Requires manual integration glue in React (refs, imperative updates, fighting the React render cycle). High implementation cost for a force graph. | react-force-graph (wraps D3 force simulation + WebGL rendering with a React API) |
| Moment.js | Deprecated, huge bundle (~230KB). | date-fns (tree-shakeable, immutable) |
| ESLint + Prettier (separately) | Two tools to configure, two lint passes, frequent version conflicts. | Biome (single tool, faster) |
| Pages Router (Next.js) | App Router is the current standard. Pages Router is in maintenance mode. Server Actions and RSC are only in App Router. | App Router |

---

## Stack Patterns by Variant

**If the user provides their own LLM API key (BYOK):**
- Call the LLM API directly from the browser or from a Next.js Server Action scoped to that user's request — never store or proxy keys server-side
- Use the user's key to enhance classification output: better tag suggestions, richer descriptions
- The LLM call replaces the compromise + keyword-extractor step, not augments it — avoid double-processing

**If the user has no LLM key:**
- Run @mozilla/readability to extract body text
- Run compromise noun extraction + keyword-extractor TF-IDF scoring over the body text
- Map top keywords to a curated tag taxonomy (rule-based lookup table)
- Generate description from the first 2-3 sentences of Readability output (no summarization model needed)

**For the browser extension:**
- Build as a vanilla JS / Manifest V3 extension — no React needed in the extension popup
- Extension calls the existing Next.js API route (`POST /api/links`) with the user's session token
- Keep extension code minimal: capture URL + title, POST, show confirmation. All processing happens server-side.

**For uptime monitoring:**
- Schedule pg-boss recurring jobs (cron expression) per link at creation time
- Each job does a `HEAD` or `GET` request and writes `status: up | down` + `last_checked_at` to the links table
- No separate uptime service needed

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 15.x | React 19.x (required) | React 18 dropped in Next.js 15 |
| shadcn/ui (latest CLI) | Tailwind CSS 4.x, React 19 | All components updated for v4 — use CLI to add components, not the old copy-paste approach |
| Drizzle ORM 0.45.x | drizzle-kit 0.28.x | Keep drizzle-orm and drizzle-kit in sync — version mismatch causes migration errors |
| Better Auth 1.5.x | Next.js 15 App Router | Requires `nextCookies()` plugin for App Router cookie handling |
| pg-boss 10.x | PostgreSQL 14+ | Requires `pgcrypto` extension (available on Neon by default) |
| react-force-graph 1.48.x | React 19 | Peer dep is React 16+ — compatible with React 19 |
| @mozilla/readability | jsdom 24.x | Requires a JSDOM instance; pass `new JSDOM(html).window.document` |

---

## Sources

- [Next.js 16 release blog](https://nextjs.org/blog/next-16) — v16 shipped Oct 2025; v15.x confirmed stable LTS
- [Better Auth changelog](https://better-auth.com/changelog) — v1.5.5 current as of March 2026
- [Better Auth email/password docs](https://better-auth.com/docs/authentication/email-password) — scrypt, OWASP compliance confirmed
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) — v0.45.1 stable confirmed
- [react-force-graph npm](https://www.npmjs.com/package/react-force-graph) — v1.48.2 confirmed
- [pg-boss GitHub](https://github.com/timgit/pg-boss) — PostgreSQL SKIP LOCKED queue confirmed
- [Neon vs Supabase comparison](https://designrevision.com/blog/supabase-vs-neon) — free tier limits, Next.js/Vercel integration
- [Mozilla Readability npm](https://www.npmjs.com/package/@mozilla/readability) — 642 dependents, extraction benchmark score
- [Drizzle vs Prisma 2026](https://www.bytebase.com/blog/drizzle-vs-prisma/) — Prisma 7 cold start fix confirmed, Drizzle bundle size confirmed
- [PostgreSQL FTS vs dedicated search](https://nomadz.pl/en/blog/postgres-full-text-search-or-meilisearch-vs-typesense) — when Postgres is sufficient
- [Lucia Auth deprecation context](https://blog.logrocket.com/lucia-auth-auth-js-alternative-next-js-authentication/) — deprecated March 2025 confirmed
- WebSearch: Tailwind v4 + shadcn/ui + Next.js 15 — confirmed standard trio in 2025 (MEDIUM confidence, multiple corroborating sources)
- WebSearch: compromise NLP library — MEDIUM confidence, training data + npm page corroboration

---

*Stack research for: Pageslop — intelligent bookmark manager*
*Researched: 2026-03-16*
