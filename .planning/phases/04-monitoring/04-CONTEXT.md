# Phase 4: Monitoring - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Scheduled uptime checks for saved links with a simple green/red/gray status dot on each card. No alerts, no uptime history, no dashboards — just a live status indicator. Users can manually trigger a recheck from the detail view.

</domain>

<decisions>
## Implementation Decisions

### Status indicator appearance
- Small colored dot next to the favicon/domain name on link cards (both grid and list views)
- Three states: green (up), red (down), gray (not yet checked)
- Dot has a tooltip on hover showing last checked time (e.g., "Last checked: 2 hours ago")
- Detail view shows: status dot, last checked timestamp, and a "Check now" button for manual recheck

### Check frequency & behavior
- System checks each link every 24 hours automatically
- Uses HTTP HEAD request (minimal bandwidth, fastest)
- 10-second timeout — no response within 10s counts as a failure
- Manual "Check now" button in detail view enqueues an immediate check via pg-boss
- Dot updates after check completes (via existing SWR polling pattern)

### Failure handling
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/workers/scrape.worker.ts`: pg-boss worker with queue pattern — uptime check can be a new `monitor` queue
- `src/components/links/LinkCard.tsx` + `LinkCardList.tsx`: Card components — add status dot next to domain
- `src/components/links/LinkDetail.tsx`: Detail view — add status dot, last-checked time, "Check now" button
- `src/lib/hooks/useLinks.ts`: SWR hook with polling — status data flows through existing `LinkWithTags` type
- `src/lib/db/schema.ts`: Links table — needs uptime columns (status code, checked timestamp, failure count)
- `src/components/ui/tooltip.tsx`: Tooltip component likely available via shadcn — use for dot hover

### Established Patterns
- pg-boss queue for async background jobs (scrape → enrich → now monitor)
- SWR with optimistic updates for real-time UI updates
- Worker uses direct DB connection (`DATABASE_URL_DIRECT`) for pg-boss LISTEN/NOTIFY
- Drizzle ORM for all DB operations

### Integration Points
- New `monitor` queue in pg-boss alongside existing `scrape` and `enrich` queues
- `links` table extended with uptime columns (lastCheckedAt, lastStatusCode, consecutiveFailures, uptimeStatus)
- LinkCard/LinkCardList render the dot based on `link.uptimeStatus`
- Detail view adds "Check now" button that calls a new API route
- Scheduled job (pg-boss cron or similar) enqueues all links for checking every 24h

</code_context>

<specifics>
## Specific Ideas

- Two consecutive failures before going red avoids false positives from transient network issues
- HEAD request keeps checks lightweight — no need to download page content
- Tooltip on the dot gives just enough context ("Last checked: 2h ago — 200 OK") without cluttering the card
- Manual recheck gives users control when they notice a link might be back up

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-monitoring*
*Context gathered: 2026-03-18*
