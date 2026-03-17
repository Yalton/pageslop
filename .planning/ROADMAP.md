# Roadmap: Pageslop

## Overview

Pageslop is built in six phases that mirror how the product creates value: first you need a place to store links and users (Foundation), then the pipeline that makes them meaningful (Enrichment), then tools to find and browse them (Search & Browse), then infrastructure to keep tabs on them (Monitoring), then the power-user API key enhancement (BYOK LLM), and finally the signature differentiator that ties everything together (Graph). Each phase delivers something a user can use; no phase is "infrastructure only."

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Auth, link save, and async enrichment pipeline infrastructure
- [ ] **Phase 2: Enrichment** - Scraping, rule-based classification, auto-tags and descriptions
- [ ] **Phase 3: Search & Browse** - Full-text search, grouped views, import/export
- [ ] **Phase 4: Monitoring** - Scheduled uptime pings with green/red status per link
- [ ] **Phase 5: BYOK LLM** - User-provided API key for enhanced classification and descriptions
- [ ] **Phase 6: Graph** - Relational force-directed graph connecting links by shared tags

## Phase Details

### Phase 1: Foundation
**Goal**: Users can securely save links and the system responds immediately, with enrichment happening asynchronously in the background
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, LINK-01, LINK-02, LINK-03, LINK-04
**Success Criteria** (what must be TRUE):
  1. User can create an account with email and password and log in on a fresh browser session
  2. User can log out from any page and be redirected to the login screen
  3. User can paste a URL and see it saved immediately with a pending state indicator (no wait for scraping)
  4. System auto-fetches page title and OG image/favicon in the background and updates the link card
  5. Saving a duplicate URL notifies the user rather than creating a second entry
**Plans:** 5/6 plans executed

Plans:
- [ ] 01-01-PLAN.md — Project scaffold, DB schema, types, Vitest config
- [ ] 01-02-PLAN.md — Auth system (Better Auth, signup/login/onboarding pages)
- [ ] 01-03-PLAN.md — Link save API, Cheerio scraper, pg-boss worker
- [ ] 01-04-PLAN.md — Marketing landing page, dashboard layout shell, sidebar
- [ ] 01-05-PLAN.md — Dashboard link components (cards, grid, detail, save input, SWR polling)
- [ ] 01-06-PLAN.md — Human verification checkpoint (end-to-end flow)

### Phase 2: Enrichment
**Goal**: Every saved link has machine-generated tags, a description, and a category — with no LLM key required
**Depends on**: Phase 1
**Requirements**: CLSF-01, CLSF-02, CLSF-03, CLSF-04, CLSF-05
**Success Criteria** (what must be TRUE):
  1. After saving a link, tags appear automatically without any user action
  2. After saving a link, a brief description appears automatically without any user action
  3. Each link is assigned a category (e.g., "Technology", "News", "Reference") based on content
  4. User can click on any tag and edit or remove it
  5. User can click on a link description and edit the text inline
**Plans:** 1/3 plans executed

Plans:
- [ ] 02-01-PLAN.md — Schema migration, enrichment types, TDD enrichment module (tags, descriptions, categories)
- [ ] 02-02-PLAN.md — Worker enrich handler, tag query module, tag/description API routes
- [ ] 02-03-PLAN.md — Enrichment UI (TagEditor, InlineEdit, CategorySelect, card/detail integration)

### Phase 3: Search & Browse
**Goal**: Users can find any saved link quickly and browse their collection in organized views at any scale
**Depends on**: Phase 2
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04, LINK-05, LINK-06
**Success Criteria** (what must be TRUE):
  1. Searching a word from a link's title, tag, description, or URL returns that link in results
  2. User can switch to a grouped view that clusters links under their classification categories
  3. User can filter the link list to show only links with a specific tag
  4. User can upload a browser-exported HTML bookmarks file and see all bookmarks imported
  5. User can download their entire link collection as a JSON or HTML file
**Plans**: TBD

### Phase 4: Monitoring
**Goal**: Users can see at a glance which of their saved links are still live
**Depends on**: Phase 1
**Requirements**: MNTR-01, MNTR-02
**Success Criteria** (what must be TRUE):
  1. Each link card shows a green or red dot indicating whether the page was reachable on the last check
  2. Uptime status updates automatically on a schedule without any user action
**Plans**: TBD

### Phase 5: BYOK LLM
**Goal**: Users who supply their own LLM API key get noticeably better tags and descriptions, and their key is stored safely
**Depends on**: Phase 2
**Requirements**: BYOK-01, BYOK-02, BYOK-03
**Success Criteria** (what must be TRUE):
  1. User can enter an LLM API key in settings and the key is accepted and saved
  2. After adding a key, newly saved links receive richer, more specific tags and descriptions than the rule-based baseline
  3. The API key is masked in the UI after saving (only first/last few characters visible) and cannot be retrieved in full
**Plans**: TBD

### Phase 6: Graph
**Goal**: Users can explore how their bookmarks connect to each other through a visual, interactive graph
**Depends on**: Phase 2
**Requirements**: GRPH-01, GRPH-02, GRPH-03
**Success Criteria** (what must be TRUE):
  1. User can open a graph view where links are nodes and shared tags create visible edges between them
  2. Clicking a node in the graph opens the full details of that link
  3. The graph remains responsive and navigable with a collection of several thousand links
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6
Note: Phase 4 depends only on Phase 1 (not Phase 2 or 3) and can begin after Phase 1 is complete.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/6 | In Progress|  |
| 2. Enrichment | 1/3 | In Progress|  |
| 3. Search & Browse | 0/TBD | Not started | - |
| 4. Monitoring | 0/TBD | Not started | - |
| 5. BYOK LLM | 0/TBD | Not started | - |
| 6. Graph | 0/TBD | Not started | - |
