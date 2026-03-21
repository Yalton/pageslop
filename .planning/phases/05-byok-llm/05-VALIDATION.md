---
phase: 5
slug: byok-llm
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/enrichment/llm-enrich.test.ts tests/api/settings-api-key.test.ts --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/enrichment/llm-enrich.test.ts tests/api/settings-api-key.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | BYOK-03 | unit | `npx vitest run tests/enrichment/llm-enrich.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | BYOK-01 | unit | `npx vitest run tests/api/settings-api-key.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | BYOK-02 | unit | `npx vitest run tests/enrichment/llm-enrich.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | BYOK-01, BYOK-02, BYOK-03 | manual | Visual verification | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/enrichment/llm-enrich.test.ts` — stubs for BYOK-02 (llmEnrich output shape, fallback), BYOK-03 (encrypt/decrypt round-trip, auth tag)
- [ ] `tests/api/settings-api-key.test.ts` — stubs for BYOK-01 (POST/DELETE/GET routes), BYOK-03 (masked key return)
- [ ] `tests/setup.ts` — add `ENCRYPTION_KEY` env var and Anthropic SDK mock
- [ ] Install `@anthropic-ai/sdk` dependency

*Existing infrastructure: `vitest.config.ts` and `tests/setup.ts` already exist.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| API key input form on Settings page | BYOK-01 | UI rendering | Navigate to /dashboard/settings, verify LLM Integration section |
| Key masked display after saving | BYOK-03 | UI rendering | Save a key, verify masked display shows first/last 4 chars |
| "Remove" button deletes key | BYOK-01 | UI interaction | Click Remove, verify key is cleared |
| LLM-enriched links have better tags | BYOK-02 | Quality comparison | Save a link with key configured, compare tags to rule-based |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
