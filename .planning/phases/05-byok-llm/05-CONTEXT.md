# Phase 5: BYOK LLM - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can enter their own Anthropic (Claude) API key in settings. When a key is configured, newly saved links get LLM-powered tags, descriptions, and categories that are noticeably better than the rule-based baseline. The key is encrypted at rest and masked in the UI. No other LLM providers, no re-enrichment of existing links, no usage tracking or billing features in this phase.

</domain>

<decisions>
## Implementation Decisions

### API key entry & storage
- Anthropic (Claude) API only — single provider
- Key entered on the Settings page in a new "LLM Integration" section (Settings page already exists from Phase 3)
- AES-256 encryption at rest using a server-side secret, stored as encrypted blob in a new column on the user table
- Key validated on save — small test API call to Anthropic to verify the key works
- After saving: masked display showing first/last 4 chars (e.g., "sk-an...xY9z")
- "Remove" button to delete the key entirely
- Key cannot be retrieved in full after saving — only the masked version is returned to the client

### LLM call routing
- Server proxies all LLM calls — worker decrypts the user's key and calls Anthropic API during enrichment
- Key never sent to the browser after initial save
- Fits existing async pipeline: scrape → enrich (now checks for API key → LLM or rule-based)
- Only new links get LLM enrichment — existing links keep their rule-based tags when key is first added
- On LLM call failure (rate limit, invalid key, network error): silently fall back to rule-based enrichment

### Enhanced enrichment quality
- LLM generates 4-6 tags (vs 2-4 rule-based) — more specific and contextual
- Tags stored with `source: 'llm'` (existing source field supports this)
- LLM writes concise summary description, ~2-3 sentences (~150-200 chars) — genuine content summary, not just meta description extraction
- LLM also assigns category from the same fixed predefined list (~8-12 categories)
- No visual distinction between LLM and rule-based tags — all tags look the same in the UI
- `source` field in DB tracks origin internally for analytics/debugging

### Claude's Discretion
- Exact LLM prompt design (system prompt, output format, temperature)
- AES encryption implementation details (IV handling, key derivation)
- Which Claude model to use (Haiku for cost efficiency vs Sonnet for quality)
- Test API call method for key validation
- Error logging for failed LLM calls

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/enrichment/classify.ts`: `enrich()` function produces `EnrichmentResult` (tags, description, category) — LLM path returns the same shape
- `src/lib/enrichment/describe.ts`: Description extraction — LLM replaces this when key available
- `src/lib/enrichment/domain-hints.ts`: Domain-aware tag hints — can inform LLM prompt
- `src/workers/scrape.worker.ts`: Enrichment handler calls `enrich()` — branch here based on user API key
- `src/app/(dashboard)/dashboard/settings/page.tsx`: Settings page with Data Management section — add LLM Integration section
- `src/lib/db/schema.ts`: User table — needs encrypted API key column
- `src/types/index.ts`: `CATEGORIES` array already defined — pass to LLM prompt

### Established Patterns
- pg-boss async enrichment pipeline (scrape → enrich)
- Tags with `source` field ('user', 'rule', 'llm')
- Settings page with sections (Data Management pattern)
- Worker uses direct DB connection for all operations
- AES encryption not yet in codebase — new pattern for this phase

### Integration Points
- Worker's enrich handler: check if user has API key → branch to LLM or rule-based enrichment
- User table: new `encryptedApiKey` column (text, nullable)
- Settings page: new "LLM Integration" section below Data Management
- New API routes: POST/DELETE `/api/settings/api-key` for key management
- `EnrichmentResult` interface unchanged — LLM enrichment returns same shape

</code_context>

<specifics>
## Specific Ideas

- Key validation on save prevents frustration from entering a bad key and not knowing until links fail to enrich
- Silent fallback to rule-based means the user never sees broken enrichment — worst case they get the baseline quality
- Same `EnrichmentResult` shape means no UI changes needed beyond the Settings page key management

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-byok-llm*
*Context gathered: 2026-03-21*
