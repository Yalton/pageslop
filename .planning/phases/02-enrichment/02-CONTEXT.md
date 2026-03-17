# Phase 2: Enrichment - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Every saved link gets auto-generated tags, a brief description, and a category — using rule-based NLP with no LLM required. Users can manually edit tags, descriptions, and categories in the detail view. Existing links are retroactively enriched. Search, graph, and BYOK LLM are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Tag generation
- 2-4 tags per link, focused and high-signal
- Tags are topic + content-type mixed (e.g., "react", "tutorial", "documentation")
- Domain-aware hints: known domains (GitHub, YouTube, Wikipedia, etc.) contribute contextual tags
- Tags normalized to lowercase and merged ("React" and "react" become one tag)
- Tags stored with `source: 'rule'` in existing `tags` table

### Category taxonomy
- Fixed predefined list of ~8-12 broad categories (Technology, News, Reference, Entertainment, Shopping, Social, Education, Finance, Health, Creative, etc.)
- Exactly one category per link — no multi-category
- "Other" fallback bucket when system can't confidently classify
- Category stored as a field on the `links` table

### Description generation
- Use existing meta description (og:description or meta name=description) when available
- Only generate from body text when meta description is missing
- Generated descriptions: first meaningful paragraph extraction, ~150 chars (1-2 sentences)
- Scraper already stores `bodyText` (up to 5000 chars) in `raw_content` table

### Tag/description editing UX
- Tag editing: detail view only (cards show tags read-only)
- Tag interaction: pills with X to remove, input field below to type and add new tags (GitHub labels style)
- User-added tags stored with `source: 'user'`
- Description editing: click-to-edit in detail view — text becomes textarea on click, save on blur or Enter
- Category editing: dropdown in detail view, user can reassign from the fixed category list

### Backfill
- Retroactively enrich all existing links that have `raw_content` stored
- Run as a one-time background job on deployment

### Claude's Discretion
- Exact category list (aim for 8-12)
- Tag extraction algorithm (keyword extraction, TF-IDF, heuristics)
- Domain-to-tag mapping rules
- First-paragraph extraction heuristics
- Backfill job batching strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, BYOK model, key decisions
- `.planning/REQUIREMENTS.md` — CLSF-01 through CLSF-05 requirements
- `.planning/ROADMAP.md` — Phase 2 success criteria and dependency info

### Phase 1 Foundation
- `.planning/phases/01-foundation/01-CONTEXT.md` — Card UI decisions, tag pills, detail view patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/scraper/cheerio.ts`: Already extracts `bodyText` (5000 chars) and stores in `raw_content` — enrichment reads from here
- `src/workers/scrape.worker.ts`: Background worker pattern with pg-boss — enrichment can be a second job type in the same worker or a new queue
- `src/lib/db/schema.ts`: `tags` table with `source` field (user/rule/llm), `linkTags` join table, `rawContent` table — all ready for enrichment
- `src/components/links/LinkDetail.tsx`: Detail view component — tag editing and description editing UI goes here
- `src/components/links/LinkCard.tsx`: Already renders tag pills — will show auto-generated tags once they exist

### Established Patterns
- pg-boss queue for async background processing
- SWR polling for real-time UI updates when background jobs complete
- Drizzle ORM with node-postgres for all DB operations

### Integration Points
- Enrichment runs after scrape job completes (chain from existing `scrape` queue or new `enrich` queue)
- `links.description` field already exists — enrichment populates it when empty
- `links` table needs new `category` column
- Tag pills on cards already render — just need tags in the DB
- Detail view needs tag editor and click-to-edit description components

</code_context>

<specifics>
## Specific Ideas

- Tags should feel like GitHub issue labels — familiar pill UI with X to remove, input to add
- Description click-to-edit should be seamless — no modal, just inline transition to editable
- Domain hints should feel smart but not forced — e.g., GitHub repos get "open-source" naturally

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-enrichment*
*Context gathered: 2026-03-17*
