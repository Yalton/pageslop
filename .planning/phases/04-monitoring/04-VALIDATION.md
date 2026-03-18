---
phase: 4
slug: monitoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/monitor/ tests/api/monitor* --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/monitor/ tests/api/monitor*`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | MNTR-01 | unit | `npx vitest run tests/monitor/check-url.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | MNTR-01 | unit | `npx vitest run tests/monitor/uptime-logic.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | MNTR-02 | unit | `npx vitest run tests/api/monitor.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | MNTR-01, MNTR-02 | manual | Visual verification | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/monitor/check-url.test.ts` — stubs for MNTR-01 (HEAD request, timeout, 405 fallback, status codes)
- [ ] `tests/monitor/uptime-logic.test.ts` — stubs for MNTR-01 (two-consecutive-failure rule, reset on success)
- [ ] `tests/api/monitor.test.ts` — stubs for MNTR-02 (POST /api/links/[id]/check auth + ownership)
- [ ] `tests/setup.ts` — add `schedule`, `insert`, `createQueue` to pg-boss mock

*Existing infrastructure: `vitest.config.ts` and `tests/setup.ts` already exist.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Green/red/gray dot visible on link cards | MNTR-02 | UI rendering | Check link cards show colored dot next to domain |
| Tooltip shows last-checked time on hover | MNTR-02 | Browser hover interaction | Hover over dot, verify tooltip text |
| "Check now" button triggers recheck | MNTR-02 | End-to-end with worker | Click button in detail view, verify dot updates |
| Scheduled checks run automatically | MNTR-01 | Requires worker running 24h+ | Verify worker logs show scheduled check execution |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
