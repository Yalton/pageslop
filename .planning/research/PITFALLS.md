# Pitfalls Research

**Domain:** Intelligent bookmark manager (hybrid AI/rule classification, web scraping, graph visualization, uptime monitoring, BYOK LLM, free hosting)
**Researched:** 2026-03-16
**Confidence:** MEDIUM — core findings verified across multiple sources; some specifics are training-data-informed and flagged

---

## Critical Pitfalls

### Pitfall 1: Treating Web Scraping as a Reliable Data Source

**What goes wrong:**
The scraper fetches a URL and gets back empty or minimal content because the target page is a Single-Page Application (SPA) or a JavaScript-rendered app. og:title, og:description, and body text are injected by client-side JavaScript after the initial HTML shell loads. A naive `fetch()` + HTML parse approach returns the empty shell. Classification and description generation then run on garbage input, producing garbage output.

**Why it happens:**
Developers test scrapers on static pages and conventional sites during development. The problem only surfaces when users save links to React/Vue/Angular apps, Twitter/X, LinkedIn, GitHub issues, and similar JS-heavy targets — which is a substantial fraction of real-world bookmarks.

**How to avoid:**
Design a two-tier scraper from the start: (1) fast path — HTTP fetch + HTML parse, attempt to extract Open Graph tags and `<title>`, return immediately if content is sufficient; (2) slow path — headless browser (Playwright/Puppeteer) triggered when the fast path yields empty or low-confidence content (e.g., description under 20 chars, no og:image). Queue the slow path asynchronously so the bookmark is saved immediately and enriched later. Never block the save operation on scraping completion.

**Warning signs:**
- Description field is frequently blank or contains only the domain name
- Tags are consistently generic ("web", "page", "site") regardless of content
- Users report "it just says 'Loading...' for the description"

**Phase to address:**
Core classification/scraping phase (Phase 2 or equivalent). The two-tier architecture decision must be made before building the scraping pipeline — retrofitting headless browser support is expensive.

---

### Pitfall 2: Blocking the Save Action on Scraping/Classification

**What goes wrong:**
Users paste a URL and wait several seconds (or longer if a headless browser is invoked) before the bookmark appears. This creates friction at the single most important moment — the save — and trains users to avoid the app entirely.

**Why it happens:**
The natural implementation sequence is: receive URL → scrape → classify → store → respond. This feels correct from a data-integrity perspective but is wrong from a UX perspective.

**How to avoid:**
Always save the raw URL immediately and return success to the user within ~100ms. Run scraping and classification as a background job. Show the bookmark immediately with a "processing..." indicator. Update the UI via polling or WebSocket when enrichment completes. The user never waits for AI.

**Warning signs:**
- Save button feels "laggy" during development testing
- Scraping step has no timeout — it can hang indefinitely
- No job queue or async worker in the architecture

**Phase to address:**
Core save flow (Phase 1 foundation). The async-first pattern must be the starting architecture, not a refactor added later after performance complaints.

---

### Pitfall 3: Graph Visualization Choking on Scale

**What goes wrong:**
The force-directed graph view renders fine with 50 bookmarks during development. At 500–1,000 nodes it becomes sluggish. At 5,000+ nodes (a realistic power user collection) the browser tab freezes or crashes. The D3 SVG-based approach — the default tutorial approach — hits a hard performance wall around 1,000–3,000 SVG elements depending on the browser.

**Why it happens:**
SVG-based D3 force graphs create one DOM node per bookmark node and one per edge. DOM manipulation at that scale is expensive. The physics simulation itself is O(n log n) per tick, which is manageable, but rendering is the bottleneck. Developers build the graph feature against a small seed dataset and never stress-test at realistic scale.

**How to avoid:**
Use Canvas or WebGL rendering for the graph, not SVG. Libraries like `sigma.js`, `Cytoscape.js` (with Canvas renderer), or `three-forcegraph` (WebGL) handle 10,000+ nodes. If using D3 directly, use a Canvas layer for node/edge rendering and SVG only for interactive overlays (labels, tooltips). Implement viewport culling — only simulate/render nodes in or near the visible viewport. Add level-of-detail: hide labels when zoomed out, collapse clusters, progressively load edges. Implement a node limit for the default graph view (e.g., show only the 200 most-connected nodes by default, with "expand" controls).

**Warning signs:**
- Graph view built with SVG-only D3 without Canvas consideration
- No performance testing above 500 nodes in development
- No "max visible nodes" cap in the initial implementation
- The graph shows ALL bookmarks by default with no filtering

**Phase to address:**
Graph visualization phase. Do not build SVG-only and plan to "optimize later." The renderer choice determines the entire graph implementation.

---

### Pitfall 4: BYOK API Key Stored Insecurely or Exposed

**What goes wrong:**
User LLM API keys are stored in plain text in the database, logged accidentally in request logs, or returned in API responses. Alternatively, the key is stored only in `localStorage` with no server-side counterpart, meaning it disappears on logout and users lose their configuration constantly.

**Why it happens:**
Keys feel like "just another user setting" during early development. The full threat model — key theft enabling billing fraud on the user's account — isn't front-of-mind. Logging middleware that logs request bodies captures keys in transit. OR the opposite mistake: avoiding server-side storage entirely "for privacy" creates a broken UX.

**How to avoid:**
Encrypt API keys at rest using AES-256 with a server-side master key (stored in environment variables, not the database). Never log request bodies that contain key fields — use a middleware allowlist that strips sensitive fields before logging. Never return the key value in API responses after initial save — return a masked version (e.g., `sk-...xxxx`). On the client, store the fact that a key exists but not the key value itself. Consider whether to proxy LLM calls server-side (using the stored encrypted key) vs. having the client call the LLM API directly using the key retrieved per-session. Server-side proxying is more secure but adds cost complexity; client-side direct calls are simpler but require transmitting the key to the browser on each session.

**Warning signs:**
- Database schema has an `api_key TEXT` column with no encryption note
- Application logs show request body fields
- API response for "get user settings" returns the full key value
- No key masking in the UI

**Phase to address:**
Authentication/user settings phase. Key storage architecture must be decided before any BYOK UI is built.

---

### Pitfall 5: Uptime Monitoring Consuming Disproportionate Infrastructure

**What goes wrong:**
Each saved bookmark needs periodic HTTP pings. With a large user base and each user having hundreds of bookmarks, the ping volume grows unboundedly. A naive implementation — a cron job that loops all active bookmarks and pings them serially — either times out, consumes all available workers, or becomes so slow that "5-minute monitoring" becomes "2-hour monitoring."

**Why it happens:**
Uptime monitoring seems simple: ping a URL, record the result. The concurrency and scheduling problem only becomes visible at scale. On free hosting tiers, background workers may be unavailable or rate-limited.

**How to avoid:**
Use a job queue (BullMQ, pg-boss, or similar) with configurable concurrency limits. Distribute ping jobs with jitter to avoid thundering-herd at the top of each hour. Implement a backoff strategy — if a URL is consistently down for 24 hours, reduce ping frequency to conserve resources. Cap the number of monitored URLs per free user (e.g., 50 active monitors). For free hosting, the background worker must be a persistent process, not a serverless function — Render background workers or Railway services are appropriate; Vercel cron jobs have a 15-minute max execution and cannot run persistent watchers. Consider deduplication — if 1,000 users have saved the same URL, ping it once and fan out the status.

**Warning signs:**
- Uptime worker is a single cron job that processes all users serially
- No job queue — pings are triggered directly from a scheduled API endpoint
- No per-user monitor count cap
- Deployed on a serverless platform (Vercel) without a persistent worker service
- No deduplication of shared URLs across users

**Phase to address:**
Uptime monitoring phase. The architecture (job queue, worker process, deduplication) must be established before implementing the ping logic.

---

### Pitfall 6: Classification Taxonomy Lock-In

**What goes wrong:**
Tags and categories are hardcoded as a fixed enum in the database schema. Six months in, users want custom tags. The rule-based classifier emits tags that don't match what the LLM classifier emits, creating duplicate/inconsistent taxonomies. Changing the tag schema requires a migration across potentially millions of bookmark-tag relationships.

**Why it happens:**
Starting with a fixed taxonomy feels cleaner and avoids the "what tags even make sense?" design question. The divergence between rule-based tags and LLM-suggested tags is not anticipated.

**How to avoid:**
Design the tag system as a flexible string-based taxonomy from day one — tags are user strings, not enum values. The classifier (rule-based or LLM) suggests tags; the system normalizes them (lowercase, trim, deduplicate). Store a `source` field with each tag (`rule`, `llm`, `user`) so users can see where tags came from and filter/override. Build a tag vocabulary table to enable fuzzy-matching and consolidation (e.g., "javascript" and "js" map to the same canonical tag). Never assume the classification taxonomy is static.

**Warning signs:**
- Database schema has `category ENUM(...)` or hardcoded category constants in application code
- Rule-based and LLM paths produce different tag formats that aren't normalized
- No `source` field on tags
- Tags are stored as a `TEXT[]` array with no normalization layer

**Phase to address:**
Database schema design (Phase 1). Tag architecture is load-bearing — fix it before building any classification logic on top.

---

### Pitfall 7: Full-Text Search Failing at Scale Without Proper Indexing

**What goes wrong:**
Search works fast in development against 100 records. At 100,000 records per user, `ILIKE '%keyword%'` queries scan the entire table and return in 8+ seconds. Full-text search across url, title, description, and tags requires proper indexing strategy that differs between SQLite and PostgreSQL.

**Why it happens:**
Search is implemented as a string match with ILIKE/LIKE during early development because it's simple. The performance problem only manifests with large datasets. The FTS index must be created at schema design time — adding it later requires a potentially long migration.

**How to avoid:**
Use PostgreSQL's built-in `tsvector` + `GIN` index for full-text search from the start. Create a generated column combining title, description, tags, and URL into a single tsvector. Add a GIN index on that column. For SQLite (if used), use FTS5 extension with a virtual table. Never rely on LIKE/ILIKE for production search. Implement search result ranking using `ts_rank` (PostgreSQL) or BM25 scores (SQLite FTS5). Plan for per-user search isolation in the query (always include `user_id` in the WHERE clause before the FTS filter).

**Warning signs:**
- Search implementation uses `WHERE description ILIKE '%query%'`
- No GIN index in the database schema
- Search response times are acceptable at seed data size but untested at 10,000+ records
- Search queries don't include the user_id filter early in the plan

**Phase to address:**
Database schema design (Phase 1). FTS index architecture is not retroactively cheap to add.

---

### Pitfall 8: Free Hosting Platform Incompatibility with Required Architecture

**What goes wrong:**
The app is designed for a serverless platform (Vercel) that cannot run persistent background workers. Uptime monitoring, async scraping queues, and scheduled jobs all require persistent processes. Attempting to emulate background work with serverless cron functions leads to time limit overruns, dropped jobs, and unreliable behavior.

**Why it happens:**
Vercel is the default "free Next.js hosting" association. Its limitations around long-running processes and background workers are not front-of-mind when choosing it for the frontend. By the time background worker requirements become apparent, the deployment infrastructure is already set.

**How to avoid:**
Separate concerns at the infrastructure level from the start: use Vercel or Cloudflare Pages for the frontend/API routes, and Render (free tier with spin-down caveat) or Railway (usage-based) for the background worker service and database. Render's free-tier web services spin down after inactivity (15 minutes idle), which breaks uptime monitoring continuity — use at least a paid Render instance ($7/month) for the worker, or accept that free-tier monitoring has gaps. Alternatively, design the worker to be stateless and restartable, tolerating missed pings gracefully.

**Warning signs:**
- Architecture diagram shows a single deployment target for both web app and background workers
- Uptime monitoring is implemented as a Vercel cron endpoint
- No separate worker service in the infrastructure plan

**Phase to address:**
Infrastructure setup (Phase 1). Platform choice determines what architectures are even possible.

---

### Pitfall 9: Over-Relying on AI Classification as a Magic Bullet

**What goes wrong:**
The product is designed with the assumption that AI will produce accurate, consistent tags and descriptions. When AI classification is wrong (wrong topic, generic tags, hallucinated descriptions), users have no correction path. Trust erodes. Users stop relying on the app because they can't trust what the AI produced.

**Why it happens:**
Demo-mode AI classification looks impressive. Edge cases (paywalled articles, PDFs, non-English content, error pages, redirect chains) are not tested during development. No feedback mechanism is built because "AI is usually right."

**How to avoid:**
Build human-override into the data model from day one: every AI-generated field (description, tags, category) must be editable by the user, with the edit stored separately so the AI original can be recovered. Show confidence scores or source indicators ("AI suggested" vs. "you edited"). Implement a "re-classify" action for individual bookmarks. Treat AI output as a suggestion, not ground truth. For the rule-based fallback path (no LLM key), ensure it produces something useful — keyword extraction from URL structure + title — rather than empty fields.

**Warning signs:**
- Description and tag fields are read-only in the UI
- No "re-classify" or "edit tags" functionality in the roadmap
- Rule-based path returns empty strings when no patterns match
- Classification failures are silently swallowed — no error state shown to user

**Phase to address:**
Classification engine phase AND UI phase. Override capability must be designed in both layers simultaneously.

---

### Pitfall 10: Browser Extension Manifest V3 Surprises

**What goes wrong:**
The browser extension attempts to make fetch requests or use XMLHttpRequest from a content script, hitting CORS restrictions. Or it relies on persistent background listeners that Manifest V3 disallows (service workers have limited lifetimes). The extension works during development but intermittently fails in production when the service worker is terminated.

**Why it happens:**
Manifest V2 patterns (persistent background pages, unrestricted XHR from content scripts) don't translate directly to V3. Many tutorials still show V2 patterns. The CORS restriction on content scripts is frequently missed.

**How to avoid:**
Content scripts must use the extension messaging API to delegate network requests to the service worker background script. The service worker can make fetch requests without CORS restriction. For any operation requiring more than a few seconds (scraping, classification), the extension sends the URL to the server-side API and returns immediately — the extension itself should not do heavy processing. Use the `chrome.storage.session` API for short-lived state and `chrome.storage.local` for persistent state. Test the extension after leaving the browser idle for several minutes to verify service worker restart behavior.

**Warning signs:**
- Extension content script contains `fetch()` calls to external URLs
- Background script uses `setInterval` or persistent connections assuming they'll survive service worker termination
- Extension tested only immediately after installation, not after idle periods

**Phase to address:**
Browser extension phase. MV3 architecture decisions must precede any extension implementation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Synchronous scraping (block on fetch before save) | Simple code, consistent state | Users wait 2-5+ seconds per save; abandonment at key moment | Never — async save is table stakes |
| ILIKE search without FTS index | Fast to implement | Full-table scan; 10K+ records becomes unacceptably slow | Never if unbounded scale is a requirement |
| SVG-only force graph | Easiest D3 integration | Freezes at 1,000+ nodes | Only if graph is explicitly capped at <500 nodes |
| Plain-text API key storage | No encryption complexity | Key theft = user's LLM account billed arbitrarily | Never |
| Fixed enum taxonomy | Simple schema | Cannot add user tags; AI/rule divergence creates chaos | Only in a throw-away prototype |
| Single deployment target for web + workers | One platform to manage | Serverless cannot run persistent monitors | Never for uptime monitoring |
| Synchronous uptime ping loop | Simple cron script | Thundering herd; misses pings under load | Never — use a job queue |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenAI / Anthropic API (BYOK) | Passing user API key in URL query param or logging it in request body | Always treat key as a credential: encrypted at rest, stripped from logs, never in URL, masked in UI |
| Headless browser (Playwright) | Launching a new browser instance per scrape request | Maintain a browser pool; launch once, reuse contexts; close contexts not the whole browser |
| D3 force graph | Running simulation on the main thread blocking UI | Use Web Workers for simulation computation; render results on Canvas in main thread |
| PostgreSQL FTS | Building tsvector from application layer on every query | Use a generated column + GIN index; let the DB maintain it automatically |
| Browser extension to server | Content script fetching server API directly (CORS blocked) | Route all external requests through the extension service worker background script |
| Free hosting (Render free tier) | Assuming free tier web services stay alive for uptime monitoring | Free tier spins down after 15 min idle; use paid worker ($7/mo) or design for missed pings |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| SVG-based force graph | Tab freezes, animation stutters, high CPU | Use Canvas/WebGL renderer; implement viewport culling | ~1,000 nodes (SVG), ~500 nodes with edges |
| Unbounded uptime ping loop | Workers back up; recent bookmarks not monitored; 429 errors from targets | Job queue with concurrency limit + per-user cap + deduplication | ~500 concurrent monitors without a queue |
| Full-table search scan (ILIKE) | Search latency spikes; DB CPU spikes on search | GIN index + tsvector from schema creation | ~10,000 records per user |
| Eager graph edge computation | Graph API response times out | Pre-compute edges on save/update, store in adjacency table; don't compute on read | ~1,000 bookmarks per user |
| No scrape timeout | Save hangs indefinitely; worker blocked | Hard timeout on all HTTP fetches (5s fast path, 30s headless path); circuit breaker for repeat-failing domains | Any single slow/hanging server |
| Loading all bookmarks for graph | Initial page load slow; memory pressure | Paginate the bookmark list view; lazy-load graph data; virtualize long lists | ~500 bookmarks |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing BYOK API keys in plain text | Key theft enables arbitrary billing on user's LLM account | AES-256 encryption at rest; master key in environment, not DB |
| Proxying LLM requests server-side with stored keys without rate limiting | Attacker submits many requests, exhausting victim's LLM quota | Rate limit LLM-proxied requests per user per day; alternatively, prefer client-side direct calls (browser sends key directly to LLM provider) |
| Scraper SSRF (Server-Side Request Forgery) | Attacker submits internal network URLs (e.g., `http://169.254.169.254/`) to probe internal infrastructure | Validate and blocklist non-public IP ranges before any outbound scrape request; reject RFC-1918 and link-local addresses |
| Missing `user_id` filter on bookmark queries | User A can access User B's bookmarks by guessing IDs | Enforce row-level security in every query; never query by bookmark ID alone |
| Extension storing API key in `localStorage` accessible to page scripts | Malicious page script reads extension storage | Store sensitive data in `chrome.storage.local` (extension-only) not the page's localStorage |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Blocking save on AI processing | Users wait 3-10 seconds; feel the app is slow; abandon | Save immediately, enrich async, update UI when ready |
| Silent classification failure | Bookmark saved with blank description and no tags; user doesn't know what happened | Show explicit "Processing..." state; show "Could not extract content" message on failure with manual edit prompt |
| No way to correct wrong AI tags | User sees a bookmark tagged "cooking" when it's about programming; has no recourse | All AI-generated fields must be editable; show "AI suggested" label |
| Graph showing all bookmarks by default | Graph is unusable at any meaningful collection size | Default graph view to "top 100 most connected nodes" with controls to expand |
| BYOK key entry with no feedback | User pastes wrong key; no validation until they try to use an LLM feature | Validate key format immediately on entry; optionally make a test API call to confirm validity |
| Uptime status with no context | A red dot appears but user doesn't know when it went down or if it's transient | Show last-checked timestamp and a simple "down for X checks" counter even in v1 |

---

## "Looks Done But Isn't" Checklist

- [ ] **Scraping:** Fast path returns valid content for JavaScript-heavy SPAs — verify with a React app URL, not just Wikipedia
- [ ] **Classification:** Rule-based path produces non-empty tags for URLs with no og:description — verify with a minimal HTML page
- [ ] **BYOK:** API key is masked (not returned in full) in the GET user settings response — check the API response body
- [ ] **Graph:** Performance tested at 1,000 nodes, not just seed data — run a load test with synthetic bookmarks
- [ ] **Uptime monitor:** Worker survives a restart and resumes outstanding pings without duplication — simulate a process crash
- [ ] **Search:** Search query includes `user_id` filter before the FTS condition — check the query plan with EXPLAIN ANALYZE
- [ ] **Full-text search:** Result ranking is meaningful — verify that a specific title keyword ranks above a generic description match
- [ ] **Browser extension:** Works correctly after browser idle for 5 minutes — the service worker may have been terminated
- [ ] **Tag normalization:** "JavaScript" and "javascript" and "JS" don't create three separate tags — verify normalization in the tag save path
- [ ] **Scrape SSRF:** Submitting `http://localhost/` or `http://169.254.169.254/` as a bookmark URL returns an error, not a scrape attempt

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SVG graph at scale, needs Canvas rewrite | HIGH | Full graph component rewrite; existing data is fine, rendering layer must be replaced |
| Classification taxonomy enum, needs flexible tags | HIGH | Schema migration across all bookmark-tag rows; backfill source field; normalize existing tags |
| Plain-text API key storage, needs encryption | MEDIUM | Write migration to encrypt all stored keys; rotate master key in environment; notify users to re-verify their key works |
| ILIKE search, needs FTS index | MEDIUM | Add tsvector generated column + GIN index (can be done online in Postgres); rewrite search queries |
| Synchronous save, needs async queue | HIGH | Restructure save flow; add job queue infrastructure; update frontend to handle async enrichment state |
| Vercel-only deployment, needs persistent worker | MEDIUM | Add a second deployment target (Render/Railway) for worker; update CI/CD pipeline |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SPA scraping failure | Core scraping/classification phase | Test against 10 known JS-heavy URLs (React apps, Twitter, GitHub) |
| Blocking save on scraping | Phase 1 (save flow architecture) | Save latency < 200ms regardless of scrape outcome |
| Graph SVG scale collapse | Graph visualization phase | Render 2,000 nodes without frame drops below 30fps |
| BYOK key exposure | Auth/settings phase | API response audit; grep logs for key patterns |
| Uptime monitoring at scale | Uptime monitoring phase | Simulate 1,000 concurrent monitors; verify no jobs dropped |
| Classification taxonomy lock-in | Phase 1 (database schema) | Schema review: no `ENUM` for tags; source field present |
| FTS performance | Phase 1 (database schema) | EXPLAIN ANALYZE on search query at 50,000 records |
| Free hosting + persistent worker mismatch | Infrastructure setup (Phase 1) | Worker process runs after 20 min idle; uptime pings continue |
| AI over-reliance / no override | Classification phase + UI phase | Manual edit path exists for description, tags, category |
| MV3 extension surprises | Browser extension phase | Extension saves a bookmark after browser idle for 10 minutes |
| SSRF via scraper | Core scraping phase | Blocklist test: internal URLs return error, not HTTP response |

---

## Sources

- [Web Scraping in 2025: Bypassing Modern Bot Detection](https://medium.com/@sohail_saifii/web-scraping-in-2025-bypassing-modern-bot-detection-fcab286b117d) — scraping failure modes
- [Stop Getting Blocked: 10 Common Web-Scraping Mistakes](https://www.firecrawl.dev/blog/web-scraping-mistakes-and-fixes) — MEDIUM confidence
- [Why SPAs Still Struggle with SEO (2025)](https://dev.to/arkhan/why-spas-still-struggle-with-seo-and-what-developers-can-actually-do-in-2025-237b) — SPA og:tag failure modes
- [Metascraper: unified metadata from the web](https://metascraper.js.org) — existing metadata extraction library
- [The Best Libraries for Large Force-Directed Graphs on the Web](https://weber-stephen.medium.com/the-best-libraries-and-methods-to-render-large-network-graphs-on-the-web-d122ece2f4dc) — SVG vs Canvas thresholds
- [D3-Force Directed Graph Layout Optimization](https://dzone.com/articles/d3-force-directed-graph-layout-optimization-in-neb) — performance optimization patterns
- [What is BYOK for LLMs?](https://jomasego.medium.com/what-is-byok-bring-your-own-key-for-llms-acb78b154512) — BYOK patterns and risks
- [BYOK Security Explained — IronCore Labs](https://ironcorelabs.com/byok/) — encryption architecture
- [Render vs Vercel comparison](https://render.com/docs/render-vs-vercel-comparison) — hosting platform limitations
- [Vercel backend limitations](https://northflank.com/blog/vercel-backend-limitations) — serverless background job constraints
- [Chrome Extensions: Manifest V3 Changes and Challenges](https://blog.fordefi.com/google-manifest-v3-changes-challenges) — MV3 pitfalls
- [Offscreen Documents in Manifest V3](https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3) — official Chrome docs, HIGH confidence
- [SQLite 4.0 Production Benchmarks and Pitfalls (2025)](https://markaicode.com/sqlite-4-production-database-benchmarks-pitfalls/) — FTS and scale considerations
- [Pocket Bookmark Manager Shutdown (2025)](https://webcull.com/blog/2025/05/pocket-is-shutting-down) — lessons from failed bookmark managers

---
*Pitfalls research for: Intelligent bookmark manager (Pageslop)*
*Researched: 2026-03-16*
