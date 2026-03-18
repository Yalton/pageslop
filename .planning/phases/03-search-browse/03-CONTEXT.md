# Phase 3: Search & Browse - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can find any saved link quickly and browse their collection in organized views at any scale. Includes full-text search, grouped-by-category view, tag browsing/filtering, and bookmark import/export. No new link input methods, no monitoring, no graph, no BYOK LLM in this phase.

</domain>

<decisions>
## Implementation Decisions

### Search experience
- Search input integrated in the top bar alongside the URL paste input — always visible on the dashboard
- Client-side filtering: filter the already-loaded SWR data in-memory as user types (instant, no API calls)
- Equal substring matching across title, tags, description, URL, and domain — no weighted ranking
- Search works in all view modes (grid, list, grouped) — filters results within the current view
- No results: simple "No links match 'xyz'" message with option to clear search

### Category grouped view
- Third view toggle added alongside Grid/List: a "Grouped" toggle on the dashboard
- Grouped view shows collapsible category sections with link count in header (e.g., "Technology (12)")
- All sections start expanded by default; user can collapse any
- Links within each category section display using the current sub-mode (grid cards or list rows)
- Search filters within grouped view — hides non-matching links and collapses empty categories

### Tag browsing & filtering
- Tags sidebar page enabled (/dashboard/tags) — shows alphabetical list of all tags with link count badges
- Filter input at top of Tags page to narrow the tag list
- Clicking a tag navigates to /dashboard?tag=react — normal dashboard filtered to that tag
- Active tag filter shown as a dismissable chip below the search bar
- Tag pills on link cards are clickable — clicking applies that tag as a filter (same as navigating from Tags page)
- Single tag filter only — one active tag at a time, clicking another tag switches the filter

### Import/export
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/hooks/useLinks.ts`: SWR hook fetching all `LinkWithTags[]` — search/filter can operate on this data client-side
- `src/components/links/LinkGrid.tsx`: Already has grid/list toggle with localStorage persistence — add grouped view as third option
- `src/components/links/LinkCard.tsx` + `LinkCardList.tsx`: Card and list row components — reuse in grouped view sections
- `src/components/links/LinkDetail.tsx`: Detail view with Dialog/Sheet — works with filtered results
- `src/components/layout/Sidebar.tsx`: Has disabled "Tags" and "Settings" nav items — enable them
- `src/workers/scrape.worker.ts`: pg-boss worker pattern — import processing reuses this queue infrastructure
- `src/components/links/TagEditor.tsx`: Tag pills with interaction — clickable tag pill behavior extends from this
- `src/components/links/CategorySelect.tsx`: Category dropdown — informs category header display in grouped view

### Established Patterns
- SWR with optimistic updates for all data mutations
- pg-boss queue for async background processing (scrape → enrich pipeline)
- View mode persisted in localStorage
- LinkWithTags as the standard type throughout all UI components
- Drizzle ORM with node-postgres for all DB operations

### Integration Points
- Search input sits alongside existing `SaveURLInput` in the top bar of `LinkGrid`
- Grouped view adds a third ViewMode option ('grouped') to existing grid/list toggle
- Tag filter via URL query param (?tag=react) — `useLinks` hook or LinkGrid reads this param
- Tags page is a new route /dashboard/tags with its own component
- Settings page is a new route /dashboard/settings with Data Management section
- Import API route parses HTML → creates links → queues scrape+enrich jobs via existing pipeline
- Export API routes query all user links with tags and generate JSON/HTML downloads

</code_context>

<specifics>
## Specific Ideas

- Tag pills on cards should be clickable to filter — natural discovery path for finding related links
- Import should feel seamless: upload, see progress, navigate away if you want — links appear in dashboard as they're processed
- Grouped view sections are collapsible for managing large collections with many categories
- Search + grouped view combo: searching within grouped view keeps the category structure, just filters content

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-search-browse*
*Context gathered: 2026-03-17*
