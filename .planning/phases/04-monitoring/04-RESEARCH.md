# Phase 4: Monitoring - Research

**Researched:** 2026-03-18
**Domain:** Scheduled HTTP health checks, pg-boss cron, Drizzle schema extension, React status UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Status indicator appearance**
- Small colored dot next to the favicon/domain name on link cards (both grid and list views)
- Three states: green (up), red (down), gray (not yet checked)
- Dot has a tooltip on hover showing last checked time (e.g., "Last checked: 2 hours ago")
- Detail view shows: status dot, last checked timestamp, and a "Check now" button for manual recheck

**Check frequency and behavior**
- System checks each link every 24 hours automatically
- Uses HTTP HEAD request (minimal bandwidth, fastest)
- 10-second timeout — no response within 10s counts as a failure
- Manual "Check now" button in detail view enqueues an immediate check via pg-boss
- Dot updates after check completes (via existing SWR polling pattern)

**Failure handling**
- Two consecutive failures required before marking a link as "down" (red dot)
- A single failure keeps the link as "up" — avoids false positives from temporary blips
- HTTP redirects (301/302, any 3xx) count as "up" — redirects are normal behavior
- 4xx and 5xx status codes count as failures (along with timeouts and connection errors)
- 1xx, 2xx, 3xx all count as "up"
- Store the last HTTP status code and timestamp per link (not just up/down boolean)
- Tooltip shows status code context (e.g., "200 OK" vs "503 Service Unavailable")

### Claude's Discretion
- Exact dot size and CSS styling
- Cron/scheduling mechanism for the 24-hour check cycle
- How to batch/stagger checks to avoid overwhelming the queue
- Consecutive failure counter storage approach
- "Check now" button loading state behavior

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MNTR-01 | System pings saved links on a schedule to check availability | pg-boss `schedule()` with cron; worker `monitor` queue handler; HEAD request with AbortController timeout |
| MNTR-02 | Each link displays a green/red uptime indicator | `uptimeStatus` column on `links` table; `UptimeDot` component using Tailwind color classes; Tooltip from existing `src/components/ui/tooltip.tsx` |
</phase_requirements>

---

## Summary

Phase 4 builds a lightweight link-availability monitor on top of the infrastructure already established by Phase 1: the same pg-boss worker process, the same Drizzle schema, and the same SWR polling pattern. No new runtime dependencies are required — everything ships with the existing stack.

The core data model is four new columns on the `links` table: `uptimeStatus` (enum string: `unchecked | up | down`), `lastStatusCode` (nullable integer), `lastCheckedAt` (nullable timestamp), and `consecutiveFailures` (integer, default 0). The scheduled checker runs inside the existing `scrape.worker.ts` process via `boss.schedule()` — a built-in pg-boss cron primitive that fires a named queue on a cron expression. The worker adds a `monitor` queue handler that performs a HEAD request per link, applies the two-consecutive-failure rule, and writes results with Drizzle. The API exposes one new route (`POST /api/links/[id]/check`) for the manual "Check now" button. The UI adds a `UptimeDot` component that reads `link.uptimeStatus` and `link.lastCheckedAt` from the already-present `LinkWithTags` type (extended with new fields), wraps it in the existing Radix Tooltip, and renders a 2.5 × 2.5 rounded dot in the right color.

**Primary recommendation:** Use `boss.schedule()` for 24-hour cron + stagger batch inserts with `startAfter` offsets. Extend `LinkWithTags` with the four uptime fields. Keep the worker single-process; no separate microservice needed.

---

## Standard Stack

### Core (all already installed — zero new npm dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg-boss` | 12.14.0 | Cron scheduling + `monitor` queue | Already drives `scrape` and `enrich` queues; `boss.schedule()` eliminates external cron |
| `drizzle-orm` | 0.45.1 | Schema migration, DB reads/writes | Project-standard ORM; `db:push` workflow already proven |
| `swr` | 2.4.1 | UI polling after check completes | Already polls on pending links; same pattern, same hook |
| `radix-ui` (Tooltip) | 1.4.3 | Status dot tooltip | `src/components/ui/tooltip.tsx` already exists and is ready to use |
| Node `fetch` | built-in | HEAD request for availability check | Node 18+ has global `fetch`; no extra library needed |
| `AbortController` | built-in | 10-second timeout on HEAD request | Standard Web API available in Node 18+ |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `boss.schedule()` | External cron (Render cron job, Vercel cron) | External cron adds deployment complexity and a new HTTP endpoint to secure; `boss.schedule()` is self-contained inside the existing worker process |
| Node `fetch` + `AbortController` | `axios`, `got`, `undici` | Zero additional dependency; `fetch` with `AbortController` handles timeout and redirect-following cleanly |
| Drizzle `db:push` for schema delta | Full migration file | `db:push` is the established project workflow for active dev; safe for column additions on existing tables |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── workers/
│   └── scrape.worker.ts         # Add: createQueue('monitor'), boss.schedule(), work('monitor', ...)
├── lib/
│   ├── db/
│   │   ├── schema.ts            # Add: 4 uptime columns to links table
│   │   └── queries/
│   │       └── links.ts         # Add: updateUptimeStatus(), listLinksForMonitor()
│   └── queue/
│       └── boss.ts              # Add: enqueueMonitorJob(linkId)
├── app/api/links/[id]/
│   └── check/
│       └── route.ts             # New: POST handler for "Check now"
├── types/
│   └── index.ts                 # Extend Link + LinkWithTags with uptime fields
└── components/
    └── links/
        ├── UptimeDot.tsx        # New: status dot + tooltip component
        ├── LinkCard.tsx         # Modify: render <UptimeDot> next to domain
        ├── LinkCardList.tsx     # Modify: render <UptimeDot> next to domain
        └── LinkDetail.tsx       # Modify: add status row + "Check now" button
```

### Pattern 1: pg-boss Cron with `boss.schedule()`

**What:** `boss.schedule(queueName, cronExpression, data, options)` inserts a scheduled trigger into the pg-boss `schedule` table. When the cron fires, pg-boss sends a single job to the named queue. The worker's `work('monitor', handler)` handler receives that job and fans out individual per-link jobs.

**When to use:** Any recurring background task that must survive worker restarts and not require an external scheduler.

**Cron expression for every 24 hours at 02:00 UTC:** `'0 2 * * *'`

```typescript
// Source: pg-boss dist/index.d.ts — schedule(name, cron, data?, options?)
// Called once at worker startup; pg-boss deduplicates if schedule already exists
await boss.schedule('monitor-sweep', '0 2 * * *', {}, { tz: 'UTC' })
```

The sweep handler fetches all link IDs and batches them into individual `monitor` jobs with staggered `startAfter` delays to spread load:

```typescript
// Inside work('monitor-sweep', ...) handler
const BATCH_SIZE = 100
const STAGGER_MS = 10_000 // 10 seconds between batches

const allLinks = await db
  .select({ id: links.id })
  .from(links)
  .where(eq(links.status, 'ready'))

for (let i = 0; i < allLinks.length; i += BATCH_SIZE) {
  const batch = allLinks.slice(i, i + BATCH_SIZE)
  const delaySeconds = Math.floor(i / BATCH_SIZE) * (STAGGER_MS / 1000)
  await boss.insert(
    'monitor',
    batch.map(({ id }) => ({
      data: { linkId: id },
      startAfter: delaySeconds,
      retryLimit: 1,
      expireInSeconds: 300,
    }))
  )
}
```

### Pattern 2: HEAD Request with AbortController Timeout

**What:** Use native `fetch` with `method: 'HEAD'` and an `AbortController` signal for the 10-second timeout. Redirect behavior is controlled by `redirect: 'follow'` (default) so 3xx responses resolve to the final status and count as "up".

**Key detail:** `fetch` with `redirect: 'follow'` (the default) follows redirects automatically and exposes the final response status. For a 301 that resolves to a 200, `response.status` will be `200`. For a 301 that resolves to a 404, `response.status` will be `404`. This means the existing rule ("1xx, 2xx, 3xx count as up") maps cleanly to checking `response.status < 400`.

```typescript
// Source: MDN Fetch API (Web standard, available in Node 18+ global)
async function checkUrl(url: string): Promise<{ statusCode: number | null; up: boolean }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',  // default — follow 3xx, expose final status
    })
    clearTimeout(timeoutId)
    return {
      statusCode: response.status,
      up: response.status < 400,  // 1xx/2xx/3xx = up; 4xx/5xx = down
    }
  } catch {
    clearTimeout(timeoutId)
    // AbortError (timeout) or network error — treat as failure
    return { statusCode: null, up: false }
  }
}
```

### Pattern 3: Two-Consecutive-Failure Rule with Drizzle SQL

**What:** The `consecutiveFailures` column tracks how many back-to-back failures occurred. A success resets it to 0 and sets `uptimeStatus = 'up'`. A failure increments it; only when it reaches 2 does `uptimeStatus` flip to `'down'`.

```typescript
// Source: Drizzle ORM — conditional update using sql template
async function updateUptimeStatus(linkId: string, up: boolean, statusCode: number | null) {
  if (up) {
    await db.update(links)
      .set({
        uptimeStatus: 'up',
        lastStatusCode: statusCode,
        lastCheckedAt: new Date(),
        consecutiveFailures: 0,
        updatedAt: new Date(),
      })
      .where(eq(links.id, linkId))
  } else {
    // Increment failure count; flip to 'down' only at 2+ consecutive failures
    await db.update(links)
      .set({
        consecutiveFailures: sql`${links.consecutiveFailures} + 1`,
        lastStatusCode: statusCode,
        lastCheckedAt: new Date(),
        uptimeStatus: sql`CASE WHEN ${links.consecutiveFailures} + 1 >= 2 THEN 'down' ELSE ${links.uptimeStatus} END`,
        updatedAt: new Date(),
      })
      .where(eq(links.id, linkId))
  }
}
```

### Pattern 4: Schema Extension (Drizzle, db:push)

```typescript
// Additions to src/lib/db/schema.ts — links table
export const links = pgTable('links', {
  // ... existing columns unchanged ...
  uptimeStatus: text('uptime_status').notNull().default('unchecked'), // 'unchecked' | 'up' | 'down'
  lastStatusCode: integer('last_status_code'),                        // nullable
  lastCheckedAt: timestamp('last_checked_at'),                        // nullable
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
}, ...)
```

Apply with `npm run db:push` — no data loss on existing rows; new columns get defaults.

### Pattern 5: UptimeDot Component

```typescript
// src/components/links/UptimeDot.tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDistanceToNow } from 'date-fns'

type UptimeStatus = 'unchecked' | 'up' | 'down'

const DOT_COLORS: Record<UptimeStatus, string> = {
  unchecked: 'bg-muted-foreground/40',
  up: 'bg-green-500',
  down: 'bg-red-500',
}

interface UptimeDotProps {
  status: UptimeStatus
  lastCheckedAt: Date | null
  lastStatusCode: number | null
}

export function UptimeDot({ status, lastCheckedAt, lastStatusCode }: UptimeDotProps) {
  const checkedLabel = lastCheckedAt
    ? `Last checked ${formatDistanceToNow(lastCheckedAt, { addSuffix: true })}`
    : 'Not yet checked'
  const codeLabel = lastStatusCode ? ` — ${lastStatusCode}` : ''
  const tooltipText = `${checkedLabel}${codeLabel}`

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-block size-2.5 rounded-full shrink-0 ${DOT_COLORS[status]}`}
            aria-label={`Link status: ${status}`}
          />
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

### Pattern 6: "Check Now" API Route

```typescript
// src/app/api/links/[id]/check/route.ts
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  // Verify ownership
  const link = await getLinkById(session.user.id, id)
  if (!link) return Response.json({ error: 'Not found' }, { status: 404 })

  await enqueueMonitorJob(id)
  return Response.json({ queued: true })
}
```

### Anti-Patterns to Avoid

- **Monitoring all links every sweep regardless of status:** Only check links with `status = 'ready'` — skip `pending` and `error` links that haven't completed scraping yet.
- **Using `fetch` without AbortController:** Node fetch has no built-in timeout; without AbortController the check can hang indefinitely, blocking the worker concurrency slot.
- **Storing uptime in a separate table:** Four columns on `links` is sufficient for v1 (no history needed). A separate table adds JOIN complexity with no benefit at this scope.
- **Using `GET` instead of `HEAD`:** HEAD is correct — servers must respond identically to HEAD vs GET for status codes, but HEAD never transfers a body. Saves bandwidth and is faster.
- **Setting `uptimeStatus` to `'down'` on the first failure:** The two-consecutive-failure rule is locked. A single network blip should not flip the indicator.
- **Blocking the worker's `monitor` handler with all links serially:** Fan out individual per-link jobs via `boss.insert()` so pg-boss handles concurrency via `localConcurrency`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 24-hour cron scheduling | Custom interval timer / setInterval | `boss.schedule()` | Survives worker restarts; stored in DB; pg-boss deduplicates schedule registration |
| HTTP request with timeout | Manual Promise.race with setTimeout | `fetch` + `AbortController` | AbortController integrates with fetch's signal API; correctly cancels the connection, not just the promise |
| Redirect following | Manual 3xx chase loop | `fetch` with `redirect: 'follow'` | Default behavior; correctly follows to final status |
| Tooltip on hover | Custom CSS :hover popup | `Tooltip`/`TooltipContent` from `src/components/ui/tooltip.tsx` | Already installed; accessible; correct z-index and animation |
| Relative time display | Custom date formatter | `formatDistanceToNow` from `date-fns` | Already in `package.json`; used in `LinkCardList.tsx` |

**Key insight:** Every problem in this phase is already solved by installed libraries. The implementation is wiring, not building.

---

## Common Pitfalls

### Pitfall 1: HEAD Request Blocked by Server
**What goes wrong:** Some servers block HEAD requests (return 405 Method Not Allowed or silently hang) even though their GET endpoint works fine. Following the spec strictly causes false positives.
**Why it happens:** Non-standard server configurations; CDN edge rules; nginx misconfigurations.
**How to avoid:** When a HEAD request returns 405, retry with GET for that URL. Keep this as a fallback inside `checkUrl()` — attempt HEAD first, fall back to GET on 405.
**Warning signs:** Links that visually work in browser but are marked `down`.

### Pitfall 2: pg-boss `schedule()` Registering Duplicate Schedules
**What goes wrong:** Worker restarts call `boss.schedule()` repeatedly. If pg-boss upserts the schedule (it does), this is safe. But the queue name passed to `schedule()` and `work()` must match exactly.
**Why it happens:** Schedule name and queue name are independent in pg-boss — `schedule()` creates a cron entry that sends to the named queue, so both names must be consistent.
**How to avoid:** Use the same constant string (`'monitor-sweep'`) for both `boss.schedule('monitor-sweep', ...)` and `boss.work('monitor-sweep', ...)`. Verify with pg-boss README.

### Pitfall 3: `createQueue` Must Be Called Before `schedule`
**What goes wrong:** `boss.schedule()` silently succeeds but jobs never run because the queue wasn't created first.
**Why it happens:** pg-boss v12 requires explicit queue creation via `createQueue()`. In the existing worker, `createQueue('scrape')` and `createQueue('enrich')` are already called. `monitor` and `monitor-sweep` must be added.
**How to avoid:** In `main()` of `scrape.worker.ts`, add `await boss.createQueue('monitor-sweep')` and `await boss.createQueue('monitor')` alongside the existing queue creations.

### Pitfall 4: SWR Polling Not Triggered After Check Completes
**What goes wrong:** User clicks "Check now", check completes in worker, but UI dot doesn't update because SWR isn't polling.
**Why it happens:** The existing SWR dual-hook pattern only polls when `hasPending` is true (links with `status = 'pending'`). Monitoring checks use a different state field.
**How to avoid:** Add a `hasUnchecked` flag to `useLinks()` that is true when any link has `uptimeStatus = 'unchecked'`, OR simply trigger `mutate()` after the POST to `/api/links/[id]/check` succeeds, then set a local loading state that resolves on next SWR revalidation. Simpler: `mutate()` after the POST causes an immediate revalidation cycle.

### Pitfall 5: `consecutiveFailures` Race Condition on Concurrent Workers
**What goes wrong:** If two monitor jobs for the same link run concurrently, both read `consecutiveFailures = 1` and both write `consecutiveFailures = 2`, correctly flipping to `down`. But if they both read `consecutiveFailures = 0` and both write `1`, the link stays `up` when it should have gone to `1`. This is acceptable behavior for a status indicator (not a finance system), but worth noting.
**Why it happens:** Non-atomic read-modify-write at the application layer.
**How to avoid:** Use SQL atomic increment (`sql\`${links.consecutiveFailures} + 1\``) in the Drizzle update — already shown in Pattern 3. This avoids the race entirely.

### Pitfall 6: `integer` Type for `lastStatusCode` in Drizzle
**What goes wrong:** Using `text` for status codes instead of `integer` makes comparison in SQL awkward.
**Why it happens:** Forgetting HTTP status codes are integers (200, 404, etc.).
**How to avoid:** Use `integer('last_status_code')` in the Drizzle schema. Cast to string only in UI layer when displaying tooltip text.

### Pitfall 7: Worker pg-boss Mock Needs `schedule` Method
**What goes wrong:** Tests fail because the vitest pg-boss mock in `tests/setup.ts` doesn't include `schedule`, `createQueue`, or `insert` methods.
**Why it happens:** The current mock only mocks `start`, `send`, `work`, `on` — the methods used by existing queues.
**How to avoid:** Add `schedule: vi.fn()`, `insert: vi.fn()`, `createQueue: vi.fn()` to the pg-boss mock in `tests/setup.ts` as part of Wave 0.

---

## Code Examples

### Drizzle Schema Addition

```typescript
// Source: drizzle-orm/pg-core docs — text() and integer() column builders
// Add to links table in src/lib/db/schema.ts
uptimeStatus: text('uptime_status').notNull().default('unchecked'),
lastStatusCode: integer('last_status_code'),
lastCheckedAt: timestamp('last_checked_at'),
consecutiveFailures: integer('consecutive_failures').notNull().default(0),
```

### Type Extension (src/types/index.ts)

```typescript
// Extend Link interface
export interface Link {
  // ... existing fields ...
  uptimeStatus: 'unchecked' | 'up' | 'down'
  lastStatusCode: number | null
  lastCheckedAt: Date | null
  consecutiveFailures: number
}
```

### Worker Integration Points

```typescript
// In main() of scrape.worker.ts — add alongside existing createQueue calls
await boss.createQueue('monitor-sweep')
await boss.createQueue('monitor')
console.log('[worker] pg-boss started, listening for scrape, enrich, monitor-sweep, and monitor jobs...')

// Register 24-hour schedule (pg-boss upserts — safe to call on every restart)
await boss.schedule('monitor-sweep', '0 2 * * *', {}, { tz: 'UTC' })

// Sweep handler — fans out individual monitor jobs
await boss.work('monitor-sweep', { localConcurrency: 1 }, async ([_job]) => {
  // ... batch insert monitor jobs with startAfter stagger ...
})

// Per-link monitor handler
await boss.work<{ linkId: string }>('monitor', { localConcurrency: 20 }, async ([job]) => {
  const { linkId } = job.data!
  const [link] = await db.select({ url: links.url }).from(links).where(eq(links.id, linkId)).limit(1)
  if (!link) return
  const result = await checkUrl(link.url)
  await updateUptimeStatus(linkId, result.up, result.statusCode)
})
```

### enqueueMonitorJob in boss.ts

```typescript
export async function enqueueMonitorJob(linkId: string) {
  const b = getBoss()
  await b.start()
  await b.createQueue('monitor')
  await b.send('monitor', { linkId }, {
    retryLimit: 1,
    expireInSeconds: 30,
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External cron (crontab, Heroku Scheduler) | In-process cron via pg-boss `schedule()` | pg-boss v10+ | No separate infrastructure; worker process owns schedule registration |
| `node-fetch` or `axios` for HTTP | Native `fetch` + `AbortController` | Node 18 (LTS since 2022) | Zero dependencies for HTTP; `AbortController` timeout is the standard pattern |
| Separate `check_results` table for uptime | Columns directly on `links` row (v1 scope) | Per v1 requirements decision | Simpler queries; JOIN-free; adequate for current scope (no history) |

**Deprecated/outdated:**
- `node-fetch`: No longer needed; Node 18+ has global `fetch`.
- `axios` for simple HTTP: Only warranted when advanced interceptors or request transformation is needed; overkill for a HEAD check.
- `pg-boss` default export: This project already knows to use named export `{PgBoss}` (documented in STATE.md).
- `teamSize` option in pg-boss: Replaced by `localConcurrency` in v10+ (already applied in existing worker).

---

## Open Questions

1. **HEAD request fallback to GET**
   - What we know: HEAD works for most URLs; some servers return 405 on HEAD.
   - What's unclear: How common is 405-on-HEAD in the user's link collection?
   - Recommendation: Implement HEAD-first, GET-fallback in `checkUrl()`. The planner should include this as a task sub-step.

2. **Monitor sweep scheduling across multiple users**
   - What we know: `boss.schedule('monitor-sweep', ...)` fires once per cron tick and enqueues jobs for all links across all users.
   - What's unclear: At large scale, the sweep could enqueue tens of thousands of jobs at once.
   - Recommendation: For v1 scale, batch insert with `startAfter` stagger (10 seconds per 100 links). This is sufficient. Flag as acceptable for now.

3. **SWR update timing after "Check now"**
   - What we know: The monitor job is async — the API returns immediately after enqueue, not after check completion.
   - What's unclear: How long before the worker processes the job and SWR picks up the result?
   - Recommendation: After POST to `/check`, optimistically show a "checking..." state in the button. Poll via SWR `mutate()` every 2 seconds for up to 15 seconds, then stop. Mirrors the existing pending-link polling pattern.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `/home/yalt/Documents/Projects/Tech/web/pageslop/vitest.config.ts` |
| Quick run command | `npm run test -- --reporter=verbose tests/monitor` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MNTR-01 | `checkUrl()` returns `{ up: true }` for 2xx/3xx responses | unit | `npm run test -- tests/monitor/check-url.test.ts` | Wave 0 |
| MNTR-01 | `checkUrl()` returns `{ up: false }` for 4xx/5xx responses | unit | `npm run test -- tests/monitor/check-url.test.ts` | Wave 0 |
| MNTR-01 | `checkUrl()` returns `{ up: false, statusCode: null }` on timeout | unit | `npm run test -- tests/monitor/check-url.test.ts` | Wave 0 |
| MNTR-01 | `updateUptimeStatus()` sets `uptimeStatus = 'down'` only after 2 consecutive failures | unit | `npm run test -- tests/monitor/uptime-logic.test.ts` | Wave 0 |
| MNTR-01 | `updateUptimeStatus()` resets `consecutiveFailures` to 0 on success | unit | `npm run test -- tests/monitor/uptime-logic.test.ts` | Wave 0 |
| MNTR-02 | `POST /api/links/[id]/check` returns 200 with `{ queued: true }` for valid owned link | unit | `npm run test -- tests/api/monitor.test.ts` | Wave 0 |
| MNTR-02 | `POST /api/links/[id]/check` returns 401 for unauthenticated request | unit | `npm run test -- tests/api/monitor.test.ts` | Wave 0 |
| MNTR-02 | `POST /api/links/[id]/check` returns 404 for link not owned by user | unit | `npm run test -- tests/api/monitor.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/monitor`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/monitor/check-url.test.ts` — covers MNTR-01 checkUrl behavior (HEAD, timeout, 405 fallback)
- [ ] `tests/monitor/uptime-logic.test.ts` — covers MNTR-01 two-consecutive-failure rule and reset
- [ ] `tests/api/monitor.test.ts` — covers MNTR-02 POST /api/links/[id]/check auth + ownership
- [ ] `tests/setup.ts` — add `schedule: vi.fn()`, `insert: vi.fn()`, `createQueue: vi.fn()` to pg-boss mock (currently missing these methods)

---

## Sources

### Primary (HIGH confidence)

- `node_modules/pg-boss/dist/index.d.ts` — verified `schedule(name, cron, data?, options?)` signature, `ScheduleOptions`, `createQueue`, `insert`, `work`
- `node_modules/pg-boss/dist/types.d.ts` — verified `ScheduleOptions = SendOptions & { tz?, key? }`, `QueuePolicy` types, `singletonKey`, `startAfter` in `JobOptions`
- `src/workers/scrape.worker.ts` — verified `{PgBoss}` named import, `localConcurrency`, `boss.insert()` batch pattern, `boss.work()` signature
- `src/lib/queue/boss.ts` — verified `getBoss()` singleton, `createQueue` before `send` pattern
- `src/lib/db/schema.ts` — verified current `links` table columns; confirmed `text` and `integer` column types available
- `src/components/ui/tooltip.tsx` — verified `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` exports using Radix
- `vitest.config.ts` — verified test pattern `tests/**/*.test.ts`, setupFiles `./tests/setup.ts`
- `tests/setup.ts` — verified current pg-boss mock shape (missing `schedule`, `createQueue`, `insert`)
- MDN Fetch API — `AbortController`, `fetch` with `signal`, `redirect: 'follow'` behavior (Web standard, Node 18+)

### Secondary (MEDIUM confidence)

- Existing project patterns in `LinkCardList.tsx` using `formatDistanceToNow` from `date-fns` — confirms library availability for tooltip time display

### Tertiary (LOW confidence — not needed, everything covered by primary sources)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified by reading installed package declarations and existing source files
- Architecture patterns: HIGH — directly derived from existing worker, queue, schema, and component patterns in the codebase
- Pitfalls: HIGH — derived from pg-boss type declarations, known Node fetch behavior, and existing mock gaps found in `tests/setup.ts`
- Test map: HIGH — test framework config verified; test file paths follow established `tests/` convention

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable stack — pg-boss, Drizzle, SWR, Next.js App Router)
