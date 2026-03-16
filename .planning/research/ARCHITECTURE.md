# Architecture Research

**Domain:** Intelligent bookmark manager with web scraping, classification, graph visualization, and uptime monitoring
**Researched:** 2026-03-16
**Confidence:** HIGH (core patterns well-established; graph viz scaling thresholds MEDIUM)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                 │
├───────────────────┬─────────────────┬───────────────────────────────┤
│    Web App        │ Browser Ext.    │   Bookmarklet / REST API       │
│  (Next.js/React)  │  (content.js)   │   (POST /api/links)            │
└────────┬──────────┴────────┬────────┴──────────────┬────────────────┘
         │                  │                        │
         ▼                  ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API Layer (Next.js)                            │
│                                                                      │
│   POST /api/links    GET /api/links    GET /api/graph   /api/search  │
│   (ingest + enqueue) (list/filter)    (nodes+edges)    (FTS query)  │
└────────────────────────────────────┬────────────────────────────────┘
                                     │ enqueue jobs
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Job Queue (BullMQ + Redis)                       │
│                                                                      │
│   scrape-queue          classify-queue          ping-queue           │
│   (per-URL fetch)       (rule-based + LLM)      (uptime checks)      │
└───────┬─────────────────────────┬───────────────────────┬───────────┘
        │                         │                       │
        ▼                         ▼                       ▼
┌──────────────┐        ┌─────────────────┐     ┌────────────────────┐
│  Scrape      │        │  Classifier     │     │  Monitor Worker    │
│  Worker      │        │  Worker         │     │                    │
│  (Cheerio /  │ ──────▶│  1. Rule engine │     │  HTTP GET + store  │
│   Playwright)│  text  │  2. BYOK LLM    │     │  up/down status    │
└──────────────┘        │     (optional)  │     └────────┬───────────┘
                        └────────┬────────┘              │
                                 │                       │
                                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Data Layer (PostgreSQL)                        │
│                                                                      │
│  links        tags           link_tags       uptime_status          │
│  users        tag_relations  raw_content     (latest ping only)     │
│  (FTS via tsvector + GIN index on links.search_vector)              │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Web App | Primary UI: save links, browse, graph view, search | Next.js 15 App Router, React |
| Browser Extension | One-click save from browser, sends URL to API | Manifest V3, minimal content script |
| Bookmarklet | Fallback input; JS snippet that POSTs URL | Vanilla JS, no install required |
| API Layer | Auth enforcement, link ingestion, data access, search | Next.js Route Handlers |
| Scrape Worker | Fetch raw HTML, extract title/body/metadata | BullMQ worker + Cheerio; Playwright for JS-heavy pages |
| Classifier Worker | Tag generation, category, description; rule-based first, LLM second | BullMQ worker, keyword extraction, optional OpenAI/Claude API call |
| Monitor Worker | Scheduled HTTP HEAD pings, record up/down | BullMQ repeatable job per user link |
| Job Queue | Async decoupling between API writes and background work | BullMQ backed by Redis |
| PostgreSQL | Primary store: links, tags, users, search index, uptime status | Postgres 16, Drizzle ORM |
| Redis | Queue backing store, optional rate-limit counters | Upstash Redis (serverless-compatible) or self-hosted |
| Graph Engine | Derive nodes/edges from tag co-occurrence, serve to client | DB query → JSON; no separate graph DB needed at this scale |

## Recommended Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Login/register routes
│   ├── (dashboard)/            # Authenticated app shell
│   │   ├── links/              # List, search, filter views
│   │   ├── graph/              # Force-directed graph page
│   │   └── settings/           # BYOK key management
│   └── api/
│       ├── links/              # POST (ingest), GET (list/search)
│       ├── graph/              # GET nodes + edges
│       └── ping/               # Uptime status reads
│
├── workers/                    # BullMQ worker processes
│   ├── scrape.worker.ts        # Fetches URL, extracts text/metadata
│   ├── classify.worker.ts      # Rule-based + optional LLM tags/description
│   └── monitor.worker.ts       # Uptime ping worker
│
├── queues/                     # Queue definitions and job types
│   ├── scrape.queue.ts
│   ├── classify.queue.ts
│   └── monitor.queue.ts
│
├── lib/
│   ├── db/                     # Drizzle schema + queries
│   │   ├── schema.ts           # links, tags, link_tags, users, uptime
│   │   └── queries/            # Domain-specific query functions
│   ├── classification/
│   │   ├── rules.ts            # Keyword/regex rule engine
│   │   └── llm.ts              # BYOK LLM client (optional path)
│   ├── scraper/
│   │   ├── cheerio.ts          # Fast path for static HTML
│   │   └── playwright.ts       # Fallback for JS-rendered pages
│   └── auth/                   # Session management (Lucia or Auth.js)
│
├── components/
│   ├── links/                  # LinkCard, LinkList, SearchBar
│   └── graph/                  # GraphCanvas (Sigma.js wrapper)
│
└── types/                      # Shared TypeScript types
```

### Structure Rationale

- **workers/:** Isolated from Next.js app server — run as separate Node.js processes. This is critical: Next.js serverless functions can't run long-lived workers.
- **queues/:** Single source of truth for queue names and job payload types, shared between API (producer) and workers (consumer).
- **lib/classification/:** Separates rule engine from LLM path so the rule engine is always exercised; LLM is a conditional enhancement called only when user has a key.
- **lib/scraper/:** Two-tier strategy: Cheerio for 90% of pages (fast, cheap), Playwright for SPA content (expensive, used sparingly).

## Architectural Patterns

### Pattern 1: Async Enrichment Pipeline

**What:** API accepts the URL and immediately returns a 202 Accepted response. Enrichment (scrape → classify) happens asynchronously via the job queue. The UI shows a "processing" state until workers update the link record.

**When to use:** Any time a user action triggers work that takes >100ms. Web scraping can take 2-30 seconds depending on target site. Never block the HTTP response on scraping.

**Trade-offs:** Adds queue infrastructure complexity; client needs polling or WebSocket to show completion. Benefit: API stays fast, scraping retries automatically on failure.

**Example:**
```typescript
// API route — producer
export async function POST(req: Request) {
  const { url } = await req.json()
  const link = await db.insert(links).values({ url, userId, status: 'pending' }).returning()
  await scrapeQueue.add('scrape', { linkId: link.id, url })
  return Response.json(link, { status: 202 })
}

// Scrape worker — consumer
worker.process(async (job) => {
  const { linkId, url } = job.data
  const { title, body } = await scrape(url)
  await db.update(links).set({ title, status: 'scraped' }).where(eq(links.id, linkId))
  await classifyQueue.add('classify', { linkId, body })
})
```

### Pattern 2: Two-Stage Classification (Rule-Based First, LLM Second)

**What:** The classifier worker always runs the rule engine first (keyword matching, domain heuristics, TF-IDF-like scoring). If the user has a BYOK LLM key configured, a second pass sends the extracted text to the LLM for enriched tags and a prose description.

**When to use:** Always for Pageslop — the system must function without any LLM key (cost constraint). LLM improves quality but is never the sole path.

**Trade-offs:** Rule engine needs domain-specific keyword lists maintained over time. LLM output needs sanitization before persisting (hallucinations, prompt injection in page content).

**Example:**
```typescript
async function classify(text: string, userLlmKey?: string) {
  // Stage 1: always runs
  const ruleTags = extractRuleTags(text)        // keyword + domain rules
  const baseDescription = extractSentence(text) // first meaningful sentence

  if (!userLlmKey) return { tags: ruleTags, description: baseDescription }

  // Stage 2: optional enhancement
  const llmResult = await callLlm(userLlmKey, text, ruleTags)
  return {
    tags: mergeTags(ruleTags, llmResult.tags),   // rule tags + LLM additions
    description: llmResult.description           // prose description from LLM
  }
}
```

### Pattern 3: Derived Graph (No Graph Database Needed)

**What:** The graph of links is not stored as a graph database (no Neo4j needed). Instead, nodes are links and edges are derived on-query from shared tag memberships. Two links are connected if they share at least one tag. This is a simple JOIN that PostgreSQL handles well at bookmark-manager scale (tens of thousands of links per user).

**When to use:** Until graph traversal becomes a bottleneck (typically >50K edges per user query). The derived approach avoids a second data store.

**Trade-offs:** Query time grows with tag/link count. At very high volumes, materialized view or pre-computed adjacency table can cache the graph snapshot.

**Example:**
```sql
-- Edges: links that share at least one tag (for a given user)
SELECT DISTINCT lt1.link_id AS source, lt2.link_id AS target, lt1.tag_id
FROM link_tags lt1
JOIN link_tags lt2 ON lt1.tag_id = lt2.tag_id AND lt1.link_id < lt2.link_id
JOIN links l ON l.id = lt1.link_id AND l.user_id = $userId
```

## Data Flow

### Request Flow: Save a Link

```
User pastes URL (web app / extension / bookmarklet / API)
    ↓
POST /api/links
    ↓ validate + auth check
INSERT link (status: 'pending') → PostgreSQL
    ↓
Enqueue scrape job → BullMQ (Redis)
    ↓
Return 202 { linkId, status: 'pending' }
    ↓
[background]
Scrape Worker fetches URL → extracts title, body, favicon
    ↓
UPDATE link (title, raw_content, status: 'scraped') → PostgreSQL
Enqueue classify job → BullMQ
    ↓
Classifier Worker: rule engine → optional LLM call
    ↓
INSERT tags + link_tags → PostgreSQL
UPDATE link (description, status: 'ready') → PostgreSQL
    ↓
UI polls GET /api/links/{id} or SSE stream → shows enriched link
```

### Uptime Monitoring Flow

```
On link save → schedule repeatable ping job (every 5-60 min, configurable)
    ↓
Monitor Worker: HTTP HEAD request to URL
    ↓
Store result → uptime_status (link_id, is_up, checked_at)
    ↓
Only latest status per link stored (v1 — no history)
    ↓
GET /api/links includes { uptime: 'up' | 'down' | 'unknown' }
    ↓
UI renders green/red dot per link card
```

### Full-Text Search Flow

```
User types query in SearchBar
    ↓
GET /api/links?q=query (debounced, min 2 chars)
    ↓
PostgreSQL: WHERE search_vector @@ plainto_tsquery($q)
             ORDER BY ts_rank(search_vector, ...) DESC
    ↓
search_vector is a tsvector column maintained by trigger:
  to_tsvector(url || ' ' || title || ' ' || description || ' ' || tags)
    ↓
Return ranked results → render list
```

### Graph Rendering Flow

```
User navigates to /graph
    ↓
GET /api/graph (returns all user nodes + edges)
    ↓
Server: derive edges via tag co-occurrence JOIN
    ↓
Return { nodes: [...], edges: [...] }
    ↓
Sigma.js (WebGL) renders force-directed layout in browser
    ↓
Virtualization: only render visible nodes (Sigma handles this natively)
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k links per user | Single Postgres instance, Upstash Redis free tier, workers in same dyno or separate worker process |
| 1k-50k links per user | Add GIN index on `search_vector`, materialize graph adjacency as a cached view, paginate graph API response |
| 50k+ links per user | Pre-compute graph snapshots on a schedule rather than on-demand, consider tag clustering before full graph load |
| Multi-thousand concurrent users | Redis for queue is already horizontally scalable; Postgres read replicas for search; worker pool scale-out |

### Scaling Priorities

1. **First bottleneck — graph query:** The tag-join edge derivation query becomes slow as links/tags grow. Fix: add a materialized `graph_edges` view, refresh after classify completes. No architecture change needed.
2. **Second bottleneck — full-text search:** PostgreSQL FTS with GIN index handles millions of rows. If latency degrades, add `pg_search` (ParadeDB BM25 extension) — no new service, stays in Postgres.
3. **Third bottleneck — scrape worker throughput:** Cheerio workers are fast; Playwright workers are memory-heavy. If Playwright usage spikes, run it as a separate, rate-limited queue. Uptime pings are the highest-frequency jobs — if ping volume grows, shard the monitor queue by user cohort.

## Anti-Patterns

### Anti-Pattern 1: Scraping Synchronously in the API Route

**What people do:** Fetch the URL inside the POST /api/links handler and wait for scrape results before returning to the client.

**Why it's wrong:** Scraping takes 2-30 seconds. This blocks the HTTP connection, times out on serverless platforms (Vercel 10s default), and degrades UX. Network errors cause user-visible failures on save.

**Do this instead:** Insert the link immediately with `status: 'pending'`, enqueue the scrape job, return 202. Workers handle the async enrichment; UI reflects status.

### Anti-Pattern 2: Storing the Graph in a Separate Graph Database

**What people do:** Add Neo4j or similar because the feature is called "graph."

**Why it's wrong:** Bookmark relationships are simple co-occurrence (shared tags). This is a many-to-many relational query, not deep traversal. A graph DB adds operational complexity, sync burden, and cost for no benefit at this scale.

**Do this instead:** Derive edges with a PostgreSQL JOIN over `link_tags`. If needed, materialize as a view. Graph DB only makes sense when traversal depth and path-finding matter.

### Anti-Pattern 3: Running LLM Calls Server-Side for All Users

**What people do:** Use a single platform LLM API key for all enrichment.

**Why it's wrong:** Pageslop is free. Server-side LLM calls at any meaningful user volume become unaffordable. It also creates a single point of failure for enrichment quality.

**Do this instead:** BYOK — store the user's API key (encrypted) and pass it through from the classify worker. Users who opt in get LLM enrichment; users who don't get rule-based tags. Platform cost stays zero.

### Anti-Pattern 4: Using Playwright for Everything

**What people do:** Default all scraping to Playwright because it handles JS-rendered pages.

**Why it's wrong:** Playwright spins up a Chromium instance per job. On a constrained server, parallel Playwright sessions consume gigabytes of RAM and slow queue throughput significantly.

**Do this instead:** Default to Cheerio (HTML parser, ~100ms, ~5MB RAM). Only fall back to Playwright when Cheerio returns empty content (no meaningful text extracted). This keeps 90% of jobs fast and cheap.

### Anti-Pattern 5: Keeping Full Page Content in Primary Link Table

**What people do:** Store `raw_html` or `full_body_text` in the main `links` table.

**Why it's wrong:** Full page content can be hundreds of KB. Storing it inline bloats the table, slows list queries, and pollutes search rankings.

**Do this instead:** Store raw content in a separate `raw_content` table (link_id FK, body TEXT). The main `links` table holds only derived fields (title, description, tags, search_vector). Raw content can be dropped after classification completes if storage is a concern.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| User-provided OpenAI / Anthropic key | Passed through classify worker; stored encrypted in user settings | Never logged; validated on save |
| Target websites (scraping) | HTTP GET with realistic user-agent + timeout (10s) | Rate-limit per domain to avoid bans; respect robots.txt |
| Uptime targets | HTTP HEAD with 5s timeout | Treat 2xx/3xx as up; 4xx/5xx/timeout as down |
| Browser Extension | `chrome.runtime` → `fetch(apiEndpoint, { Authorization: Bearer token })` | Extension gets JWT from auth session |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| API Route → Queue | BullMQ `queue.add(jobName, payload)` | Fire and forget from API perspective |
| Queue → Scrape Worker | BullMQ job dispatch; worker runs in separate Node.js process | Workers need DB access and Redis access independently |
| Scrape Worker → Classify Worker | Scrape worker enqueues classify job after DB update | Chained via BullMQ flows — classify depends on scrape completion |
| API Route → DB | Drizzle ORM queries; always scoped by `userId` from session | userId scope is the primary auth enforcement for data isolation |
| API → Graph API | Same DB, separate route handler; derives edges on-demand | Consider dedicated endpoint with result caching (Redis, 60s TTL) |
| Client → Sigma.js Graph | React state → Sigma component props; graph data fetched once on mount | Incremental updates via node/edge diff if user adds links during session |

## Build Order Implications

Based on component dependencies, the natural build sequence is:

1. **Auth + DB schema** — Everything else depends on users and the links table existing. No workers can run without schema.
2. **Link ingestion API (sync, no enrichment)** — Establishes the core create/read link flow. Tests the data model before adding complexity.
3. **Scrape worker + queue infrastructure** — Requires BullMQ + Redis + worker process management. Unblocks enrichment.
4. **Rule-based classifier** — Depends on scraped text existing. No external dependencies — purely algorithmic.
5. **Full-text search** — Depends on links + tags existing. Mostly a DB indexing task on top of existing data.
6. **Uptime monitor worker** — Independent of classification; depends only on links existing. Shares queue infrastructure from step 3.
7. **Graph API + Sigma.js visualization** — Depends on tags/link_tags from classification. Last because it requires populated data to be meaningful.
8. **BYOK LLM enhancement** — Additive layer on the classifier. No structural changes needed; just a conditional branch in classify.worker.ts.
9. **Browser extension + bookmarklet** — Client-side input methods that talk to the already-built API. Build after API is stable.

## Sources

- [BullMQ Architecture Docs](https://docs.bullmq.io/guide/architecture) — HIGH confidence (official)
- [How I Built an Uptime Monitoring Service](https://dev.to/vponamariov/how-i-built-architecture-of-uptime-monitoring-service-54h8) — MEDIUM confidence (practitioner)
- [Hybrid LLM/Rule-Based Approaches](https://arxiv.org/pdf/2404.15604) — HIGH confidence (academic)
- [PostgreSQL FTS vs Elasticsearch — Neon](https://neon.com/blog/postgres-full-text-search-vs-elasticsearch) — HIGH confidence (official Neon/Postgres)
- [You Don't Need Elasticsearch: BM25 in Postgres](https://www.tigerdata.com/blog/you-dont-need-elasticsearch-bm25-is-now-in-postgres) — MEDIUM confidence
- [Sigma.js Big Data Visualization](https://www.rapidops.com/blog/big-data-visualization-using-sigma-js/) — MEDIUM confidence
- [Graph Databases: When Relationships Matter](https://www.baremon.eu/graph-databases-when-relationships-matter/) — MEDIUM confidence
- [Linkwarden open-source reference](https://github.com/linkwarden/linkwarden) — MEDIUM confidence (code reference)
- [BullMQ + NestJS Scraping Pipeline](https://medium.com/@mumerbilal142/building-a-scalable-video-scraper-pipeline-using-nestjs-bullmq-puppeteer-redis-mongodb-s3-4ab4bf9056a0) — MEDIUM confidence (practitioner)

---
*Architecture research for: Intelligent bookmark manager (Pageslop)*
*Researched: 2026-03-16*
