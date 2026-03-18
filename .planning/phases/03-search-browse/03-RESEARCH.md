# Phase 3: Search & Browse - Research

**Researched:** 2026-03-17
**Domain:** Client-side filtering, Next.js 15 routing, pg-boss import queue, Netscape HTML bookmark parsing, file download APIs
**Confidence:** HIGH

## Summary

Phase 3 is almost entirely a frontend and integration phase built on top of already-working infrastructure. Search is client-side substring filtering on the SWR-cached `LinkWithTags[]` array — no new API endpoints, no backend search index. The grouped view is a third `ViewMode` variant in `LinkGrid.tsx` that groups the already-filtered array by `link.category`. Tag filtering uses `useSearchParams` to read a `?tag=` query param, driving the same client-side filter.

Import and export are the only truly new backend concerns. Import parses Netscape bookmark HTML (browser-exported format) on the server, creates link rows, then enqueues `scrape` jobs through the existing pg-boss pipeline — the same path as pasting a URL manually. Export queries `listLinksWithTags` and serializes to JSON or Netscape HTML, streamed as a file download. Both live on the Settings page, which is a new Next.js route `/dashboard/settings`.

The key discipline for this phase is keeping search/filter entirely in-memory on the client. The SWR hook already loads all links; filtering them requires no API changes. The only gotcha is `useSearchParams` requiring Suspense in Next.js 15 App Router — the LinkGrid component must be wrapped in `<Suspense>` or the search-param reading must be lifted to a wrapper.

**Primary recommendation:** Implement search/filter as pure in-memory transforms on the `links` array from `useLinks()`. Add a third `ViewMode` ('grouped') to the existing toggle. Use `useSearchParams` + `useRouter` for the tag URL param. Add Settings and Tags routes. Implement import/export as new API routes reusing existing pg-boss queue infrastructure.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Search input integrated in the top bar alongside the URL paste input — always visible on the dashboard
- Client-side filtering: filter the already-loaded SWR data in-memory as user types (instant, no API calls)
- Equal substring matching across title, tags, description, URL, and domain — no weighted ranking
- Search works in all view modes (grid, list, grouped) — filters results within the current view
- No results: simple "No links match 'xyz'" message with option to clear search
- Third view toggle added alongside Grid/List: a "Grouped" toggle on the dashboard
- Grouped view shows collapsible category sections with link count in header (e.g., "Technology (12)")
- All sections start expanded by default; user can collapse any
- Links within each category section display using the current sub-mode (grid cards or list rows)
- Search filters within grouped view — hides non-matching links and collapses empty categories
- Tags sidebar page enabled (/dashboard/tags) — shows alphabetical list of all tags with link count badges
- Filter input at top of Tags page to narrow the tag list
- Clicking a tag navigates to /dashboard?tag=react — normal dashboard filtered to that tag
- Active tag filter shown as a dismissable chip below the search bar
- Tag pills on link cards are clickable — clicking applies that tag as a filter (same as navigating from Tags page)
- Single tag filter only — one active tag at a time, clicking another tag switches the filter
- Import and Export live on the Settings page under a "Data Management" section
- Settings page enabled in sidebar navigation
- Bookmark import: file picker + drag-and-drop for HTML bookmarks files (Chrome/Firefox/Safari)
- Large imports processed asynchronously via pg-boss queue with progress feedback ("Imported 142 of 500")
- User can navigate away during import — processing continues in background
- Imported bookmarks go through full enrichment pipeline (scraping + tags + descriptions)
- Duplicate bookmarks handled per existing behavior (warn, allow force-save)
- Export: two buttons — "Export JSON" (full data: URL, title, description, tags, category, dates) and "Export HTML" (Netscape bookmark format, browser-compatible)

### Claude's Discretion
- Exact search input design (icon placement, clear button behavior)
- Grouped view collapse/expand animation
- Tags page sort order (alphabetical vs by count)
- Import progress polling interval
- Export file naming convention
- Settings page layout beyond Data Management section

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SRCH-01 | User can search across titles, tags, descriptions, and URLs | Client-side substring filter on `LinkWithTags[]` from `useLinks()`. Filter function checks `title`, `description`, `url`, `domain`, and `tags[].name` fields. |
| SRCH-02 | User can view links in a grouped/clustered layout organized by classification | Third `ViewMode` ('grouped') in `LinkGrid`. Group filtered links by `link.category`. Collapsible sections using local `useState` per category. |
| SRCH-03 | User can view links in a list/card layout | Already implemented in Phase 2. This phase extends it with search/filter integration. Verify the existing toggle works with filtered results. |
| SRCH-04 | User can filter links by tag | `?tag=react` URL query param read via `useSearchParams`. Dashboard filters SWR data to links where `tags.some(t => t.name === tag)`. Tags page at `/dashboard/tags` lists all tags with counts. |
| LINK-05 | User can import bookmarks from browser export (HTML file) | New API route `POST /api/import/bookmarks`. Parse Netscape HTML format server-side. Create link rows, enqueue `scrape` jobs via existing pg-boss. Track import progress in DB. |
| LINK-06 | User can export their links as JSON or HTML | New API routes `GET /api/export/json` and `GET /api/export/html`. Query `listLinksWithTags`, serialize, return as file download with appropriate Content-Disposition header. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| swr | ^2.4.1 | Already in use — client-side data cache that search/filter operates on | Project standard; all link mutations use it |
| next/navigation `useSearchParams` | Next.js 15 | Read `?tag=` from URL without page reload | Built-in Next.js App Router API |
| next/navigation `useRouter` | Next.js 15 | Push tag filter to URL on tag pill click | Built-in — enables shareable filtered URLs |
| drizzle-orm | ^0.45.1 | New export/import DB queries | Project standard ORM |
| pg-boss | ^12.14.0 | Enqueue scrape jobs for imported bookmarks | Project standard queue; already handles scrape+enrich pipeline |
| cheerio | ^1.2.0 | Already installed — can parse Netscape HTML bookmark files | Already in project for scraping |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.577.0 | Search icon, X clear button, layers icon for grouped view | Already installed; use `Search`, `X`, `Layers` icons |
| @radix-ui (via radix-ui ^1.4.3) | installed | Collapsible sections in grouped view | `Collapsible`/`CollapsibleContent` from radix-ui |
| sonner | ^2.0.7 | Import progress toasts or notifications | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side filtering | Server-side search API with DB query | Server approach adds latency and API complexity; client-side is instant since all links are already loaded |
| cheerio for bookmark parsing | Custom regex parser | Cheerio is already installed and handles malformed HTML better than regex |
| URL query params for tag filter | React state only | URL params enable bookmark-sharing and back-button behavior; no cost |
| Streaming file download via Response | Third-party library | Built-in Response with headers is sufficient for JSON/HTML export |

**Installation:** No new npm packages required. All needed libraries are already installed.

```bash
# No new dependencies needed for this phase
```

---

## Architecture Patterns

### Recommended Project Structure

New files to create:
```
src/
├── app/
│   └── (dashboard)/
│       └── dashboard/
│           ├── tags/
│           │   └── page.tsx          # /dashboard/tags — Tags browse page
│           └── settings/
│               └── page.tsx          # /dashboard/settings — Settings + Data Management
├── api/
│   ├── import/
│   │   └── bookmarks/
│   │       └── route.ts              # POST — parse HTML, enqueue scrape jobs
│   ├── import/
│   │   └── progress/
│   │       └── route.ts              # GET — import job progress polling
│   └── export/
│       ├── json/
│       │   └── route.ts              # GET — JSON download
│       └── html/
│           └── route.ts              # GET — Netscape HTML download
└── components/
    └── links/
        ├── SearchInput.tsx            # Search bar component (new)
        ├── TagFilterChip.tsx          # Active tag dismissable chip (new)
        ├── GroupedView.tsx            # Grouped-by-category layout (new)
        └── LinkGrid.tsx               # MODIFIED: add search state, grouped mode, tag param
```

New DB table or columns (for import progress tracking):
```
src/lib/db/
└── schema.ts   # MODIFIED: add import_jobs table
```

### Pattern 1: Client-Side Search + Filter Pipeline

**What:** A single `useMemo` transforms the raw `links` array from `useLinks()` into a filtered subset, driven by `searchQuery` state and `tagFilter` from URL params.

**When to use:** Whenever all data is already in memory. Avoids API round-trips. Works up to ~10,000 items in a browser without performance issues.

**Example:**
```typescript
// In LinkGrid.tsx or a custom hook
const searchQuery = useSearchInputState() // local state
const tagFilter = useSearchParams().get('tag') // URL param

const filteredLinks = useMemo(() => {
  let result = links

  // Tag filter (exact match, case-insensitive)
  if (tagFilter) {
    result = result.filter(l =>
      l.tags.some(t => t.name.toLowerCase() === tagFilter.toLowerCase())
    )
  }

  // Search filter (substring, case-insensitive, across all text fields)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    result = result.filter(l =>
      l.title?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.url.toLowerCase().includes(q) ||
      l.domain?.toLowerCase().includes(q) ||
      l.tags.some(t => t.name.toLowerCase().includes(q))
    )
  }

  return result
}, [links, searchQuery, tagFilter])
```

### Pattern 2: Grouped View Rendering

**What:** Group `filteredLinks` by `link.category`, then render a collapsible section per category. Collapse state is local `useState<Record<string, boolean>>` in `GroupedView`.

**When to use:** When `viewMode === 'grouped'`.

**Example:**
```typescript
// Group links by category
const grouped = useMemo(() => {
  const map = new Map<string, LinkWithTags[]>()
  for (const link of filteredLinks) {
    const cat = link.category ?? 'Other'
    const existing = map.get(cat) ?? []
    existing.push(link)
    map.set(cat, existing)
  }
  return map
}, [filteredLinks])

// Each section:
// <CollapsibleSection key={category} title={`${category} (${links.length})`}>
//   {subMode === 'grid' ? <GridLayout links={links} /> : <ListLayout links={links} />}
// </CollapsibleSection>
```

### Pattern 3: Tag URL Param Navigation

**What:** Tag pill click calls `router.push('/dashboard?tag=react')`. Dashboard reads param with `useSearchParams()`. Clicking same tag again or the dismiss chip calls `router.push('/dashboard')` to clear.

**When to use:** Tag pills on cards, tag list on Tags page.

**CRITICAL — Next.js 15 Suspense requirement:** `useSearchParams()` requires the component to be wrapped in `<Suspense>`. The component that calls `useSearchParams` must be a Client Component with a Suspense boundary in its parent. `LinkGrid` is already a Client Component (`'use client'`). The Suspense wrapper should be added in `dashboard/page.tsx`:
```tsx
// dashboard/page.tsx
import { Suspense } from 'react'
import { LinkGrid } from '@/components/links/LinkGrid'

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen p-6">
      <h1 className="text-[20px] font-semibold leading-[1.2] mb-6">All Links</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <LinkGrid />
      </Suspense>
    </div>
  )
}
```

### Pattern 4: Netscape Bookmark HTML Parsing

**What:** Browser bookmark exports use the NETSCAPE-Bookmark-file-1 format. Cheerio can parse it. Extract `<a>` tags with `href`, `add_date`, and inner text.

**When to use:** `POST /api/import/bookmarks` route handler.

**Example:**
```typescript
import * as cheerio from 'cheerio'

interface ParsedBookmark {
  url: string
  title: string
  addedAt?: Date
}

function parseNetscapeBookmarks(html: string): ParsedBookmark[] {
  const $ = cheerio.load(html)
  const bookmarks: ParsedBookmark[] = []

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    try {
      new URL(href) // validate
      const addDate = $(el).attr('add_date')
      bookmarks.push({
        url: href,
        title: $(el).text().trim() || href,
        addedAt: addDate ? new Date(parseInt(addDate) * 1000) : undefined,
      })
    } catch {
      // skip invalid URLs
    }
  })

  return bookmarks
}
```

### Pattern 5: Import Progress Tracking

**What:** Store import job state in a DB table. API route returns progress via polling. Worker updates counts as it processes.

**Schema:**
```typescript
// In schema.ts — add import_jobs table
export const importJobs = pgTable('import_jobs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending | processing | complete | error
  totalUrls: integer('total_urls').notNull().default(0),
  processedUrls: integer('processed_urls').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

**Progress polling:** Client polls `GET /api/import/progress?jobId=xyz` every 2–3 seconds (same pattern as the existing SWR pending-link polling in `useLinks`). Response: `{ status, processedUrls, totalUrls }`.

**Drizzle integer import:** `integer` is not currently imported in `schema.ts`. Must add `import { pgTable, text, timestamp, unique, index, integer } from 'drizzle-orm/pg-core'`.

### Pattern 6: File Export as Download

**What:** API route builds the file content in memory, returns it with `Content-Disposition: attachment` header so the browser triggers a download dialog.

**When to use:** Export JSON / Export HTML buttons on Settings page.

**Example:**
```typescript
// GET /api/export/json
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const links = await listLinksWithTags(session.user.id)
  const json = JSON.stringify(links, null, 2)

  return new Response(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="pageslop-export-${Date.now()}.json"`,
    },
  })
}
```

**Netscape HTML export format:**
```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><A HREF="https://example.com" ADD_DATE="1700000000">Example Site</A>
</DL><p>
```

### Pattern 7: All-Tags Query for Tags Page

**What:** Tags page needs all tags for a user with a count of how many links each tag is on.

**Query approach (Drizzle):**
```typescript
// New function in queries/tags.ts
export async function listTagsWithCount(userId: string): Promise<{ name: string; count: number }[]> {
  const rows = await db
    .select({
      name: tags.name,
      count: sql<number>`count(${linkTags.linkId})::int`,
    })
    .from(tags)
    .leftJoin(linkTags, eq(tags.id, linkTags.tagId))
    .where(eq(tags.userId, userId))
    .groupBy(tags.name)
    .orderBy(tags.name) // alphabetical; Claude's discretion

  return rows
}
```

This requires `sql` from `drizzle-orm` (already imported in the worker) and a new import in the query file.

### Anti-Patterns to Avoid

- **Calling a search API on each keystroke:** The decision is client-side filtering. Never add debounced fetch calls for search.
- **Storing search query in URL:** Search is ephemeral local state only. Tag filter uses URL (intentional). Search does not — keep them separate.
- **Processing import synchronously in the API route:** Large bookmark files (500+ URLs) would timeout a Next.js API route. Always enqueue to pg-boss immediately and return a job ID.
- **Re-fetching all links after each import step:** The existing SWR polling pattern (poll while `hasPending`) already handles newly-added pending links appearing in the dashboard as they complete. No special post-import refresh needed.
- **Modifying ViewMode type without updating localStorage:** The `STORAGE_KEY` ('pageslop-view-mode') stores only 'grid' or 'list' today. Adding 'grouped' must update the localStorage validation guard.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML bookmark file parsing | Custom regex over bookmark HTML | Cheerio (already installed) | Netscape format is quirky; browsers export slightly different variants; cheerio handles malformed HTML gracefully |
| File download trigger | JavaScript `<a>` element hack or window.open | `Content-Disposition: attachment` Response header | Server-side is simpler, works for large files, no blob URL memory management |
| Import job progress UI | WebSocket or SSE | SWR polling on `GET /api/import/progress` | Consistent with existing pending-link polling pattern; no new infrastructure |
| Tag count aggregation | Load all linkTags and count in JS | Single SQL GROUP BY query | DB does it in one query; JS approach is O(n) per user |
| Collapsible sections | Custom accordion with CSS transitions | Radix UI Collapsible (already installed via `radix-ui` package) | Accessible by default; keyboard navigation works |

**Key insight:** This phase builds on top of existing patterns. Don't reach for new libraries. The existing SWR + pg-boss + drizzle stack handles everything. The biggest temptation is adding a search index (Lunr.js, FlexSearch) — that is premature; client-side substring matching is sufficient for personal bookmark collections.

---

## Common Pitfalls

### Pitfall 1: useSearchParams Without Suspense in Next.js 15
**What goes wrong:** `useSearchParams()` throws a runtime error in Next.js 15 App Router if the calling component is not inside a `<Suspense>` boundary. This causes the dashboard page to crash when the tag filter is active.
**Why it happens:** Next.js 15 requires Suspense for any dynamic rendering. `useSearchParams` is considered dynamic.
**How to avoid:** Wrap `<LinkGrid />` in `<Suspense>` in `dashboard/page.tsx`. Do this from the start, not as a fix.
**Warning signs:** Console error: "useSearchParams() should be wrapped in a suspense boundary".

### Pitfall 2: ViewMode localStorage Type Guard
**What goes wrong:** On load, the stored localStorage value is checked: `if (stored === 'grid' || stored === 'list')`. Adding 'grouped' without updating this guard means users who set grouped view will see it not persist (falls back to default).
**Why it happens:** The guard is a hardcoded string check in `LinkGrid.tsx`.
**How to avoid:** Update the guard to `if (stored === 'grid' || stored === 'list' || stored === 'grouped')` and update the `ViewMode` type to `'grid' | 'list' | 'grouped'`.
**Warning signs:** Grouped mode doesn't persist after page reload.

### Pitfall 3: Import File Size Limits
**What goes wrong:** Next.js API routes have a default body size limit of 4MB. Large bookmark files with thousands of entries can exceed this.
**Why it happens:** Default Next.js body parser config.
**How to avoid:** Configure `export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }` in the import route, or use `Request.formData()` which handles multipart without the body parser limit. Using `FormData` + `File` is the recommended approach for file uploads in Next.js 15 App Router route handlers (no config needed — App Router doesn't use the Pages `config` pattern).
**Warning signs:** 413 Content Too Large errors on imports.

### Pitfall 4: Grouped View With Empty Category
**What goes wrong:** Links with `category === null` (pending links not yet enriched) don't belong to any category bucket and are silently dropped from grouped view.
**Why it happens:** Grouping by `link.category` treats `null` as no bucket.
**How to avoid:** Use `link.category ?? 'Uncategorized'` or `'Other'` as the fallback key. Display these last in the grouped layout.
**Warning signs:** Users report links disappearing in grouped view but showing in grid/list.

### Pitfall 5: pg-boss Queue Names for Import
**What goes wrong:** Using an undeclared queue name ('import') in `boss.send()` without calling `boss.createQueue('import')` first will silently fail in pg-boss v12.
**Why it happens:** pg-boss v12 requires explicit queue creation before sending.
**How to avoid:** Call `await boss.createQueue('import')` in both the API route sender and the worker startup — same pattern as 'scrape' and 'enrich' queues.
**Warning signs:** Import jobs submitted but never processed; no error in logs.

### Pitfall 6: Export for Large Collections
**What goes wrong:** Building JSON in memory for a user with 10,000 links and returning it all at once can cause memory spikes in the serverless API route.
**Why it happens:** `JSON.stringify` of a large array materializes everything in memory simultaneously.
**How to avoid:** For v1, this is acceptable — personal collections are unlikely to exceed a few thousand links. No streaming needed. If it becomes an issue, use `Response` with a `ReadableStream`. Note this as a known limitation.
**Warning signs:** API timeout or OOM on export for power users.

---

## Code Examples

### Search Filter Logic (Pure Function)

```typescript
// src/lib/utils/search.ts — testable pure function
export function filterLinks(
  links: LinkWithTags[],
  query: string,
  tagFilter: string | null
): LinkWithTags[] {
  let result = links

  if (tagFilter) {
    const normalizedTag = tagFilter.toLowerCase()
    result = result.filter(l =>
      l.tags.some(t => t.name.toLowerCase() === normalizedTag)
    )
  }

  if (query.trim()) {
    const q = query.toLowerCase()
    result = result.filter(l =>
      l.title?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.url.toLowerCase().includes(q) ||
      l.domain?.toLowerCase().includes(q) ||
      l.tags.some(t => t.name.toLowerCase().includes(q))
    )
  }

  return result
}
```

### Tag Navigation (clickable tag pills on cards)

```typescript
// In LinkCard.tsx — add onClick to tag Badge
import { useRouter } from 'next/navigation'

// Inside component:
const router = useRouter()

function handleTagClick(e: React.MouseEvent, tagName: string) {
  e.stopPropagation() // prevent card detail from opening
  router.push(`/dashboard?tag=${encodeURIComponent(tagName)}`)
}

// In JSX:
<Badge
  key={tag.id}
  variant="secondary"
  className="text-xs cursor-pointer hover:bg-secondary/80"
  onClick={(e) => handleTagClick(e, tag.name)}
>
  {tag.name}
</Badge>
```

### Import Route Skeleton

```typescript
// src/app/api/import/bookmarks/route.ts
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file uploaded' }, { status: 400 })

  const html = await file.text()
  const bookmarks = parseNetscapeBookmarks(html)

  // Create import job record
  const jobId = crypto.randomUUID()
  await db.insert(importJobs).values({
    id: jobId,
    userId: session.user.id,
    totalUrls: bookmarks.length,
    status: 'processing',
  })

  // Enqueue all URLs through existing scrape pipeline
  // (each scrape job updates processed count on completion)
  for (const bookmark of bookmarks) {
    const existing = await findDuplicate(session.user.id, bookmark.url)
    if (!existing) {
      const link = await insertLink(session.user.id, bookmark.url)
      await enqueueScrapeJob(link.id, bookmark.url)
    }
  }

  return Response.json({ jobId, total: bookmarks.length }, { status: 202 })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pages/` router `getServerSideProps` + `router.query` | App Router `useSearchParams()` + Suspense | Next.js 13+ | URL params require Suspense boundary in client components |
| `config.api.bodyParser` for file uploads in Pages router | `Request.formData()` in App Router route handlers | Next.js 13+ | No config needed; multipart handled natively |
| `pg-boss.work()` default concurrency | `localConcurrency` replaces `teamSize` | pg-boss v9+ | Project already uses `localConcurrency` correctly |
| Global `integer` from drizzle-orm | `integer` from `'drizzle-orm/pg-core'` | Current | Need to import for import_jobs table; not currently in schema.ts |

**Deprecated/outdated:**
- `Pages Router config.api` pattern: Not applicable in App Router (`src/app/api/` routes use Web API Request/Response directly).
- `next/router` `useRouter()` from Pages Router: Project uses `next/navigation` `useRouter()` — correct for App Router.

---

## Open Questions

1. **Import progress tracking granularity**
   - What we know: The worker processes scrape jobs asynchronously; there is no callback from worker to API about completion.
   - What's unclear: The worker does not update an `import_jobs.processed_urls` counter today. There are two options: (A) add a `importJobId` field to scrape job data and have the worker increment the counter on completion, or (B) poll the count of `status='ready'` links that were created during the import window.
   - Recommendation: Option A is cleaner — pass `importJobId` in the pg-boss job data and have the worker call `UPDATE import_jobs SET processed_urls = processed_urls + 1` after each scrape completes. This requires a minor addition to the worker's scrape handler.

2. **Tags page — which query to use**
   - What we know: The Tags page needs all tags with their link count. `listLinksWithTags` loads all links (which includes tags) and could be used client-side to compute counts, or a dedicated DB query can do it.
   - What's unclear: Client-side computation from SWR data vs. a new `GET /api/tags` route.
   - Recommendation: Add a new `GET /api/tags` route that returns `{ name, count }[]` from a GROUP BY query. The Tags page has its own SWR hook for this endpoint. Avoids loading all link data just to count tags on a separate page.

3. **Sidebar active state for tags/settings routes**
   - What we know: `Sidebar.tsx` has hardcoded `href: '#'` and `disabled: true` for Tags and Settings nav items.
   - What's unclear: The active state check uses `pathname.startsWith(item.href)` — with real hrefs this works automatically.
   - Recommendation: Simple fix — update `navItems` array to set `href: '/dashboard/tags'` and `href: '/dashboard/settings'` and `disabled: false`. No new logic needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `node ~/.nvm/versions/node/v20.20.1/bin/node $(which vitest) run tests/search/ --reporter=verbose` |
| Full suite command | `node ~/.nvm/versions/node/v20.20.1/bin/npx vitest run` |

**Corrected quick run:** `npx vitest run tests/ --reporter=verbose`

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-01 | `filterLinks()` returns matching links across all text fields | unit | `npx vitest run tests/search/filter-links.test.ts` | ❌ Wave 0 |
| SRCH-01 | `filterLinks()` returns empty array when no matches | unit | `npx vitest run tests/search/filter-links.test.ts` | ❌ Wave 0 |
| SRCH-02 | Grouped view groups links by category (pure transform) | unit | `npx vitest run tests/search/group-links.test.ts` | ❌ Wave 0 |
| SRCH-02 | Grouped view hides empty categories after filtering | unit | `npx vitest run tests/search/group-links.test.ts` | ❌ Wave 0 |
| SRCH-04 | `filterLinks()` with tagFilter returns only tag-matching links | unit | `npx vitest run tests/search/filter-links.test.ts` | ❌ Wave 0 |
| LINK-05 | `parseNetscapeBookmarks()` extracts URLs and titles from valid HTML | unit | `npx vitest run tests/import/parse-bookmarks.test.ts` | ❌ Wave 0 |
| LINK-05 | `parseNetscapeBookmarks()` skips invalid URLs | unit | `npx vitest run tests/import/parse-bookmarks.test.ts` | ❌ Wave 0 |
| LINK-06 | Export JSON route returns correct Content-Disposition header | unit | `npx vitest run tests/api/export.test.ts` | ❌ Wave 0 |
| LINK-06 | Export HTML produces valid Netscape bookmark format | unit | `npx vitest run tests/api/export.test.ts` | ❌ Wave 0 |
| SRCH-03 | Existing list/grid view — already implemented | manual-only | Visual verification in browser | n/a |

**Manual-only items:**
- Tag pill click navigates to `?tag=` URL (requires browser)
- Grouped view collapse/expand (UI interaction)
- Import drag-and-drop (UI interaction)
- Import progress counter increments (end-to-end)

### Sampling Rate
- **Per task commit:** `npx vitest run tests/search/ tests/import/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/search/filter-links.test.ts` — covers SRCH-01, SRCH-04 (pure filter function)
- [ ] `tests/search/group-links.test.ts` — covers SRCH-02 (grouping transform)
- [ ] `tests/import/parse-bookmarks.test.ts` — covers LINK-05 (Netscape HTML parser)
- [ ] `tests/api/export.test.ts` — covers LINK-06 (export route response headers + format)
- [ ] `tests/setup.ts` already exists — shared setup covers DB and pg-boss mocks

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `/src/lib/hooks/useLinks.ts`, `/src/components/links/LinkGrid.tsx`, `/src/components/layout/Sidebar.tsx`, `/src/workers/scrape.worker.ts`, `/src/lib/db/schema.ts`, `/src/lib/db/queries/links.ts`, `/src/lib/db/queries/tags.ts` — all existing patterns verified from source
- `/src/types/index.ts` — `LinkWithTags`, `Tag`, `CATEGORIES` type definitions confirmed
- `/vitest.config.ts` + `/tests/setup.ts` + existing test files — test infrastructure confirmed
- `package.json` — all installed dependencies confirmed (cheerio, pg-boss v12, drizzle-orm, SWR, next 15)

### Secondary (MEDIUM confidence)
- Next.js 15 App Router docs pattern: `useSearchParams` requires Suspense — widely documented in Next.js 13+ migration guides, consistent with App Router model
- pg-boss v12 `createQueue` requirement before `send` — confirmed by inspection of existing worker code which calls `boss.createQueue('scrape')` and `boss.createQueue('enrich')` before sending
- Netscape bookmark HTML format — established browser standard (circa 1996); Chrome, Firefox, Safari all output this format for bookmark exports

### Tertiary (LOW confidence)
- 4MB default body limit for Next.js App Router route handlers — widely reported but not verified against Next.js 15 docs directly; `Request.formData()` approach sidesteps this entirely

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed; no new dependencies needed
- Architecture: HIGH — patterns extrapolated directly from working Phase 2 code; same pg-boss and SWR conventions
- Pitfalls: HIGH for Pitfall 1 (useSearchParams/Suspense), HIGH for Pitfall 2 (localStorage guard), MEDIUM for Pitfall 5 (pg-boss queue naming) — inferred from existing worker pattern

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable stack — Next.js 15, pg-boss v12, drizzle-orm all stable releases)
