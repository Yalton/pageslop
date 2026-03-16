# Requirements: Pageslop

**Defined:** 2026-03-16
**Core Value:** Users save a link and it's instantly organized — no folders to choose, no tags to type, no management overhead.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can create account with email and password
- [x] **AUTH-02**: User can log in and stay logged in across sessions
- [x] **AUTH-03**: User can log out from any page

### Link Management

- [x] **LINK-01**: User can save a link by pasting a URL in the web app
- [x] **LINK-02**: System auto-fetches page title and OG image/favicon on save
- [x] **LINK-03**: System detects and handles duplicate URLs on save
- [x] **LINK-04**: User can delete a saved link
- [ ] **LINK-05**: User can import bookmarks from browser export (HTML file)
- [ ] **LINK-06**: User can export their links as JSON or HTML

### Classification

- [ ] **CLSF-01**: System auto-generates tags from page content using rule-based NLP (no LLM required)
- [ ] **CLSF-02**: System auto-generates a brief description from page content (rule-based baseline)
- [ ] **CLSF-03**: System classifies links into categories based on content analysis
- [ ] **CLSF-04**: User can manually edit tags on any link
- [ ] **CLSF-05**: User can manually edit description on any link

### BYOK LLM

- [ ] **BYOK-01**: User can add their own LLM API key in settings
- [ ] **BYOK-02**: When API key is configured, system uses LLM for higher-quality tags and descriptions
- [ ] **BYOK-03**: API key is encrypted at rest and never exposed in UI after saving

### Search & Navigation

- [ ] **SRCH-01**: User can search across titles, tags, descriptions, and URLs
- [ ] **SRCH-02**: User can view links in a grouped/clustered layout organized by classification
- [ ] **SRCH-03**: User can view links in a list/card layout
- [ ] **SRCH-04**: User can filter links by tag

### Graph

- [ ] **GRPH-01**: User can view a relational graph showing connections between links based on shared tags/classification
- [ ] **GRPH-02**: User can click a node in the graph to view link details
- [ ] **GRPH-03**: Graph performs smoothly with thousands of nodes (WebGL rendering)

### Monitoring

- [ ] **MNTR-01**: System pings saved links on a schedule to check availability
- [ ] **MNTR-02**: Each link displays a green/red uptime indicator

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Input Methods

- **INPT-01**: Browser extension for one-click save (Chrome + Firefox)
- **INPT-02**: Bookmarklet for saving from any browser
- **INPT-03**: REST API endpoint for automation/integrations

### Desktop

- **DSKP-01**: Desktop app with account-based sync

### Social Auth

- **SAUTH-01**: User can log in with Google/GitHub OAuth

### Monitoring v2

- **MNTR-03**: Uptime history per link
- **MNTR-04**: Alerts when a saved link goes down

## Out of Scope

| Feature | Reason |
|---------|--------|
| Manual folder hierarchy | Contradicts core value of zero-management auto-classification |
| Read-it-later / article reader | Separate product category, massive scope for zero benefit to core value |
| Social/sharing features | Adds moderation risk and complexity; single-user focus for v1 |
| Collaborative workspaces | Fundamentally different product; defer until multi-user demand emerges |
| Mobile native app | Responsive web covers mobile use cases; native app is v2+ |
| Real-time collaboration | No user need for personal bookmark manager |
| AI that learns from corrections | Requires per-user ML infrastructure; BYOK LLM is the pragmatic alternative |
| Offline-first / local storage | Conflicts with server-side uptime monitoring and classification |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| LINK-01 | Phase 1 | Complete |
| LINK-02 | Phase 1 | Complete |
| LINK-03 | Phase 1 | Complete |
| LINK-04 | Phase 1 | Complete |
| CLSF-01 | Phase 2 | Pending |
| CLSF-02 | Phase 2 | Pending |
| CLSF-03 | Phase 2 | Pending |
| CLSF-04 | Phase 2 | Pending |
| CLSF-05 | Phase 2 | Pending |
| SRCH-01 | Phase 3 | Pending |
| SRCH-02 | Phase 3 | Pending |
| SRCH-03 | Phase 3 | Pending |
| SRCH-04 | Phase 3 | Pending |
| LINK-05 | Phase 3 | Pending |
| LINK-06 | Phase 3 | Pending |
| MNTR-01 | Phase 4 | Pending |
| MNTR-02 | Phase 4 | Pending |
| BYOK-01 | Phase 5 | Pending |
| BYOK-02 | Phase 5 | Pending |
| BYOK-03 | Phase 5 | Pending |
| GRPH-01 | Phase 6 | Pending |
| GRPH-02 | Phase 6 | Pending |
| GRPH-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 26 total (file previously stated 24 — recount: AUTH 3 + LINK 6 + CLSF 5 + BYOK 3 + SRCH 4 + GRPH 3 + MNTR 2 = 26)
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after roadmap creation — traceability complete*
