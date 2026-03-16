# Pageslop

## What This Is

Pageslop is an intelligent bookmark manager that automatically classifies, tags, describes, and organizes saved links so users don't have to. Users feed it URLs through multiple channels (web app, browser extension, API/bookmarklet), and the system scrapes page content to generate descriptions, assign tags, and build a relational graph showing how links connect. It also monitors saved sites for uptime. Free to use on the web with optional BYOK (bring your own key) LLM integration for enhanced results.

## Core Value

Users save a link and it's instantly organized — no folders to choose, no tags to type, no management overhead. The system does the thinking.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Hybrid classification engine (rule-based baseline + optional LLM enhancement via user-provided API key)
- [ ] Automatic tag generation from page content
- [ ] Automatic brief description generation from page content
- [ ] Full-text search across links, tags, and descriptions
- [ ] Relational graph showing connections between links based on tags and classification
- [ ] Grouped/clustered view (default) and interactive force-directed graph view
- [ ] Multiple link input methods: paste in app, browser extension, API endpoint, bookmarklet
- [ ] Uptime monitoring — scheduled pings with simple green/red status indicator per link
- [ ] Web app with email/password authentication
- [ ] Account-based data — links belong to authenticated users
- [ ] Unbounded scale — handle any number of links gracefully

### Out of Scope

- Social/OAuth login — email/password sufficient for v1
- Desktop app with sync — future milestone after web is stable
- Uptime alerts or history — v1 is just a live status dot
- Collaborative/shared collections — single-user focus for v1
- Mobile app — web-first

## Context

- Free-hosted web app — no subscription model, users bring their own LLM API key for enhanced features
- Must function fully without an LLM key (rule-based classification, keyword extraction, basic descriptions)
- LLM integration is an enhancement layer, not a dependency
- Browser extension is a v1 input method, not a separate product
- Graph visualization needs to remain performant at scale (thousands of nodes)

## Constraints

- **Cost**: Free to host — architecture should minimize server-side costs (no server-side LLM calls on behalf of users)
- **Independence**: Core functionality must work without external AI services
- **Scale**: Must handle unbounded link collections without degradation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| BYOK for LLM | App is free, can't absorb API costs | — Pending |
| Hybrid classification | Must work without LLM, better with one | — Pending |
| Email/password auth for v1 | Simplest path, social login deferred | — Pending |
| Uptime as indicator only | Keep v1 scope manageable, no alert system | — Pending |

---
*Last updated: 2026-03-16 after initialization*
