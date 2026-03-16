---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` — Wave 0 creates |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUTH-01 | unit | `npx vitest run tests/auth/signup.test.ts -t "creates user"` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-01 | unit | `npx vitest run tests/auth/signup.test.ts -t "rejects duplicate email"` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | AUTH-02 | unit | `npx vitest run tests/auth/login.test.ts -t "returns session"` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | AUTH-02 | unit | `npx vitest run tests/auth/session.test.ts -t "session expiry"` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | AUTH-03 | unit | `npx vitest run tests/auth/logout.test.ts -t "invalidates session"` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | LINK-01 | unit | `npx vitest run tests/api/links.test.ts -t "returns 202"` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | LINK-01 | unit | `npx vitest run tests/api/links.test.ts -t "batch save"` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | LINK-02 | unit | `npx vitest run tests/scraper/cheerio.test.ts -t "extracts OG data"` | ❌ W0 | ⬜ pending |
| 1-02-04 | 02 | 1 | LINK-02 | unit | `npx vitest run tests/api/links.test.ts -t "enqueues scrape job"` | ❌ W0 | ⬜ pending |
| 1-02-05 | 02 | 1 | LINK-03 | unit | `npx vitest run tests/api/links.test.ts -t "duplicate detection"` | ❌ W0 | ⬜ pending |
| 1-02-06 | 02 | 1 | LINK-03 | unit | `npx vitest run tests/api/links.test.ts -t "force save"` | ❌ W0 | ⬜ pending |
| 1-02-07 | 02 | 1 | LINK-04 | unit | `npx vitest run tests/api/links/[id].test.ts -t "deletes link"` | ❌ W0 | ⬜ pending |
| 1-02-08 | 02 | 1 | LINK-04 | unit | `npx vitest run tests/api/links/[id].test.ts -t "user scope"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — framework config
- [ ] `tests/setup.ts` — shared test setup (mock DB, mock pg-boss)
- [ ] `tests/auth/signup.test.ts` — stubs for AUTH-01
- [ ] `tests/auth/login.test.ts` — stubs for AUTH-02
- [ ] `tests/auth/logout.test.ts` — stubs for AUTH-03
- [ ] `tests/auth/session.test.ts` — stubs for AUTH-02 persistence
- [ ] `tests/api/links.test.ts` — stubs for LINK-01, LINK-03
- [ ] `tests/api/links/[id].test.ts` — stubs for LINK-04
- [ ] `tests/scraper/cheerio.test.ts` — stubs for LINK-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Marketing landing page renders correctly | — | Visual layout verification | Load `/`, verify hero section, CTAs, and responsive layout |
| Skeleton shimmer animation during enrichment | LINK-02 | Visual animation timing | Save a link, observe skeleton fills in progressively |
| Multi-line paste UX on mobile FAB | LINK-01 | Device-specific interaction | Open FAB on mobile viewport, paste multiple URLs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
