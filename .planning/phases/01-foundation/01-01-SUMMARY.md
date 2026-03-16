---
phase: 01-foundation
plan: "01"
subsystem: database
tags: [nextjs, tailwind, shadcn, drizzle-orm, neon, pg-boss, better-auth, vitest, typescript]

# Dependency graph
requires: []
provides:
  - Next.js 15 App Router project with Tailwind v4 and shadcn/ui components
  - Drizzle ORM schema: user, session, account, verification (Better Auth tables) plus links, rawContent, tags, linkTags
  - Neon serverless DB client for API routes (src/lib/db/client.ts)
  - node-postgres direct DB client for worker process (src/lib/db/worker-client.ts)
  - TypeScript types: Link, LinkStatus, Tag, LinkTag, SaveLinksRequest, SaveLinksResponse
  - Vitest test infrastructure with mocked DB/queue drivers
  - drizzle.config.ts for migration workflow
affects: [01-02, 01-03, 01-04, 01-05, 01-06]

# Tech tracking
tech-stack:
  added:
    - next@15.5.12
    - react@19.1.0
    - typescript@5.x
    - tailwindcss@4.x
    - shadcn/ui (new-york, zinc base)
    - better-auth@1.5.5
    - drizzle-orm@0.45.1
    - drizzle-kit@0.31.9
    - "@neondatabase/serverless@1.0.2"
    - pg@8.20.0
    - pg-boss@12.14.0
    - cheerio@1.2.0
    - swr@2.4.1
    - zod@4.3.6
    - react-hook-form@7.71.2
    - "@hookform/resolvers"
    - date-fns@4.1.0
    - next-themes@0.4.6
    - lucide-react
    - class-variance-authority
    - clsx + tailwind-merge
    - tw-animate-css
    - vitest@4.1.0
    - "@vitejs/plugin-react"
    - "@biomejs/biome"
  patterns:
    - Two DB clients: serverless (neon-http) for API routes, node-postgres Pool for worker
    - Tags as free-form strings with source field (not enums) — Phase 2 compatible
    - Unique constraint on (userId, url) for duplicate link detection
    - Separate rawContent table to avoid bloating links table
    - status field on links drives UI pending/ready/error state

key-files:
  created:
    - src/lib/db/schema.ts
    - src/lib/db/client.ts
    - src/lib/db/worker-client.ts
    - src/types/index.ts
    - drizzle.config.ts
    - vitest.config.ts
    - tests/setup.ts
    - src/app/globals.css
    - src/app/layout.tsx
    - src/lib/utils.ts
    - components.json
    - .env.example
  modified:
    - package.json

key-decisions:
  - "Use @tailwindcss/oxide-darwin-arm64 and @rolldown/binding-darwin-arm64 explicitly — npm optional deps don't install native bindings on Node 25 without explicit install"
  - "dark mode via next-themes class attribute (not prefers-color-scheme media query) — required for class-based dark: utilities in Tailwind v4"
  - "Tags are free-form strings with source field — never enums — preserves Phase 2 classification compatibility"
  - "Two separate DB clients: serverless HTTP for API routes (no LISTEN/NOTIFY), direct pg Pool for worker (pg-boss requires session-level advisory locks)"
  - "Build uses non-turbopack mode for production (turbopack removed from build script) — turbopack has compatibility issues"

patterns-established:
  - "Pattern: Two DB clients — neon-http client for serverless API routes, pg Pool (max: 5) for long-lived worker process"
  - "Pattern: Vitest mocks for @neondatabase/serverless, pg, and pg-boss in tests/setup.ts — all test files get these automatically"
  - "Pattern: shadcn components at src/components/ui/ — copy-owned, not installed as package dependency"

requirements-completed: [LINK-02, LINK-03]

# Metrics
duration: 10min
completed: 2026-03-16
---

# Phase 1 Plan 01: Foundation Scaffold Summary

**Next.js 15 App Router with Drizzle schema (links/tags/rawContent), dual DB clients (neon-http + pg Pool), shadcn/ui violet-dark theme, and Vitest infrastructure**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-16T06:10:48Z
- **Completed:** 2026-03-16T06:21:00Z
- **Tasks:** 2
- **Files modified:** 13 created, 1 modified

## Accomplishments
- Next.js 15 project scaffolded with all 20+ Phase 1 dependencies installed and building cleanly
- Drizzle schema defines 7 tables: user, session, account, verification (Better Auth), links, rawContent, tags, linkTags — with correct unique constraints and indexes
- Two DB clients created: neon-http for serverless API routes, node-postgres Pool for worker (pg-boss compatibility)
- shadcn/ui initialized with 15 components and violet/dark design system from UI-SPEC
- Vitest configured with mocked DB/queue drivers; TypeScript compiles without errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 15 project and install all Phase 1 dependencies** - `2aa0f2b` (feat)
2. **Task 2: Define Drizzle schema, DB clients, types, Vitest config, and drizzle.config.ts** - `cc188f2` (feat)

**Plan metadata:** (pending — created in final commit)

## Files Created/Modified
- `src/lib/db/schema.ts` - Drizzle schema: user/session/account/verification + links/rawContent/tags/linkTags
- `src/lib/db/client.ts` - Neon serverless HTTP client for API routes
- `src/lib/db/worker-client.ts` - node-postgres Pool client for worker process (direct connection)
- `src/types/index.ts` - Link, LinkStatus, Tag, LinkTag, SaveLinksRequest, SaveLinksResponse types
- `drizzle.config.ts` - Drizzle Kit config with postgresql dialect and DATABASE_URL_DIRECT
- `vitest.config.ts` - Vitest with node environment, @/* alias, tests/setup.ts
- `tests/setup.ts` - Mocks for @neondatabase/serverless, pg Pool, and pg-boss
- `src/app/globals.css` - Tailwind v4 CSS-first theme with violet accent (263 70% 58%) dark default
- `src/app/layout.tsx` - Inter font (400/600), ThemeProvider (dark default), Toaster
- `src/lib/utils.ts` - cn() utility using clsx + tailwind-merge
- `components.json` - shadcn config (new-york style, zinc base, CSS variables)
- `.env.example` - DATABASE_URL, DATABASE_URL_DIRECT, BETTER_AUTH_SECRET, BETTER_AUTH_URL
- `package.json` - added worker, db:generate, db:migrate, db:push, test, test:watch scripts

## Decisions Made
- Used explicit native binding packages (`@tailwindcss/oxide-darwin-arm64`, `@rolldown/binding-darwin-arm64`) because npm's optional dependency mechanism does not reliably install them with Node 25 on macOS arm64
- Removed `--turbopack` from the `build` script — turbopack is only appropriate for dev mode; production builds use webpack
- dark mode uses `class` attribute strategy (next-themes `attribute="class"`) rather than CSS `prefers-color-scheme`, enabling user-controlled theme toggle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing lucide-react**
- **Found during:** Task 1 (build verification)
- **Issue:** shadcn sonner component imports from `lucide-react` which was not in the plan's dependency list
- **Fix:** `npm install lucide-react`
- **Files modified:** package.json
- **Verification:** Build succeeded after install
- **Committed in:** 2aa0f2b (Task 1 commit)

**2. [Rule 3 - Blocking] Installed missing class-variance-authority**
- **Found during:** Task 1 (build verification — second pass)
- **Issue:** shadcn badge component imports from `class-variance-authority`, missing from install list
- **Fix:** `npm install class-variance-authority`
- **Files modified:** package.json
- **Verification:** Build succeeded after install
- **Committed in:** 2aa0f2b (Task 1 commit)

**3. [Rule 3 - Blocking] Installed @tailwindcss/oxide-darwin-arm64 native binding**
- **Found during:** Task 1 (build verification)
- **Issue:** `@tailwindcss/oxide` package requires explicit native binding install; npm optional deps skipped it
- **Fix:** `npm install @tailwindcss/oxide-darwin-arm64`
- **Files modified:** package.json
- **Verification:** Build no longer throws "Cannot find native binding" error
- **Committed in:** 2aa0f2b (Task 1 commit)

**4. [Rule 3 - Blocking] Installed @rolldown/binding-darwin-arm64 native binding**
- **Found during:** Task 2 (Vitest run verification)
- **Issue:** Vitest's rolldown bundler requires explicit native binding install on arm64 macOS
- **Fix:** `npm install @rolldown/binding-darwin-arm64`
- **Files modified:** package.json
- **Verification:** `npx vitest run` succeeded
- **Committed in:** cc188f2 (Task 2 commit)

**5. [Rule 3 - Blocking] Scaffolded into temp dir due to .planning/ conflict**
- **Found during:** Task 1 (create-next-app scaffolding)
- **Issue:** `create-next-app . --yes` refuses to run when target directory contains existing files (.planning/)
- **Fix:** Scaffolded to `/tmp/pageslop-scaffold`, then rsync'd files to project root
- **Files modified:** None (structural workaround)
- **Verification:** All files present and build succeeds

---

**Total deviations:** 5 auto-fixed (5 Rule 3 blocking)
**Impact on plan:** All auto-fixes were native binding installs and missing peer dependencies. No scope creep.

## Issues Encountered
- Node 18 incompatibility with several packages (pg-boss, cheerio, @tailwindcss/oxide, @neondatabase/serverless require Node >= 20). Resolved by switching to Homebrew Node 25 for all build/test commands. The project will require Node >= 20 at runtime.

## User Setup Required
None - no external service configuration required in this plan. Database connection requires .env file with Neon credentials (documented in .env.example) before running `db:migrate`.

## Next Phase Readiness
- All foundation files exist and TypeScript compiles cleanly
- Build succeeds (`npm run build` exits 0)
- Vitest runs with correct test infrastructure (mocks for DB/queue)
- Every subsequent plan can import from `@/lib/db/schema`, `@/lib/db/client`, `@/lib/db/worker-client`, and `@/types`
- Node >= 20 required to run (use `node@25` from Homebrew or NVM with v20+)

## Self-Check: PASSED

All 14 claimed files verified present on disk. Both task commits (2aa0f2b, cc188f2) verified in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-16*
