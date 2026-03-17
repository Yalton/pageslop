# Phase 02: Enrichment - Research

**Researched:** 2026-03-17
**Domain:** Rule-based NLP, keyword extraction, background job chaining, inline edit UI
**Confidence:** HIGH

---

## Summary

Phase 2 builds automatic enrichment on top of the Phase 1 scrape pipeline. Every saved link receives 2-4 tags, a brief description, and one of ~10 predefined categories — all derived from already-scraped `bodyText` stored in `raw_content`, with no external API required. The enrichment runs as a second pg-boss job (`enrich`) that fires immediately after the `scrape` job completes. The UI gains two new interactive patterns in `LinkDetail`: GitHub-style editable tag pills and an inline click-to-edit description.

No new third-party NLP library is required. The tag extraction can be done entirely with hand-written heuristics (stop-word removal, frequency counting, domain-aware hints) over the existing `bodyText`. If a library is needed, `natural` v8.1.1 (MIT, TypeScript types included) offers TF-IDF via `TfIdf.listTerms()` as a well-maintained fallback. The schema requires one new column (`category` on `links`) and two new API routes (tag CRUD on a link, description update on a link).

**Primary recommendation:** Implement enrichment as a pure TypeScript module (`src/lib/enrichment/`) with zero new runtime dependencies. Use a hand-written stop-word filter + frequency ranking for tags, the existing `og:description` / `meta description` as the primary description source, and a keyword-match scoring table for categorisation. Add the `natural` library only if heuristic quality proves insufficient.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tag generation**
- 2-4 tags per link, focused and high-signal
- Tags are topic + content-type mixed (e.g., "react", "tutorial", "documentation")
- Domain-aware hints: known domains (GitHub, YouTube, Wikipedia, etc.) contribute contextual tags
- Tags normalized to lowercase and merged ("React" and "react" become one tag)
- Tags stored with `source: 'rule'` in existing `tags` table

**Category taxonomy**
- Fixed predefined list of ~8-12 broad categories (Technology, News, Reference, Entertainment, Shopping, Social, Education, Finance, Health, Creative, etc.)
- Exactly one category per link — no multi-category
- "Other" fallback bucket when system can't confidently classify
- Category stored as a field on the `links` table

**Description generation**
- Use existing meta description (og:description or meta name=description) when available
- Only generate from body text when meta description is missing
- Generated descriptions: first meaningful paragraph extraction, ~150 chars (1-2 sentences)
- Scraper already stores `bodyText` (up to 5000 chars) in `raw_content` table

**Tag/description editing UX**
- Tag editing: detail view only (cards show tags read-only)
- Tag interaction: pills with X to remove, input field below to type and add new tags (GitHub labels style)
- User-added tags stored with `source: 'user'`
- Description editing: click-to-edit in detail view — text becomes textarea on click, save on blur or Enter
- Category editing: dropdown in detail view, user can reassign from the fixed category list

**Backfill**
- Retroactively enrich all existing links that have `raw_content` stored
- Run as a one-time background job on deployment

### Claude's Discretion

- Exact category list (aim for 8-12)
- Tag extraction algorithm (keyword extraction, TF-IDF, heuristics)
- Domain-to-tag mapping rules
- First-paragraph extraction heuristics
- Backfill job batching strategy

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLSF-01 | System auto-generates tags from page content using rule-based NLP (no LLM required) | Stop-word removal + frequency ranking on `bodyText`; domain-aware hint table; `tags` + `linkTags` tables already exist with `source` field |
| CLSF-02 | System auto-generates a brief description from page content (rule-based baseline) | Prefer `og:description`/`meta description` already scraped; fall back to first-paragraph heuristic on `bodyText`; `links.description` column already exists |
| CLSF-03 | System classifies links into categories based on content analysis | Keyword-score table mapping category → signal words; highest-score category wins; `category` column must be added to `links` table via migration |
| CLSF-04 | User can manually edit tags on any link | New API routes `POST /api/links/[id]/tags` and `DELETE /api/links/[id]/tags/[tagId]`; GitHub-pill UI with X + input in `LinkDetail`; SWR `mutate` for optimistic updates |
| CLSF-05 | User can manually edit description on any link | New API route `PATCH /api/links/[id]`; click-to-edit textarea in `LinkDetail`; save on blur/Enter; SWR `mutate` for optimistic updates |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg-boss | 12.14.0 | Background job queue | Already in use for `scrape` queue; second `enrich` queue follows same pattern |
| drizzle-orm | 0.45.1 | ORM + migrations | Already in use; `drizzle-kit generate` + `migrate` for the new `category` column |
| swr | 2.4.1 | Client-side cache + optimistic updates | Already in use for polling; `mutate()` handles tag/description updates without full page refresh |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| natural | 8.1.1 | TF-IDF keyword extraction | Optional fallback if hand-written heuristics produce poor tags; MIT, has TypeScript types |

**No new runtime dependencies are required.** The enrichment algorithm can be pure TypeScript over existing data.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written heuristics | `natural` TF-IDF | TF-IDF gives better relative term weighting but requires a corpus (multiple docs) to be meaningful; for single-document extraction, frequency + stop-word removal is equivalent and zero-dep |
| Hand-written heuristics | `compromise` (NLP) | 250 KB minified, English-only, POS tagging — powerful for noun extraction but overkill for a bookmark manager; adds worker bundle weight |
| pg-boss `enrich` queue | Inline in `scrape` worker | Inline is simpler but couples concerns; a separate queue enables independent retry, monitoring, and future LLM upgrade without touching scrape logic |

**Installation (if natural is added later):**
```bash
npm install natural
npm install --save-dev @types/natural
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── enrichment/
│   │   ├── classify.ts        # tag extraction + category scoring
│   │   ├── describe.ts        # description extraction heuristics
│   │   └── domain-hints.ts    # domain → tag mapping table
│   ├── db/
│   │   └── queries/
│   │       └── tags.ts        # insertTag, linkTagToLink, deleteLinkTag, getTagsForLink
│   └── queue/
│       └── boss.ts            # add enqueueEnrichJob alongside enqueueScrapeJob
├── workers/
│   └── scrape.worker.ts       # add enrich queue handler here (or new file)
├── app/
│   └── api/
│       └── links/
│           └── [id]/
│               ├── route.ts           # add PATCH for description/category
│               └── tags/
│                   ├── route.ts       # POST to add tag
│                   └── [tagId]/
│                       └── route.ts   # DELETE to remove tag
└── components/
    └── links/
        ├── LinkDetail.tsx     # add TagEditor + InlineDescriptionEdit
        ├── TagEditor.tsx      # GitHub-style pill + input
        └── InlineEdit.tsx     # click-to-edit textarea component
```

### Pattern 1: Enrich Job Chained from Scrape Worker
**What:** After scrape completes, send an `enrich` job using the same `boss` instance
**When to use:** Always — every scrape should produce enriched metadata

```typescript
// In scrape.worker.ts, after successful scrape + rawContent insert:
await boss.send('enrich', { linkId }, {
  retryLimit: 2,
  retryDelay: 10,
  expireInSeconds: 120,
})
```

Then register a second `boss.work()` handler in the same worker process:

```typescript
await boss.createQueue('enrich')
await boss.work<{ linkId: string }>('enrich', { localConcurrency: 10 }, async ([job]) => {
  const { linkId } = job.data!
  // 1. Fetch rawContent for linkId
  // 2. Run enrichment module
  // 3. Update links.description, links.category
  // 4. Upsert tags + linkTags
})
```

### Pattern 2: Tag Upsert with Source Tracking
**What:** Tags are upsert-based — find or create by (userId, normalizedName), then link to the link.
**When to use:** Always for rule-generated tags; user tags follow same path with `source: 'user'`

```typescript
// Source: Drizzle onConflictDoNothing pattern
async function upsertTag(userId: string, name: string, source: 'rule' | 'user') {
  const normalized = name.toLowerCase().trim()
  const [tag] = await db
    .insert(schema.tags)
    .values({ userId, name: normalized, source })
    .onConflictDoNothing({ target: [schema.tags.userId, schema.tags.name] })
    .returning()

  // If conflict (tag exists), fetch it
  if (!tag) {
    return db.select().from(schema.tags)
      .where(and(eq(schema.tags.userId, userId), eq(schema.tags.name, normalized)))
      .then(r => r[0])
  }
  return tag
}
```

### Pattern 3: Tag Extraction Heuristic (No Dependencies)
**What:** Frequency-ranked non-stop-word extraction from `bodyText`, then domain-hint injection
**When to use:** CLSF-01 implementation in `src/lib/enrichment/classify.ts`

```typescript
const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on',
  'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'be',
  'this', 'that', 'it', 'as', 'its', 'not', 'but', 'have', 'has', 'had',
  'will', 'would', 'could', 'should', 'may', 'might', 'can', 'do', 'does',
  'did', 'get', 'got', 'also', 'more', 'most', 'some', 'any', 'all', 'no'])

function extractKeywords(text: string, limit = 4): string[] {
  const freq = new Map<string, number>()
  const tokens = text.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? []
  for (const t of tokens) {
    if (!STOP_WORDS.has(t)) freq.set(t, (freq.get(t) ?? 0) + 1)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term)
}
```

### Pattern 4: Category Scoring Table
**What:** Each category has a set of signal words; text is scored per category, highest wins
**When to use:** CLSF-03 implementation in `src/lib/enrichment/classify.ts`

```typescript
const CATEGORY_SIGNALS: Record<string, string[]> = {
  Technology: ['software', 'programming', 'code', 'developer', 'api', 'react',
               'javascript', 'python', 'typescript', 'github', 'linux', 'cloud'],
  News:       ['breaking', 'report', 'journalist', 'headline', 'politics', 'election'],
  Reference:  ['documentation', 'docs', 'manual', 'guide', 'tutorial', 'wikipedia',
               'reference', 'how-to', 'howto', 'learn'],
  Entertainment: ['movie', 'film', 'music', 'game', 'youtube', 'video', 'tv', 'show'],
  Shopping:   ['price', 'buy', 'cart', 'checkout', 'product', 'shop', 'sale', 'order'],
  Social:     ['twitter', 'reddit', 'instagram', 'facebook', 'post', 'community'],
  Education:  ['course', 'lecture', 'university', 'study', 'lesson', 'academy'],
  Finance:    ['stock', 'market', 'invest', 'crypto', 'bank', 'money', 'fund'],
  Health:     ['health', 'medical', 'doctor', 'fitness', 'nutrition', 'wellness'],
  Creative:   ['design', 'art', 'illustration', 'photo', 'creative', 'portfolio'],
}

function categorize(text: string): string {
  const lower = text.toLowerCase()
  let best = 'Other'
  let bestScore = 0
  for (const [cat, signals] of Object.entries(CATEGORY_SIGNALS)) {
    const score = signals.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0)
    if (score > bestScore) { bestScore = score; best = cat }
  }
  return best
}
```

### Pattern 5: Domain Hints
**What:** Known domains inject guaranteed tags based on domain identity alone
**When to use:** Inject AFTER keyword extraction, deduplicate, then enforce 2-4 limit

```typescript
const DOMAIN_HINTS: Record<string, string[]> = {
  'github.com':       ['open-source', 'code'],
  'stackoverflow.com': ['programming', 'q&a'],
  'youtube.com':      ['video'],
  'wikipedia.org':    ['reference', 'wiki'],
  'medium.com':       ['article'],
  'dev.to':           ['programming', 'article'],
  'reddit.com':       ['community'],
  'npmjs.com':        ['npm', 'javascript'],
  'docs.':            ['documentation'],
}
```

### Pattern 6: Inline Click-to-Edit Description (React, no library)
**What:** Text switches to `<textarea>` on click; saves on blur or Enter; cancels on Escape
**When to use:** CLSF-05 — description in `LinkDetail`

```typescript
// Source: standard React hooks pattern
function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
    if (e.key === 'Escape') { setDraft(value); setEditing(false) }
  }

  function save() { onSave(draft.trim()); setEditing(false) }

  if (!editing) {
    return (
      <p className="text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 rounded p-1"
         onClick={() => setEditing(true)}>
        {value || 'Click to add description'}
      </p>
    )
  }
  return (
    <textarea
      ref={ref}
      className="w-full text-sm resize-none border rounded p-1 focus:outline-none focus:ring-1"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={handleKeyDown}
      rows={3}
    />
  )
}
```

### Pattern 7: SWR Optimistic Tag Update
**What:** Tag add/remove updates local SWR cache immediately, revalidates after API call
**When to use:** CLSF-04 — tagging actions in `LinkDetail` / `TagEditor`

```typescript
// Source: SWR mutation docs — https://swr.vercel.app/docs/mutation
const { data: link, mutate } = useSWR<LinkWithTags>(`/api/links/${id}`)

async function addTag(name: string) {
  const optimistic = { ...link, tags: [...(link?.tags ?? []), { id: 'temp', name, source: 'user' }] }
  await mutate(
    async () => { await fetch(`/api/links/${id}/tags`, { method: 'POST', body: JSON.stringify({ name }) }); return fetch(`/api/links/${id}`).then(r => r.json()) },
    { optimisticData: optimistic, rollbackOnError: true, revalidate: true }
  )
}
```

### Pattern 8: Backfill Job — Batch Enqueue on Startup
**What:** On worker startup, query all `links` that have `raw_content` but no `category`, enqueue in batches
**When to use:** One-time backfill during Phase 2 deployment

```typescript
async function backfill(boss: PgBoss, db: DB) {
  const unEnriched = await db
    .select({ id: schema.links.id })
    .from(schema.links)
    .leftJoin(schema.rawContent, eq(schema.rawContent.linkId, schema.links.id))
    .where(and(isNull(schema.links.category), isNotNull(schema.rawContent.id)))

  const BATCH = 50
  for (let i = 0; i < unEnriched.length; i += BATCH) {
    const batch = unEnriched.slice(i, i + BATCH).map(r => ({ name: 'enrich', data: { linkId: r.id } }))
    await boss.insert(batch)
    await new Promise(r => setTimeout(r, 100)) // avoid flooding queue
  }
}
```

### Anti-Patterns to Avoid
- **Running enrichment synchronously in the API route:** Enrichment reads DB and does CPU work; always keep in the worker process.
- **Storing tags as an array column on `links`:** The schema uses a proper `tags` + `linkTags` normalized design; never denormalize to an array field.
- **Re-scraping to get `bodyText`:** `raw_content.bodyText` is already stored; never re-fetch the URL during enrichment.
- **Using `source: 'rule'` for user-edited tags:** User-edited tags must use `source: 'user'`; mixed source tracking breaks future LLM upgrade logic.
- **Blocking the SWR poll loop on tag updates:** Use `mutate()` with optimisticData rather than waiting for the full polling interval to refresh.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stop-word list | Custom list from scratch | Use the 50-word inline constant above | English stop words are well-known; no maintenance burden |
| Upsert tag logic | Complex find-or-create with race conditions | Drizzle `onConflictDoNothing` + `returning()` | DB handles concurrency; `(userId, name)` unique constraint already exists in schema |
| Optimistic UI state | Custom state-management for tag add/remove | SWR `mutate` with `optimisticData` | Already integrated; prevents cache inconsistency |
| Category taxonomy | ML model or external classifier | Keyword-score table (Pattern 4 above) | 10 categories with 10-15 signal words each is ~100 lines; no model needed, fully inspectable |
| Backfill migration | Manual SQL or one-off script | pg-boss `boss.insert(batch)` from worker startup | Reuses existing retry/monitoring infrastructure |

**Key insight:** The enrichment domain (bookmark tagging) is narrow enough that hand-written heuristics match or beat generic NLP libraries for quality, with zero runtime dependencies and full inspectability.

---

## Common Pitfalls

### Pitfall 1: Category column missing from `links` table
**What goes wrong:** `links.category` does not exist in the current schema; enrichment writes will fail at runtime with a DB error.
**Why it happens:** The schema was finalized in Phase 1 before category was a requirement.
**How to avoid:** First task of Phase 2 — add `category: text('category')` to the `links` schema, then run `drizzle-kit generate` + `drizzle-kit migrate`.
**Warning signs:** TypeScript will not catch this; only a runtime DB error will surface it.

### Pitfall 2: Tags not returned by `GET /api/links`
**What goes wrong:** `listLinks` query in `src/lib/db/queries/links.ts` does a simple `db.select().from(links)` — it does not join tags. Tag pills on cards and in detail view will always be empty.
**Why it happens:** Tags live in a separate table; they must be explicitly joined.
**How to avoid:** Create a new `listLinksWithTags` query that left-joins `linkTags` + `tags`, or use a second per-link fetch for the detail view. Consider returning tags only in the detail endpoint to avoid over-fetching on the dashboard.
**Warning signs:** Tags saved to DB correctly but never appear in UI.

### Pitfall 3: Duplicate `linkTags` rows
**What goes wrong:** If enrichment runs more than once (retry or duplicate job), it inserts duplicate `linkTags` rows, causing doubled tag pills.
**Why it happens:** `linkTags` has no unique constraint in the current schema.
**How to avoid:** Add a unique constraint on `(linkId, tagId)` in the migration, and use `.onConflictDoNothing()` when inserting `linkTags`.
**Warning signs:** Tag count doubles on every enrichment re-run.

### Pitfall 4: Description overwrite on user-edited text
**What goes wrong:** Backfill or re-enrichment overwrites a description the user has already edited.
**Why it happens:** Enrichment worker blindly sets `description` without checking if user has modified it.
**How to avoid:** Enrichment should only write `description` when `links.description IS NULL`. User edits via API always win; worker only fills the gap.
**Warning signs:** User edits description, next enrichment run resets it.

### Pitfall 5: `raw_content` may not exist yet when `enrich` job runs
**What goes wrong:** If the `enrich` job is picked up by a worker before `scrape` has written `raw_content` (race condition under high load), enrichment finds no text and stores empty tags.
**Why it happens:** pg-boss jobs are async; `enrich` is enqueued at the end of `scrape` handler but another worker thread could theoretically pick it up before the `rawContent` insert commits.
**How to avoid:** Ensure `rawContent` insert completes in the same transaction before `boss.send('enrich')`, OR have the enrichment worker handle the null case gracefully and not mark job as complete (returning `false` causes retry).

### Pitfall 6: `pg-boss` `PgBoss` named-export vs default
**What goes wrong:** `import PgBoss from 'pg-boss'` fails with v12 — it uses named exports.
**Why it happens:** This was noted in STATE.md as a previous Phase 1 finding.
**How to avoid:** Always use `import { PgBoss } from 'pg-boss'` — already correct in the existing worker.

---

## Code Examples

### Enrichment Module Entry Point
```typescript
// src/lib/enrichment/classify.ts
export interface EnrichmentResult {
  tags: string[]          // 2-4 normalized lowercase strings
  description: string     // 150-char max
  category: string        // one of the fixed categories
}

export function enrich(opts: {
  bodyText: string | null
  existingDescription: string | null
  domain: string | null
  title: string | null
}): EnrichmentResult {
  const text = [opts.title, opts.bodyText].filter(Boolean).join(' ')
  const tags = buildTags(text, opts.domain)
  const description = opts.existingDescription?.trim()
    || extractDescription(text)
  const category = categorize(text)
  return { tags, description, category }
}
```

### Drizzle Schema Addition
```typescript
// src/lib/db/schema.ts — add to links table definition
category: text('category'),
```

Then run:
```bash
npm run db:generate   # creates migration SQL
npm run db:migrate    # applies ALTER TABLE
```

### Drizzle Query: Tags for a Link
```typescript
// Source: Drizzle joins docs — https://orm.drizzle.team/docs/joins
export async function getTagsForLink(linkId: string) {
  return db
    .select({ id: tags.id, name: tags.name, source: tags.source })
    .from(linkTags)
    .innerJoin(tags, eq(linkTags.tagId, tags.id))
    .where(eq(linkTags.linkId, linkId))
}
```

### Drizzle Query: Insert LinkTag (safe upsert)
```typescript
// Prevent duplicate linkTags rows
await db
  .insert(schema.linkTags)
  .values({ linkId, tagId })
  .onConflictDoNothing()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate per-service NLP APIs | Self-hosted rule-based heuristics | 2023+ (cost concerns) | Zero ongoing cost, no network dependency |
| TF-IDF requires large corpus | Single-doc frequency ranking | Always applicable | Works correctly on a single page's body text |
| pg-boss v9 default export | pg-boss v12 named export `{ PgBoss }` | pg-boss v10+ | Breaking change already handled in existing worker |
| SWR 1.x manual state | SWR 2.x `optimisticData` option on `mutate` | SWR 2.0 (2022) | Simpler optimistic UI; no separate useState needed |

**Deprecated/outdated:**
- `boss.publish()` (pub/sub): removed in v10; use `boss.send()` for targeted jobs.
- `teamSize` option on `boss.work()`: renamed `localConcurrency` in v12 — already correct in existing worker.

---

## Open Questions

1. **`linkTags` unique constraint**
   - What we know: The schema has no unique constraint on `(linkId, tagId)` today.
   - What's unclear: Whether Drizzle will infer the need for an index automatically.
   - Recommendation: Explicitly add a unique constraint in the migration to prevent duplicates under retries.

2. **Tags returned by `/api/links` GET list endpoint**
   - What we know: Current `listLinks` returns only `links` table fields (no join to tags).
   - What's unclear: Whether tag pills should appear on cards (requires join on list endpoint) or only in the detail view (fetch on demand).
   - Recommendation: Per CONTEXT.md, "cards show tags read-only" — include tags in the list endpoint response to avoid a second fetch per card. Use a left-join aggregation or a separate `tagsByLinkId` map query.

3. **Type definition for `Link` in `src/types/index.ts`**
   - What we know: `Link` type has no `tags` or `category` fields.
   - What's unclear: Whether to extend `Link` in-place or create a `LinkWithEnrichment` type.
   - Recommendation: Extend `Link` with `tags?: Tag[]` and `category?: string | null` to avoid dual type proliferation.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run tests/enrichment/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLSF-01 | `enrich()` returns 2-4 lowercase tags from bodyText | unit | `npx vitest run tests/enrichment/classify.test.ts` | ❌ Wave 0 |
| CLSF-01 | Domain hint injects tag for github.com | unit | `npx vitest run tests/enrichment/classify.test.ts` | ❌ Wave 0 |
| CLSF-01 | Tags normalized to lowercase | unit | `npx vitest run tests/enrichment/classify.test.ts` | ❌ Wave 0 |
| CLSF-02 | `enrich()` returns existing meta description when present | unit | `npx vitest run tests/enrichment/classify.test.ts` | ❌ Wave 0 |
| CLSF-02 | `enrich()` extracts first paragraph when no meta description | unit | `npx vitest run tests/enrichment/classify.test.ts` | ❌ Wave 0 |
| CLSF-03 | `categorize()` returns "Technology" for tech-signal text | unit | `npx vitest run tests/enrichment/classify.test.ts` | ❌ Wave 0 |
| CLSF-03 | `categorize()` returns "Other" when no signals match | unit | `npx vitest run tests/enrichment/classify.test.ts` | ❌ Wave 0 |
| CLSF-04 | `POST /api/links/[id]/tags` adds tag and returns updated link | integration | `npx vitest run tests/api/links/tags.test.ts` | ❌ Wave 0 |
| CLSF-04 | `DELETE /api/links/[id]/tags/[tagId]` removes tag | integration | `npx vitest run tests/api/links/tags.test.ts` | ❌ Wave 0 |
| CLSF-05 | `PATCH /api/links/[id]` updates description | integration | `npx vitest run tests/api/links/[id].test.ts` | ❌ Wave 0 (extends existing) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/enrichment/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/enrichment/classify.test.ts` — covers CLSF-01, CLSF-02, CLSF-03 (pure function unit tests, no DB mock needed)
- [ ] `tests/api/links/tags.test.ts` — covers CLSF-04 (mock DB + auth, follows existing pattern in `tests/api/links.test.ts`)
- [ ] Extend `tests/api/links/[id].test.ts` — add PATCH case for CLSF-05

---

## Sources

### Primary (HIGH confidence)
- Official pg-boss GitHub (v12.14.0, Feb 2026) — job chaining via `boss.send()` from handler, named export `{ PgBoss }`
- Drizzle ORM official docs (orm.drizzle.team) — `onConflictDoNothing`, joins pattern, migration workflow
- SWR official docs (swr.vercel.app/docs/mutation) — `optimisticData` pattern, `mutate()` API
- Codebase direct read — `src/lib/db/schema.ts`, `src/workers/scrape.worker.ts`, `src/types/index.ts` — confirming existing table structures and patterns

### Secondary (MEDIUM confidence)
- NaturalNode/natural GitHub — v8.1.1 (Feb 2026), TypeScript support, MIT license, TF-IDF `listTerms` API
- naturalnode.github.io/natural/tfidf.html — verified `TfIdf.addDocument()` + `listTerms(index)` API

### Tertiary (LOW confidence)
- WebSearch: keyword-extractor npm (last published 2022, low activity) — NOT recommended, included for awareness only
- WebSearch: compromise npm (250 KB, POS tagging) — may be useful for future BYOK phase; not needed here

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already in the codebase; no new deps needed
- Architecture: HIGH — patterns are directly derived from existing worker/queue/SWR code
- Pitfalls: HIGH — schema gaps (missing `category` column, no `linkTags` unique constraint) confirmed by direct schema read
- Tag heuristics: MEDIUM — keyword frequency is standard; exact stop-word list and domain-hint quality requires empirical tuning

**Research date:** 2026-03-17
**Valid until:** 2026-06-17 (stable domain — Drizzle, SWR, pg-boss APIs rarely break; heuristic algorithm is internal)
