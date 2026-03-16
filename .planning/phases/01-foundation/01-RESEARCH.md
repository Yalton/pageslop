# Phase 1: Foundation - Research

**Researched:** 2026-03-16
**Domain:** Next.js 15 App Router, Better Auth, Drizzle ORM, Neon, pg-boss, UI shell
**Confidence:** HIGH (core stack verified via official docs; pg-boss/Neon pooler nuance MEDIUM)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Separate /login and /signup pages (not tabbed on one page)
- Marketing/hero landing page at root — explains what Pageslop does with login/signup CTAs
- After signup, quick onboarding flow: guided "paste your first link" moment
- Persistent sessions — user stays logged in until explicit logout (long-lived session)
- Card grid and compact list views with a toggle — default to card grid
- Left sidebar navigation with views (All Links, Tags, Graph, Settings)
- Empty state for new users: large centered paste input with "Paste your first link" and illustration
- Cards show: thumbnail/OG image as hero, favicon + domain, title + description, tag pills
- Fallback when no OG image: large favicon centered on a generated color background
- Clicking a card opens a detail view (expanded view with full details, tags, description) — separate button/link to visit the URL
- Cards in list view show same info in a compact row format
- Desktop: persistent URL input bar at top of dashboard, always visible
- Mobile: floating action button (FAB) that opens a paste modal
- Multi-line input supported: users can paste multiple URLs on separate lines for batch saving
- On submit: success toast notification, card(s) appear in the list with skeleton shimmer pending state
- Skeleton placeholders fill in progressively as title, image, tags arrive from background enrichment
- Duplicate detection: warn the user ("Already saved") but allow saving again if they choose to

### Claude's Discretion
- Default link ordering (newest first recommended)
- Exact skeleton shimmer animation design
- Toast notification positioning and duration
- Onboarding flow exact steps and copy
- Sidebar icon/label design
- Marketing landing page layout and copy

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can create account with email and password | Better Auth 1.5.x `emailAndPassword: { enabled: true }`, `signUp.email()` client method, /signup page |
| AUTH-02 | User can log in and stay logged in across sessions | Better Auth persistent session cookie, `nextCookies()` plugin, `auth.api.getSession()` server-side check, long-lived session config |
| AUTH-03 | User can log out from any page | Better Auth `signOut()` client method, accessible from sidebar in all authenticated layouts |
| LINK-01 | User can save a link by pasting a URL in the web app | URL input bar (desktop) / FAB modal (mobile), POST /api/links → immediate 202, enqueue pg-boss job |
| LINK-02 | System auto-fetches page title and OG image/favicon on save | pg-boss scrape job, Cheerio fast path for OG/title, status polling back to client |
| LINK-03 | System detects and handles duplicate URLs on save | Unique constraint on (user_id, url), check before insert, return 409-style warning with override option |
| LINK-04 | User can delete a saved link | DELETE /api/links/[id] route handler, optimistic removal from UI list |
</phase_requirements>

---

## Summary

Phase 1 establishes the entire foundation that subsequent phases build on. It covers three interconnected areas: the auth system (Better Auth 1.5 with Drizzle adapter on Neon), the async link-save pipeline (pg-boss queue backed by direct Neon connection, Cheerio scraping, progressive UI updates), and the full UI shell (Next.js 15 App Router layout, shadcn/ui components, Tailwind v4).

The stack is well-established as of March 2026. Better Auth 1.5 is the community standard for email/password auth in Next.js 15 App Router projects; Lucia Auth was deprecated in March 2025. The pg-boss + Neon combination has one validated concern from STATE.md: pg-boss workers must use Neon's **direct** connection string (without `-pooler`) because LISTEN/NOTIFY and certain advisory lock patterns are incompatible with PgBouncer transaction mode. Neon's direct connections are limited by compute `max_connections` (typically ~100–400 on free tier), so the worker process should use a small, bounded Node.js `pg` connection pool rather than opening one connection per job. For the API routes (Next.js serverless), use Neon's pooled (`-pooler`) string with `@neondatabase/serverless`.

The UI architecture is straightforward: App Router layout with route groups for `(auth)` and `(dashboard)`, shadcn/ui component primitives, Tailwind v4 CSS-first theming, and SWR polling to watch links transition from `pending` → `scraped` → `ready`.

**Primary recommendation:** Build in this order within the phase — (1) DB schema + migrations, (2) Better Auth + auth pages, (3) link ingestion API + pg-boss queue, (4) Cheerio scrape worker, (5) UI shell + dashboard layout, (6) link card with pending/shimmer state.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | Full-stack React framework | App Router + Server Actions; v15 is battle-tested, v16 still maturing |
| React | 19.x | UI runtime | Required by Next.js 15; concurrent features load-bearing |
| TypeScript | 5.x | Type safety | Required for complex domain types across all layers |
| Tailwind CSS | 4.x | Styling | CSS-first (no JS config); ~70% smaller output than v3; standard Next.js pairing |
| shadcn/ui | latest (CLI) | Component primitives | Copy-owned components; fully compatible with Tailwind v4 + React 19 |
| Better Auth | 1.5.x | Email/password auth | Community standard post-Lucia deprecation; first-class App Router support; scrypt hashing; OWASP email enumeration protection |
| Drizzle ORM | 0.45.x | Database access | SQL-first, TypeScript-native; ~7.4 KB; zero cold-start penalty |
| drizzle-kit | 0.28.x | DB migrations | Keep in sync with drizzle-orm version |
| Neon | managed | Serverless Postgres hosting | Scale-to-zero; preview branches; native Next.js/Vercel integration |
| pg-boss | 10.x | Job queue for async enrichment | Built on Postgres SKIP LOCKED; eliminates Redis; exactly-once delivery |
| Cheerio | latest | HTML parsing + OG metadata | 70% faster than headless browsers for static HTML; extracts og:title, og:image, favicon |
| SWR | latest | Client-side polling | Lightweight; built-in `refreshInterval` for pending→ready state transitions |
| Zod | 3.x | Schema validation | All API inputs + form validation |
| React Hook Form | 7.x | Form state | Zod resolver; covers auth forms and URL input |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @neondatabase/serverless | latest | Neon HTTP driver for Next.js API routes | Use in `lib/db/client.ts` for all Route Handlers (serverless context) |
| pg (node-postgres) | 8.x | Direct Postgres driver | Use ONLY in pg-boss worker process (non-serverless, direct connection) |
| nanoid | 5.x | ID generation | If needed for client-generated IDs; UUIDs from Postgres preferred |
| date-fns | 3.x | Date formatting | Relative time display on link cards ("2 hours ago") |
| next-themes | latest | Dark mode | Integrates with shadcn/ui theming |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Better Auth | Auth.js v5 | Auth.js optimized for OAuth; email/password intentionally harder |
| pg-boss | BullMQ | BullMQ requires Redis — adds infra cost; pg-boss reuses existing Postgres |
| SWR polling | Server-Sent Events | SSE more efficient but adds persistent connection complexity; polling fine for bookmark enrichment latency (3-30s) |
| Cheerio (Phase 1) | Playwright | Playwright spins Chromium per job; ~10x memory; defer to Phase 2 for JS-heavy sites |

**Installation:**
```bash
# Framework (greenfield)
npx create-next-app@15 pageslop --typescript --tailwind --app --src-dir --import-alias "@/*"

# UI components
npx shadcn@latest init

# Auth
npm install better-auth

# DB
npm install drizzle-orm @neondatabase/serverless pg
npm install -D drizzle-kit

# Job queue
npm install pg-boss

# Scraping (Phase 1 fast path only)
npm install cheerio

# Client state + validation
npm install swr zod react-hook-form @hookform/resolvers

# Utilities
npm install date-fns next-themes

# Dev
npm install -D @biomejs/biome vitest @vitejs/plugin-react
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/                    # Unauthenticated route group
│   │   ├── login/page.tsx         # /login
│   │   ├── signup/page.tsx        # /signup
│   │   └── layout.tsx             # Centered auth layout
│   ├── (dashboard)/               # Authenticated app shell
│   │   ├── layout.tsx             # Sidebar + URL input bar
│   │   ├── page.tsx               # /  → links grid (default)
│   │   ├── onboarding/page.tsx    # /onboarding (post-signup)
│   │   └── settings/page.tsx      # /settings
│   ├── api/
│   │   ├── auth/[...all]/route.ts # Better Auth handler
│   │   └── links/
│   │       ├── route.ts           # POST (save), GET (list)
│   │       └── [id]/route.ts      # DELETE
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # / → marketing page (unauthenticated)
│
├── workers/
│   └── scrape.worker.ts           # pg-boss worker; runs as separate Node process
│
├── lib/
│   ├── db/
│   │   ├── client.ts              # Neon serverless driver for API routes
│   │   ├── worker-client.ts       # pg (node-postgres) for worker process
│   │   ├── schema.ts              # Drizzle: users, sessions, links, raw_content
│   │   └── queries/
│   │       ├── links.ts           # insert, list, delete, duplicate check
│   │       └── auth.ts            # (managed by Better Auth adapter)
│   ├── auth/
│   │   ├── server.ts              # betterAuth() instance + Drizzle adapter
│   │   └── client.ts             # createAuthClient() for browser
│   ├── queue/
│   │   └── boss.ts                # PgBoss instance (singleton for worker)
│   └── scraper/
│       └── cheerio.ts             # OG tag + title + favicon extraction
│
├── components/
│   ├── links/
│   │   ├── LinkCard.tsx           # Grid card with shimmer state
│   │   ├── LinkCardList.tsx       # Compact row variant
│   │   ├── LinkGrid.tsx           # Grid/list toggle container
│   │   ├── LinkDetail.tsx         # Modal/sheet detail view
│   │   ├── LinkSkeleton.tsx       # Shimmer placeholder
│   │   └── SaveURLInput.tsx       # Desktop persistent bar + multi-line
│   ├── layout/
│   │   ├── Sidebar.tsx            # Left nav: All Links, Tags, Graph, Settings
│   │   └── MobileFAB.tsx          # Floating action button + paste modal
│   └── ui/                        # shadcn/ui primitives (Button, Toast, Dialog…)
│
└── types/
    └── index.ts                   # Link, LinkStatus, User types
```

### Pattern 1: Async Save Pipeline (MANDATORY)

**What:** POST /api/links inserts the link immediately with `status: 'pending'`, enqueues a pg-boss scrape job, and returns 202. The UI shows the card in a skeleton/shimmer state. The worker scrapes, updates the DB, and the client polls until status transitions to `ready`.

**When to use:** Every time a URL is saved. Never block the HTTP response on scraping.

**Example:**
```typescript
// src/app/api/links/route.ts
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { urls } = await req.json()
  const urlList = urls.split('\n').map((u: string) => u.trim()).filter(Boolean)

  const saved = []
  for (const url of urlList) {
    // Duplicate check
    const existing = await db.query.links.findFirst({
      where: and(eq(links.userId, session.user.id), eq(links.url, url))
    })
    if (existing) {
      saved.push({ ...existing, duplicate: true })
      continue
    }

    const [link] = await db.insert(links)
      .values({ url, userId: session.user.id, status: 'pending' })
      .returning()

    await boss.send('scrape', { linkId: link.id, url })
    saved.push(link)
  }

  return Response.json(saved, { status: 202 })
}
```

### Pattern 2: Better Auth Setup for Next.js 15 App Router

**What:** Auth instance with Drizzle adapter + `nextCookies()` plugin. Route handler mounts at `/api/auth/[...all]`. Client-side auth uses `createAuthClient()`.

**Example:**
```typescript
// src/lib/auth/server.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/lib/db/client'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  session: {
    expiresIn: 60 * 60 * 24 * 30,    // 30 days (persistent sessions)
    updateAge: 60 * 60 * 24,          // refresh if >24h old
  },
  plugins: [nextCookies()],           // must be last
})

// src/app/api/auth/[...all]/route.ts
import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth/server'
export const { GET, POST } = toNextJsHandler(auth)

// src/lib/auth/client.ts
import { createAuthClient } from 'better-auth/react'
export const authClient = createAuthClient()
```

**Session in Server Components:**
```typescript
import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'

const session = await auth.api.getSession({ headers: await headers() })
if (!session) redirect('/login')
```

### Pattern 3: pg-boss Worker with Direct Neon Connection

**What:** The pg-boss worker is a separate long-lived Node.js process. It must connect to Neon via the **direct** connection string (port 5432, no `-pooler` in hostname), not the serverless HTTP driver.

**Why:** Neon's PgBouncer pooler uses transaction mode; pg-boss uses session-level advisory locks during `start()`. LISTEN/NOTIFY (used by pg-boss for instant job notification) also requires direct connections.

**Example:**
```typescript
// src/workers/scrape.worker.ts
import PgBoss from 'pg-boss'
import { Pool } from 'pg'
import { scrapeUrl } from '@/lib/scraper/cheerio'
import { db } from '@/lib/db/worker-client'
import { links } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// DIRECT connection (no -pooler in hostname)
const boss = new PgBoss(process.env.DATABASE_URL_DIRECT!)

boss.on('error', console.error)

async function main() {
  await boss.start()

  await boss.work('scrape', { teamSize: 5 }, async (job) => {
    const { linkId, url } = job.data as { linkId: string; url: string }

    try {
      const { title, description, ogImage, favicon } = await scrapeUrl(url)
      await db.update(links)
        .set({ title, description, ogImage, favicon, status: 'ready' })
        .where(eq(links.id, linkId))
    } catch (err) {
      await db.update(links)
        .set({ status: 'error' })
        .where(eq(links.id, linkId))
    }
  })
}

main()
```

**Environment variables needed:**
```
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require  # pooler (API routes)
DATABASE_URL_DIRECT=postgresql://...@ep-....neon.tech/neondb?sslmode=require  # direct (worker)
```

### Pattern 4: Client-Side Pending State with SWR Polling

**What:** After saving, cards appear immediately in `pending` state. SWR polls `GET /api/links` with a short interval until all cards reach `ready`, then stops polling.

**Example:**
```typescript
// components/links/LinkGrid.tsx
'use client'
import useSWR from 'swr'

export function LinkGrid() {
  const hasPending = data?.some(l => l.status === 'pending')

  const { data } = useSWR('/api/links', fetcher, {
    refreshInterval: hasPending ? 2000 : 0,  // Poll only while pending
    revalidateOnFocus: true,
  })

  // Optimistic add on save (mutate() with new link prepended)
}
```

### Pattern 5: Duplicate Detection

**What:** Check for existing (user_id, url) pair before insert. Return the existing record with a `duplicate: true` flag. Client shows "Already saved" toast with an option to save anyway (re-insert).

**Schema constraint:**
```typescript
// In Drizzle schema — unique constraint prevents silent duplicates
export const links = pgTable('links', {
  // ... fields
}, (table) => ({
  uniqueUserUrl: unique().on(table.userId, table.url),
}))
```

**API behavior:** Query before insert. If found, return `{ ...link, duplicate: true }` with status 200 (not 409 — the UI presents a choice, not an error). If user confirms save again, a second POST with `{ force: true }` bypasses the check and inserts regardless.

### Pattern 6: Progressive Skeleton Shimmer

**What:** A card in `pending` state renders a `LinkSkeleton` with animated shimmer. As enrichment completes (title arrives, then OG image), the real data fills in via SWR revalidation. The card never disappears and reappears — it transitions in place.

**Implementation approach:**
```typescript
// components/links/LinkCard.tsx
export function LinkCard({ link }: { link: Link }) {
  if (link.status === 'pending') return <LinkSkeleton />

  return (
    <div className="link-card">
      {link.ogImage ? (
        <img src={link.ogImage} alt="" className="hero-image" />
      ) : (
        <FaviconColorFallback favicon={link.favicon} url={link.url} />
      )}
      {/* title, description, tags */}
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Scraping synchronously in the API route:** Never await `scrapeUrl()` inside the POST handler. Always enqueue and return 202 immediately. Scraping can take 2-30 seconds; Vercel/serverless functions timeout at 10-30s.
- **Using Neon's pooled connection string for pg-boss:** Causes silent failures or errors due to PgBouncer transaction mode incompatibility with session-level features.
- **Storing raw HTML in the `links` table:** Bloats table, slows list queries. Use a separate `raw_content` table (can be dropped after processing).
- **Returning full session token in API responses:** Better Auth handles session cookies — never manually embed token values in response bodies.
- **Using ILIKE search from day 1:** Creates a full-table scan path. The `links` table should have a `search_vector` tsvector column with GIN index from the initial schema.

---

## Database Schema (Phase 1)

The schema established here is the foundation for all phases. Design choices made now are expensive to change later.

```typescript
// src/lib/db/schema.ts
import { pgTable, text, timestamp, boolean, unique, index } from 'drizzle-orm/pg-core'

// Better Auth manages: user, session, account, verification tables
// (generated via: npx @better-auth/cli generate)

export const links = pgTable('links', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:      text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  url:         text('url').notNull(),
  title:       text('title'),
  description: text('description'),
  ogImage:     text('og_image'),
  favicon:     text('favicon'),
  domain:      text('domain'),               // extracted from url for display
  status:      text('status').notNull().default('pending'), // pending | ready | error
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
  // FTS — Phase 1 schema stub (populated by trigger or update in Phase 3)
  // searchVector: ... add tsvector + GIN index in migration for Phase 3
}, (table) => ({
  uniqueUserUrl: unique().on(table.userId, table.url),
  userIdIdx:    index().on(table.userId),
  statusIdx:    index().on(table.status),
  createdIdx:   index().on(table.createdAt),
}))

export const rawContent = pgTable('raw_content', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  linkId:    text('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  bodyText:  text('body_text'),              // extracted article text (for Phase 2 classification)
  rawHtml:   text('raw_html'),               // temporary; can be nulled after processing
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
})

// Tags: flexible string-based (NOT enum) — critical for Phase 2 compatibility
export const tags = pgTable('tags', {
  id:     text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name:   text('name').notNull(),           // normalized: lowercase, trimmed
  source: text('source').notNull().default('user'), // user | rule | llm
}, (table) => ({
  uniqueUserTag: unique().on(table.userId, table.name),
}))

export const linkTags = pgTable('link_tags', {
  linkId: text('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  tagId:  text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
})
```

**Critical schema decisions (cannot change cheaply later):**
- Tags are strings with a `source` field — never enums
- `raw_content` is a separate table from `links`
- `status` field on links drives the UI pending state
- Unique constraint on `(user_id, url)` for duplicate detection
- `domain` stored separately for fast favicon+domain display without URL parsing

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth session management | Custom JWT/cookie handling | Better Auth | Scrypt hashing, timing-safe comparison, OWASP email enumeration protection, session rotation |
| Job queue | `setInterval` + DB polling | pg-boss | SKIP LOCKED, exactly-once delivery, retry backoff, dead letter queue, scheduled jobs |
| OG metadata extraction | Manual `<meta>` regex parsing | Cheerio + structured selectors | Handles malformed HTML, entity encoding, relative URLs, charset detection |
| Form validation | Manual `event.target.value` checks | Zod + React Hook Form | Type inference, error messages, async validation, nested objects |
| Component primitives | Custom Dialog/Toast/Button | shadcn/ui | Accessibility (ARIA, focus trapping), keyboard navigation, screen reader support — hard to get right from scratch |
| Favicon color fallback | Complex per-domain color mapping | Hash URL domain to HSL | Simple: `hsl(hash(domain) % 360, 70%, 50%)` — deterministic, always readable, no external dependency |

**Key insight:** Auth and job queue are the two highest-risk hand-roll targets in this phase. Both have security and reliability edge cases (session fixation, job duplication, retry storms) that take months of production experience to discover. Use the libraries.

---

## Common Pitfalls

### Pitfall 1: Using Neon Pooler Connection for pg-boss
**What goes wrong:** pg-boss fails to start or behaves inconsistently because PgBouncer transaction mode interrupts session-level advisory locks used during `boss.start()`. LISTEN/NOTIFY (used for instant job pickup) also requires a persistent session connection.
**Why it happens:** Neon provides one connection string by default; the pooler URL is what appears in the Neon dashboard first. Developers copy it for everything.
**How to avoid:** Set two environment variables: `DATABASE_URL` (pooler, for API routes) and `DATABASE_URL_DIRECT` (direct, for pg-boss worker). The direct URL removes `-pooler` from the hostname.
**Warning signs:** pg-boss logs advisory lock warnings; jobs are not picked up promptly; worker crashes on `boss.start()`.

### Pitfall 2: Blocking Save on Scraping
**What goes wrong:** The URL save feels slow (2-30 second wait). On serverless, the function times out before scraping completes, losing the save entirely.
**Why it happens:** Natural implementation instinct is to scrape before returning success.
**How to avoid:** Insert link immediately with `status: 'pending'`, enqueue job, return 202 immediately. This is non-negotiable.
**Warning signs:** No `status` field in schema; no job queue; API route contains `await fetch(url)` before `db.insert()`.

### Pitfall 3: Classification Taxonomy Lock-In
**What goes wrong:** Tags defined as Postgres ENUMs or hardcoded string constants. Phase 2 (classification) needs to insert arbitrary keyword-derived tags, breaking the constraint.
**Why it happens:** Enums feel "clean" for a fixed set of categories.
**How to avoid:** Tags are free-form strings with a `source` field from day one. See schema above.
**Warning signs:** `category ENUM('tech', 'news', ...)` in schema.

### Pitfall 4: Missing User Scope on All Queries
**What goes wrong:** User A can access User B's links by guessing link IDs. Row-level data isolation fails.
**Why it happens:** Query by `id` alone without checking `userId`.
**How to avoid:** Every query that accepts a user-supplied ID must include `AND user_id = $session.user.id`. This must be enforced from day one — retrofitting is error-prone.
**Warning signs:** Any `db.query.links.findFirst({ where: eq(links.id, id) })` without `userId` filter.

### Pitfall 5: Drizzle + drizzle-kit Version Mismatch
**What goes wrong:** Migration generation fails with cryptic errors about incompatible schema versions.
**Why it happens:** `npm install drizzle-orm` and `npm install drizzle-kit` default to latest independently; they can drift.
**How to avoid:** Pin both in `package.json`. `drizzle-orm@0.45.x` pairs with `drizzle-kit@0.28.x`. Check official docs when upgrading either.
**Warning signs:** `drizzle-kit generate` produces empty migrations or throws schema parse errors.

### Pitfall 6: pg-boss on Neon Scale-to-Zero
**What goes wrong:** Neon computes scale to zero after 5 minutes idle. When the worker process wakes Neon up via the direct connection, the first query has 300-500ms cold start latency. If the worker has a short job timeout, it may fail the first job after a cold start.
**How to avoid:** Set pg-boss `executionTimeout` to at least 10 seconds. The 300-500ms cold start is one-time per wake; subsequent jobs are fast. Consider using Neon's "scale to zero" setting with a minimum compute size if cold starts cause consistent issues.
**Warning signs:** First job after idle fails consistently; subsequent jobs succeed.

---

## Code Examples

Verified patterns from official sources:

### Better Auth Signup (client component)
```typescript
// Source: https://better-auth.com/docs/integrations/next
'use client'
import { authClient } from '@/lib/auth/client'
import { useRouter } from 'next/navigation'

export function SignUpForm() {
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    const { error } = await authClient.signUp.email({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      name: formData.get('name') as string,
      callbackURL: '/onboarding',
    })
    if (!error) router.push('/onboarding')
  }
  // ...
}
```

### Better Auth Sign In (client component)
```typescript
// Source: https://better-auth.com/docs/integrations/next
const { error } = await authClient.signIn.email({
  email,
  password,
  callbackURL: '/',
})
```

### Better Auth Sign Out (from any component)
```typescript
await authClient.signOut()
router.push('/login')
```

### Neon Client Setup (for API routes — serverless context)
```typescript
// src/lib/db/client.ts
// Source: https://neon.com/docs/guides/drizzle
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle({ client: sql, schema })
```

### Worker DB Client (direct connection)
```typescript
// src/lib/db/worker-client.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const pool = new Pool({ connectionString: process.env.DATABASE_URL_DIRECT!, max: 5 })
export const db = drizzle({ client: pool, schema })
```

### Cheerio OG Extraction
```typescript
// src/lib/scraper/cheerio.ts
import * as cheerio from 'cheerio'

export async function scrapeUrl(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pageslop/1.0)' },
    signal: AbortSignal.timeout(8000),  // 8s hard timeout
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  return {
    title:       $('meta[property="og:title"]').attr('content') || $('title').text() || '',
    description: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '',
    ogImage:     $('meta[property="og:image"]').attr('content') || null,
    favicon:     $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || null,
  }
}
```

### Drizzle Kit Config
```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT! }, // direct for migrations
} satisfies Config
```

### Favicon Color Fallback (deterministic)
```typescript
// Generates consistent color per domain without external dependency
function domainToHue(domain: string): number {
  let hash = 0
  for (const char of domain) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

// Usage: style={{ backgroundColor: `hsl(${domainToHue(domain)}, 65%, 55%)` }}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Lucia Auth | Better Auth 1.5.x | March 2025 (Lucia deprecated) | All Lucia tutorials are now dead code; use Better Auth |
| NextAuth v4 | Auth.js v5 (or Better Auth) | 2024 | NextAuth v4 deprecated |
| Tailwind JS config | CSS-first @theme directive | Tailwind v4 (2025) | No `tailwind.config.ts` needed; theme in globals.css |
| `npm install shadcn-ui` | `npx shadcn@latest` CLI | 2024 | Components are copied into project, not installed as a package |
| Prisma (Rust engine) | Drizzle ORM | 2024-2025 | Prisma v4 had cold start issues; Drizzle eliminates them |
| Redis + BullMQ for queues | pg-boss (Postgres-backed) | Ongoing | For this workload, pg-boss eliminates Redis dependency |

**Deprecated/outdated:**
- Lucia Auth: deprecated March 2025, no longer maintained — any tutorial referencing it is stale
- NextAuth v4: deprecated — use Auth.js v5 or Better Auth
- Tailwind `tailwind.config.js` with `content: [...]`: replaced by automatic content detection in v4
- `@tailwind base; @tailwind components; @tailwind utilities`: replaced by `@import "tailwindcss"` in v4
- `npx shadcn-ui@latest init` (old package name): use `npx shadcn@latest init`

---

## Open Questions

1. **pg-boss cold start on Neon (validated blocker from STATE.md)**
   - What we know: pg-boss needs direct connection; Neon direct connections have 300-500ms cold start after idle
   - What's unclear: Whether pg-boss's internal timeout for job polling interacts poorly with repeated cold starts under the free-tier compute size
   - Recommendation: Set `executionTimeout: 15000` in pg-boss worker options; accept the first job after idle may be slow. If it becomes a persistent problem, upgrade Neon to a paid tier with "suspend compute" turned off.

2. **Worker hosting: where does the pg-boss worker process run?**
   - What we know: Next.js serverless functions cannot host a long-lived worker process; Vercel cron jobs are limited to 15 minutes
   - What's unclear: Whether the project will deploy to Render or Railway for the worker in Phase 1
   - Recommendation: Plan for a separate `Procfile` entry or `worker.ts` entrypoint that runs as a separate process. Even locally, `npm run worker` should start `src/workers/scrape.worker.ts`. In production, use Render's Background Worker service or Railway's persistent dyno. This must be decided before the first deployment.

3. **Better Auth `usePlural` setting**
   - What we know: By default Better Auth expects singular table names (`user`, `session`). If Drizzle schema uses plural (`users`, `sessions`), the adapter must be configured with `usePlural: true` or explicit table name mappings.
   - What's unclear: The exact behavior when Better Auth generates schema via `npx @better-auth/cli generate` vs. when manually writing Drizzle schema
   - Recommendation: Use `npx @better-auth/cli generate` first to get the canonical schema, then add application tables (`links`, `tags`, etc.) alongside. Do not rename Better Auth tables.

---

## Validation Architecture

nyquist_validation is enabled (config.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (no config exists yet — Wave 0 creates it) |
| Config file | `vitest.config.ts` — Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Signup creates user + session | unit | `npx vitest run tests/auth/signup.test.ts -t "creates user"` | ❌ Wave 0 |
| AUTH-01 | Duplicate email rejected | unit | `npx vitest run tests/auth/signup.test.ts -t "rejects duplicate email"` | ❌ Wave 0 |
| AUTH-02 | Login returns valid session | unit | `npx vitest run tests/auth/login.test.ts -t "returns session"` | ❌ Wave 0 |
| AUTH-02 | Session persists (long-lived) | unit | `npx vitest run tests/auth/session.test.ts -t "session expiry"` | ❌ Wave 0 |
| AUTH-03 | Logout invalidates session | unit | `npx vitest run tests/auth/logout.test.ts -t "invalidates session"` | ❌ Wave 0 |
| LINK-01 | POST /api/links returns 202 immediately | unit | `npx vitest run tests/api/links.test.ts -t "returns 202"` | ❌ Wave 0 |
| LINK-01 | Multi-URL paste creates multiple pending links | unit | `npx vitest run tests/api/links.test.ts -t "batch save"` | ❌ Wave 0 |
| LINK-02 | scrapeUrl extracts title + ogImage | unit | `npx vitest run tests/scraper/cheerio.test.ts -t "extracts OG data"` | ❌ Wave 0 |
| LINK-02 | Scrape job enqueued on save | unit | `npx vitest run tests/api/links.test.ts -t "enqueues scrape job"` | ❌ Wave 0 |
| LINK-03 | Duplicate URL returns duplicate:true flag | unit | `npx vitest run tests/api/links.test.ts -t "duplicate detection"` | ❌ Wave 0 |
| LINK-03 | Force save bypasses duplicate check | unit | `npx vitest run tests/api/links.test.ts -t "force save"` | ❌ Wave 0 |
| LINK-04 | DELETE /api/links/[id] removes link | unit | `npx vitest run tests/api/links/[id].test.ts -t "deletes link"` | ❌ Wave 0 |
| LINK-04 | Cannot delete another user's link | unit | `npx vitest run tests/api/links/[id].test.ts -t "user scope"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose` (fast, < 30s)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — framework config
- [ ] `tests/setup.ts` — shared test setup (mock DB, mock pg-boss)
- [ ] `tests/auth/signup.test.ts` — covers AUTH-01
- [ ] `tests/auth/login.test.ts` — covers AUTH-02
- [ ] `tests/auth/logout.test.ts` — covers AUTH-03
- [ ] `tests/api/links.test.ts` — covers LINK-01, LINK-02, LINK-03
- [ ] `tests/api/links/[id].test.ts` — covers LINK-04
- [ ] `tests/scraper/cheerio.test.ts` — covers LINK-02 scraper unit

---

## Sources

### Primary (HIGH confidence)
- [Better Auth Next.js Integration](https://better-auth.com/docs/integrations/next) — route handler setup, `nextCookies()`, session in RSC
- [Better Auth Drizzle Adapter](https://better-auth.com/docs/adapters/drizzle) — schema generation, `usePlural`, provider config
- [Better Auth email/password docs](https://better-auth.com/docs/authentication/email-password) — scrypt, OWASP compliance
- [Neon: Choose Connection Method](https://neon.com/docs/connect/choose-connection) — direct vs pooled, LISTEN/NOTIFY requires direct
- [Drizzle ORM + Neon](https://orm.drizzle.team/docs/tutorials/drizzle-with-neon) — `neon-http` driver setup
- [Neon + Drizzle migrations guide](https://neon.com/docs/guides/drizzle-migrations) — migration workflow
- [pg-boss GitHub](https://github.com/timgit/pg-boss) — SKIP LOCKED, advisory lock behavior

### Secondary (MEDIUM confidence)
- [STACK.md](../../research/STACK.md) — pre-researched stack verified with official sources 2026-03-16
- [ARCHITECTURE.md](../../research/ARCHITECTURE.md) — async pipeline pattern, project structure
- [Tailwind v4 + shadcn/ui official docs](https://ui.shadcn.com/docs/tailwind-v4) — CSS-first config, CLI setup
- [PgBouncer advisory lock incompatibility](https://github.com/bensheldon/good_job/issues/52) — session-level advisory locks + transaction pooling issue confirmed

### Tertiary (LOW confidence — flagged for validation)
- [pg-boss advisory lock behavior with pgBouncer transaction mode](https://github.com/timgit/pg-boss/issues) — `pg_advisory_xact_lock` claimed compatible, but pg-boss LISTEN/NOTIFY still needs direct connection; use direct connection string regardless

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via official docs (Better Auth, Neon, Drizzle, shadcn/ui)
- Architecture: HIGH — async pipeline pattern is well-established; UI structure is conventional App Router
- Pitfalls: HIGH for pg-boss/Neon pooler issue (multiple sources); MEDIUM for cold start interaction with worker timeout
- Schema decisions: HIGH — tag flexibility and raw_content separation are validated patterns from PITFALLS.md

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack; re-verify Better Auth changelog if >30 days)
