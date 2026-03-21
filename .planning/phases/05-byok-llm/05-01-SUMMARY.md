---
phase: 05-byok-llm
plan: 01
subsystem: byok-backend
tags: [crypto, anthropic-sdk, api-key, tdd, schema]
dependency_graph:
  requires: []
  provides:
    - src/lib/enrichment/crypto.ts
    - src/lib/enrichment/llm-enrich.ts
    - src/lib/db/queries/users.ts
    - src/app/api/settings/api-key/route.ts
    - encryptedApiKey column on user table
  affects:
    - src/workers/scrape.worker.ts (Plan 02 wires llmEnrich in)
    - src/app/(dashboard)/dashboard/settings/page.tsx (Plan 02 adds UI)
tech_stack:
  added:
    - "@anthropic-ai/sdk@0.80.0"
  patterns:
    - AES-256-GCM authenticated encryption (Node.js built-in crypto)
    - JSON-parsing LLM response (prompt-based, not output_config)
    - TDD red-green cycle for all new modules
key_files:
  created:
    - src/lib/enrichment/crypto.ts
    - src/lib/enrichment/llm-enrich.ts
    - src/lib/db/queries/users.ts
    - src/app/api/settings/api-key/route.ts
    - tests/enrichment/crypto.test.ts
    - tests/enrichment/llm-enrich.test.ts
    - tests/api/settings-api-key.test.ts
  modified:
    - src/lib/db/schema.ts (encryptedApiKey column on user table)
    - tests/setup.ts (ENCRYPTION_KEY env var, Anthropic SDK mock)
    - package.json / package-lock.json (@anthropic-ai/sdk)
decisions:
  - "Anthropic SDK mock uses ES class (not vi.fn().mockImplementation) to support new MockAnthropic() calls"
  - "Error classes exported from tests/setup.ts (MockAuthenticationError, MockRateLimitError) instead of from SDK mock — avoids static property access issues"
  - "llmEnrich uses JSON prompt + JSON.parse fallback strategy — output_config type check confirmed unnecessary since catch-all error handling covers malformed JSON"
  - "validateApiKey returns false on any error including credit exhaustion — differentiating 401 vs 403 deferred to Plan 02 UX layer"
metrics:
  duration: 5min
  completed_date: "2026-03-21"
  tasks: 2
  files_changed: 10
---

# Phase 5 Plan 1: BYOK Backend Summary

**One-liner:** AES-256-GCM API key encryption, Anthropic SDK LLM enrichment module, and POST/GET/DELETE API key management routes with full TDD coverage.

## What Was Built

### Task 1: Schema, crypto module, LLM enrichment module, user queries

**commit:** `449251b`

Added the `encryptedApiKey` column (nullable text) to the `user` table and pushed the schema. Created three new source files:

- **`src/lib/enrichment/crypto.ts`** — AES-256-GCM encrypt/decrypt with random 12-byte IV per call. Stored format: `iv:authTag:ciphertext` (all hex). `maskApiKey` returns first-4 + `...` + last-4 chars or `****` for short keys.
- **`src/lib/enrichment/llm-enrich.ts`** — `llmEnrich(opts, apiKey)` creates an Anthropic client, calls `messages.create` with a structured JSON prompt, parses the response, returns `EnrichmentResult | null` on any error. `validateApiKey(apiKey)` makes a minimal `max_tokens: 10` call and returns `true/false`.
- **`src/lib/db/queries/users.ts`** — Three Drizzle ORM helpers: `getEncryptedApiKey`, `setEncryptedApiKey`, `clearEncryptedApiKey`.

Updated `tests/setup.ts` with:
- `process.env.ENCRYPTION_KEY = '0'.repeat(64)` for test env
- Anthropic SDK mock using ES class (supports `new Anthropic()` calls)
- `MockAuthenticationError`, `MockRateLimitError` classes exported for per-test use

**8 crypto tests pass, 7 llm-enrich tests pass.**

### Task 2: API key management routes (POST/GET/DELETE)

**commit:** `7f9f17f`

Created `src/app/api/settings/api-key/route.ts` with three handlers:

- **POST** — Validates key via `validateApiKey()`, encrypts via `encryptApiKey()`, stores via `setEncryptedApiKey()`, returns `{ maskedKey, message: 'API key saved' }`. Returns 401 (no session), 400 (missing key), 400 (invalid key).
- **GET** — Returns `{ hasKey: false }` if no key, or `{ hasKey: true, maskedKey }` after decrypt-then-mask. Full plaintext never leaves the server.
- **DELETE** — Calls `clearEncryptedApiKey()`, returns `{ message: 'API key removed' }`.

**9 route tests pass. Full suite: 144 tests, 0 failures.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Anthropic SDK mock factory used arrow function instead of class**
- **Found during:** Task 1 GREEN phase
- **Issue:** `vi.fn().mockImplementation(() => ({ messages: {...} }))` is not a constructor — `new Anthropic()` throws "is not a constructor"
- **Fix:** Replaced with ES `class MockAnthropic` with constructor support and static error class properties
- **Files modified:** tests/setup.ts
- **Commit:** 449251b (inline fix before task commit)

**2. [Rule 2 - Missing validation] Error classes needed in test scope**
- **Found during:** Task 1 RED phase (test design)
- **Issue:** Tests reference `Anthropic.AuthenticationError` but the mock's named exports weren't accessible as static properties on the default import
- **Fix:** Exported `MockAuthenticationError` and `MockRateLimitError` directly from `tests/setup.ts` for per-test import; tests import from setup rather than from the mocked SDK
- **Files modified:** tests/setup.ts, tests/enrichment/llm-enrich.test.ts
- **Commit:** 449251b (inline fix before task commit)

**3. [Rule 1 - Bug] Test imported `setEncryptedApiKey` from wrong module**
- **Found during:** Task 2 RED phase
- **Issue:** Test had `import { ..., setEncryptedApiKey } from '@/lib/enrichment/crypto'` — that export doesn't exist in crypto.ts
- **Fix:** Corrected to import from `@/lib/db/queries/users`
- **Files modified:** tests/api/settings-api-key.test.ts
- **Commit:** 7f9f17f (inline fix before task commit)

## Self-Check

### Files exist
- `src/lib/enrichment/crypto.ts` — FOUND
- `src/lib/enrichment/llm-enrich.ts` — FOUND
- `src/lib/db/queries/users.ts` — FOUND
- `src/app/api/settings/api-key/route.ts` — FOUND
- `tests/enrichment/crypto.test.ts` — FOUND
- `tests/enrichment/llm-enrich.test.ts` — FOUND
- `tests/api/settings-api-key.test.ts` — FOUND

### Commits exist
- 449251b — Task 1 commit — FOUND
- 7f9f17f — Task 2 commit — FOUND

### Test results
- 144 tests pass, 0 failures, 0 skipped

## Self-Check: PASSED
