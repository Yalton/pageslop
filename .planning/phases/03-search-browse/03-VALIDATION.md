---
phase: 3
slug: search-browse
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/search/ tests/import/ tests/api/export* --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/search/ tests/import/ tests/api/export*`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SRCH-01, SRCH-04 | unit | `npx vitest run tests/search/filter-links.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SRCH-02 | unit | `npx vitest run tests/search/group-links.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | LINK-05 | unit | `npx vitest run tests/import/parse-bookmarks.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | LINK-06 | unit | `npx vitest run tests/api/export.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | SRCH-03 | manual | Visual verification | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/search/filter-links.test.ts` — stubs for SRCH-01, SRCH-04 (pure filterLinks function)
- [ ] `tests/search/group-links.test.ts` — stubs for SRCH-02 (groupLinks transform)
- [ ] `tests/import/parse-bookmarks.test.ts` — stubs for LINK-05 (Netscape HTML parser)
- [ ] `tests/api/export.test.ts` — stubs for LINK-06 (export route Content-Disposition + format)

*Existing infrastructure: `vitest.config.ts` and `tests/setup.ts` already exist.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tag pill click navigates to ?tag= URL | SRCH-04 | Requires browser navigation | Click a tag pill on a card, verify URL changes to /dashboard?tag=tagname |
| Grouped view collapse/expand | SRCH-02 | UI interaction | Toggle to grouped view, click category headers to collapse/expand |
| Import drag-and-drop | LINK-05 | Browser file API | Drag an HTML bookmarks file onto the import zone |
| Import progress counter | LINK-05 | End-to-end queue processing | Upload 10+ bookmarks, verify counter increments |
| Existing list/grid view with filters | SRCH-03 | Already implemented, visual check | Toggle views while search/tag filter active |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
