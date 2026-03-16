# Phase 1: Foundation - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Auth (email/password), link save with async enrichment pipeline, and the core UI shell. Users can create an account, log in, paste URLs, and see them saved immediately with a pending state while scraping/enrichment runs in the background. Duplicate detection on save. Delete a link. No classification, search, graph, or monitoring in this phase.

</domain>

<decisions>
## Implementation Decisions

### Auth Experience
- Separate /login and /signup pages (not tabbed on one page)
- Marketing/hero landing page at root — explains what Pageslop does with login/signup CTAs
- After signup, quick onboarding flow: guided "paste your first link" moment
- Persistent sessions — user stays logged in until explicit logout (long-lived session)

### Dashboard Layout
- Card grid and compact list views with a toggle — default to card grid
- Left sidebar navigation with views (All Links, Tags, Graph, Settings)
- Empty state for new users: large centered paste input with "Paste your first link" and illustration
- Link ordering: Claude's discretion (newest first is the likely default)

### Link Card Display
- Cards show: thumbnail/OG image as hero, favicon + domain, title + description, tag pills
- Fallback when no OG image: large favicon centered on a generated color background
- Clicking a card opens a detail view (expanded view with full details, tags, description) — separate button/link to visit the URL
- Cards in list view show same info in a compact row format

### Save UX Flow
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, BYOK model, key decisions
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-03, LINK-01 through LINK-04 requirements
- `.planning/ROADMAP.md` — Phase 1 success criteria and dependency info

### Research
- `.planning/research/STACK.md` — Stack recommendations (Next.js 15, Better Auth, Drizzle, Neon, pg-boss)
- `.planning/research/ARCHITECTURE.md` — Async enrichment pipeline pattern, two-tier scraping, component boundaries
- `.planning/research/PITFALLS.md` — Async save mandate, free hosting constraints, SSRF prevention

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes the patterns all subsequent phases follow

### Integration Points
- Database schema designed here will be the foundation for all phases
- Async job queue (pg-boss) established here is reused by enrichment (Phase 2) and monitoring (Phase 4)
- Auth system established here gates all subsequent features
- UI shell (sidebar, layout, card component) established here is the frame for all future views

</code_context>

<specifics>
## Specific Ideas

- Multi-line paste for batch link saving — users paste several URLs separated by newlines and all are saved at once
- Skeleton shimmer that fills in progressively (title first, then image, then tags) — not a single loading spinner
- Detail view on card click rather than navigating away — keeps user in the app
- Marketing landing page should convey the "zero management" value proposition

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-16*
