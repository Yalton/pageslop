---
phase: 2
slug: enrichment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `npx vitest run tests/enrichment/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/enrichment/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | CLSF-01 | unit | `npx vitest run tests/enrichment/classify.test.ts -t "returns 2-4 tags"` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | CLSF-01 | unit | `npx vitest run tests/enrichment/classify.test.ts -t "domain hint"` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | CLSF-01 | unit | `npx vitest run tests/enrichment/classify.test.ts -t "lowercase"` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | CLSF-02 | unit | `npx vitest run tests/enrichment/classify.test.ts -t "meta description"` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 1 | CLSF-02 | unit | `npx vitest run tests/enrichment/classify.test.ts -t "first paragraph"` | ❌ W0 | ⬜ pending |
| 2-01-06 | 01 | 1 | CLSF-03 | unit | `npx vitest run tests/enrichment/classify.test.ts -t "categorize"` | ❌ W0 | ⬜ pending |
| 2-01-07 | 01 | 1 | CLSF-03 | unit | `npx vitest run tests/enrichment/classify.test.ts -t "Other"` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | CLSF-04 | integration | `npx vitest run tests/api/links/tags.test.ts -t "adds tag"` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | CLSF-04 | integration | `npx vitest run tests/api/links/tags.test.ts -t "removes tag"` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 1 | CLSF-05 | integration | `npx vitest run tests/api/links/[id].test.ts -t "updates description"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/enrichment/classify.test.ts` — stubs for CLSF-01, CLSF-02, CLSF-03 (pure function unit tests)
- [ ] `tests/api/links/tags.test.ts` — stubs for CLSF-04 (mock DB + auth)
- [ ] Extend `tests/api/links/[id].test.ts` — add PATCH case for CLSF-05

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tag pills render on card grid | CLSF-01 | Visual layout verification | Save a link, wait for enrichment, verify tag pills appear on card |
| Click-to-edit description interaction | CLSF-05 | UI interaction pattern | Click description text in detail view, verify textarea appears, edit, verify save on blur |
| Tag add/remove pill UX | CLSF-04 | UI interaction pattern | Open detail view, click X on tag, verify removed. Type new tag, verify added. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
