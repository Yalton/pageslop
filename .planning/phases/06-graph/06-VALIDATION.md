---
phase: 6
slug: graph
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/graph/ --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/graph/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | GRPH-01, GRPH-03 | unit | `npx vitest run tests/graph/graph-utils.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | GRPH-01, GRPH-02 | manual | Visual verification | n/a | ⬜ pending |
| 06-02-02 | 02 | 2 | GRPH-02 | manual | Click node, verify detail | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/graph/graph-utils.test.ts` — stubs for GRPH-01 (buildGraphData nodes/edges, deduplication, category filter) and GRPH-03 (5K node performance)
- [ ] Install `react-force-graph-2d` dependency

*Existing infrastructure: `vitest.config.ts` and `tests/setup.ts` already exist.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Force-directed graph renders with nodes and edges | GRPH-01 | WebGL/Canvas rendering | Navigate to /dashboard/graph, verify graph appears |
| Hover highlights connections, dims others | GRPH-01 | Canvas interaction | Hover a node, verify connected edges brighten |
| Click node opens LinkDetail | GRPH-02 | UI interaction | Click a node, verify detail panel opens with correct link |
| Drag nodes repositions them | GRPH-02 | Canvas interaction | Drag a node, verify it moves and simulation adjusts |
| Graph is responsive with many nodes | GRPH-03 | Performance perception | Load graph with 50+ links, verify smooth zoom/pan |
| Category filter hides/shows nodes | GRPH-01 | UI interaction | Toggle category filter, verify nodes appear/disappear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
