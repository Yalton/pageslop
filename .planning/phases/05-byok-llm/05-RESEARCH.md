# Phase 5: BYOK LLM - Research

**Researched:** 2026-03-21
**Domain:** Anthropic SDK, AES-256-GCM encryption, LLM-powered enrichment pipeline
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Anthropic (Claude) API only — single provider
- Key entered on the Settings page in a new "LLM Integration" section (Settings page already exists from Phase 3)
- AES-256 encryption at rest using a server-side secret, stored as encrypted blob in a new column on the user table
- Key validated on save — small test API call to Anthropic to verify the key works
- After saving: masked display showing first/last 4 chars (e.g., "sk-an...xY9z")
- "Remove" button to delete the key entirely
- Key cannot be retrieved in full after saving — only the masked version is returned to the client
- Server proxies all LLM calls — worker decrypts the user's key and calls Anthropic API during enrichment
- Key never sent to the browser after initial save
- Fits existing async pipeline: scrape → enrich (now checks for API key → LLM or rule-based)
- Only new links get LLM enrichment — existing links keep their rule-based tags when key is first added
- On LLM call failure (rate limit, invalid key, network error): silently fall back to rule-based enrichment
- LLM generates 4-6 tags (vs 2-4 rule-based) — more specific and contextual
- Tags stored with `source: 'llm'` (existing source field supports this)
- LLM writes concise summary description, ~2-3 sentences (~150-200 chars)
- LLM also assigns category from the same fixed predefined list (~8-12 categories)
- No visual distinction between LLM and rule-based tags — all tags look the same in the UI
- `source` field in DB tracks origin internally for analytics/debugging

### Claude's Discretion
- Exact LLM prompt design (system prompt, output format, temperature)
- AES encryption implementation details (IV handling, key derivation)
- Which Claude model to use (Haiku for cost efficiency vs Sonnet for quality)
- Test API call method for key validation
- Error logging for failed LLM calls

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BYOK-01 | User can add their own LLM API key in settings | Settings page pattern established; new "LLM Integration" section with POST/DELETE `/api/settings/api-key` routes; validation via test API call on save |
| BYOK-02 | When API key is configured, system uses LLM for higher-quality tags and descriptions | Worker enrich handler branches on `encryptedApiKey` presence; Anthropic SDK `messages.create()` with structured JSON output; same `EnrichmentResult` shape returned |
| BYOK-03 | API key is encrypted at rest and never exposed in UI after saving | AES-256-GCM with Node.js built-in crypto; encrypted blob in user table column; only masked string returned to client from API routes |
</phase_requirements>

---

## Summary

Phase 5 adds a single-provider (Anthropic) BYOK integration to the existing async enrichment pipeline. The architecture is already well-suited: the worker's `enrich` job handler currently calls `enrich()` (rule-based), and Phase 5 inserts an upstream branch — if the user has an `encryptedApiKey` in the DB, decrypt it, call Claude, fall back to rule-based on any error. The `EnrichmentResult` interface (`{ tags, description, category }`) is unchanged, so no UI changes beyond the Settings page are needed.

The two novel technical concerns are: (1) AES-256-GCM encryption of the API key at rest using Node.js `crypto` — no new dependencies needed, the built-in module handles everything; and (2) Anthropic SDK integration (`@anthropic-ai/sdk` v0.80+) with structured JSON output via `output_config` to guarantee well-formed tag/description/category responses. Both are well-understood patterns with extensive official documentation.

The key risk is the test-call validation on save: the API route must make a live Anthropic call before returning 200. This adds latency (~1-2s) to the save action. The minimal validation call — a single `messages.create` with `max_tokens: 10` — costs less than $0.00001 per validation and correctly surfaces invalid keys, revoked keys, and quota-exhausted keys.

**Primary recommendation:** Use `@anthropic-ai/sdk` directly (not the AI SDK abstraction layer), AES-256-GCM via Node.js built-in crypto, and `claude-haiku-4-5-20251001` as the enrichment model for cost efficiency.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.80.0 | Anthropic API client | Official first-party SDK; handles auth, retries, error types; no abstraction overhead |
| Node.js `crypto` (built-in) | Node 20 (project baseline) | AES-256-GCM encrypt/decrypt | Zero new dependencies; GCM mode provides authenticated encryption; IV + auth tag prevent tampering |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` (already installed, ^4.x) | existing | Validate API route request bodies | Use for POST `/api/settings/api-key` body validation |
| `drizzle-orm` (already installed) | existing | Schema migration for `encryptedApiKey` column | `db:push` for dev; `db:generate` + `db:migrate` for production |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@anthropic-ai/sdk` direct | `@ai-sdk/anthropic` (Vercel AI SDK) | AI SDK adds abstraction + extra packages; direct SDK is simpler for a single-provider use case and matches project pattern of minimal deps |
| Node.js crypto (AES-GCM) | `libsodium-wrappers`, `node-forge` | External crypto libs add dependency weight; Node.js built-in crypto covers AES-256-GCM natively since v0.10 |
| `claude-haiku-4-5-20251001` | `claude-sonnet-4-6` | Sonnet is 3x more expensive ($3/MTok vs $1/MTok input) with no material improvement for short structured enrichment tasks |

**Installation:**
```bash
npm install @anthropic-ai/sdk
```

---

## Architecture Patterns

### Recommended Project Structure

No new directories needed. New files slot into existing structure:

```
src/
├── lib/
│   ├── db/
│   │   └── schema.ts              # Add encryptedApiKey column to user table
│   ├── enrichment/
│   │   ├── classify.ts            # Existing rule-based (unchanged)
│   │   ├── llm-enrich.ts          # NEW: Anthropic SDK call, returns EnrichmentResult
│   │   └── crypto.ts              # NEW: encryptApiKey / decryptApiKey helpers
│   └── db/queries/
│       └── users.ts               # NEW: getEncryptedApiKey, setEncryptedApiKey, clearEncryptedApiKey
├── app/api/settings/
│   └── api-key/
│       └── route.ts               # NEW: POST (save+validate), DELETE (remove), GET (masked)
└── app/(dashboard)/dashboard/settings/
    └── page.tsx                   # Extend with "LLM Integration" section
tests/
├── enrichment/
│   └── llm-enrich.test.ts         # NEW: llmEnrich() unit tests with mocked SDK
└── api/
    └── settings-api-key.test.ts   # NEW: route handler tests
```

### Pattern 1: AES-256-GCM Encrypt/Decrypt

**What:** Symmetric authenticated encryption using Node.js built-in crypto. IV is generated fresh on each encrypt call and prepended to the ciphertext. Auth tag is appended. The stored format is `iv:authTag:ciphertext` (all hex-encoded).

**When to use:** Any time an API key is saved to the DB or read by the worker.

**Key requirements:**
- `ENCRYPTION_KEY` env var must be a 64-char hex string (32 bytes = 256 bits). Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- IV: 12 bytes (96 bits) — optimal for GCM per NIST SP 800-38D
- Auth tag: 16 bytes — full-length GCM auth tag

```typescript
// Source: Node.js crypto docs (https://nodejs.org/api/crypto.html)
// src/lib/enrichment/crypto.ts

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96 bits — NIST recommended for GCM
const TAG_LENGTH = 16  // 128-bit auth tag

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptApiKey(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptApiKey(stored: string): string {
  const key = getKey()
  const [ivHex, tagHex, encryptedHex] = stored.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
```

### Pattern 2: LLM Enrichment with Structured Output

**What:** Call Anthropic API with a JSON schema output constraint. Returns the same `EnrichmentResult` shape as `enrich()`. Fall back to rule-based on any error.

**When to use:** Worker's enrich handler, after confirming `encryptedApiKey` is present.

```typescript
// Source: Anthropic structured outputs docs
// https://platform.claude.com/docs/en/build-with-claude/structured-outputs
// src/lib/enrichment/llm-enrich.ts

import Anthropic from '@anthropic-ai/sdk'
import type { EnrichmentResult, EnrichInput } from './classify'
import { CATEGORIES } from '@/types/index'

const ENRICHMENT_SCHEMA = {
  type: 'object' as const,
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string' },
      minItems: 4,
      maxItems: 6,
      description: 'Specific, lowercase, single-word-or-hyphenated tags describing the page content',
    },
    description: {
      type: 'string',
      description: 'Concise 2-3 sentence summary of the page content (150-200 chars)',
    },
    category: {
      type: 'string',
      enum: CATEGORIES as unknown as string[],
      description: 'Best-matching category from the predefined list',
    },
  },
  required: ['tags', 'description', 'category'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `You are a precise content classifier for a bookmark manager.
Given a web page's title, domain, and body text excerpt, produce:
- 4-6 specific, lowercase tags (prefer specific terms over generic ones)
- a concise 2-3 sentence description summarizing what the page is about
- the single best-matching category

Categories available: ${CATEGORIES.join(', ')}`

export async function llmEnrich(
  opts: EnrichInput,
  apiKey: string
): Promise<EnrichmentResult | null> {
  const client = new Anthropic({ apiKey })

  const userContent = [
    opts.title && `Title: ${opts.title}`,
    opts.domain && `Domain: ${opts.domain}`,
    opts.bodyText && `Content excerpt: ${opts.bodyText.slice(0, 3000)}`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: ENRICHMENT_SCHEMA,
        },
      },
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null
    const parsed = JSON.parse(textBlock.text) as EnrichmentResult
    return parsed
  } catch {
    // Caller handles fallback — log in worker, return null
    return null
  }
}
```

### Pattern 3: API Key Validation on Save

**What:** Make a minimal Anthropic API call using the submitted key before encrypting and storing. A `messages.create` with `max_tokens: 10` confirms: key format, key validity, account has credits.

**When to use:** POST `/api/settings/api-key` route handler, before encrypting and writing to DB.

```typescript
// Source: Anthropic SDK docs (https://github.com/anthropics/anthropic-sdk-typescript)
// Validation call — minimal cost, confirms key works

async function validateApiKey(apiKey: string): Promise<boolean> {
  const client = new Anthropic({ apiKey })
  try {
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    })
    return true
  } catch (err) {
    // AuthenticationError = bad key; PermissionDeniedError = suspended
    // Both mean: reject the key
    return false
  }
}
```

### Pattern 4: Worker Enrich Handler Branch

**What:** In the existing enrich job handler in `scrape.worker.ts`, fetch the user's `encryptedApiKey` before choosing enrichment strategy.

**When to use:** The enrich handler — drop-in replacement for the current `enrich()` call site.

```typescript
// Existing enrich handler addition — src/workers/scrape.worker.ts
// (worker uses relative imports, not @/ alias)

import { llmEnrich } from '../lib/enrichment/llm-enrich'
import { decryptApiKey } from '../lib/enrichment/crypto'

// Inside the 'enrich' work handler, after fetching link + rawContent:

// Check if user has an API key configured
const [userRow] = await db
  .select({ encryptedApiKey: schema.user.encryptedApiKey })
  .from(schema.user)
  .where(eq(schema.user.id, link.userId))
  .limit(1)

let result: EnrichmentResult | null = null

if (userRow?.encryptedApiKey) {
  try {
    const apiKey = decryptApiKey(userRow.encryptedApiKey)
    result = await llmEnrich({ bodyText: raw.bodyText, existingDescription: link.description, domain: link.domain, title: link.title }, apiKey)
    if (result) {
      console.log(`[worker] LLM enriched link ${linkId}`)
    }
  } catch (err) {
    console.error(`[worker] LLM enrich failed for link ${linkId}, falling back:`, err)
  }
}

if (!result) {
  // Fall back to rule-based
  result = enrich({ bodyText: raw.bodyText, existingDescription: link.description, domain: link.domain, title: link.title })
}

// ... rest of handler unchanged (update link, upsert tags)
// For LLM tags: source: 'llm' instead of 'rule'
```

### Pattern 5: Key Masking

**What:** Only the masked form is ever returned to the client. The mask reveals first 4 + last 4 chars with `...` in between.

```typescript
// Shared utility — call from GET /api/settings/api-key response
export function maskApiKey(plaintext: string): string {
  if (plaintext.length <= 8) return '****'
  return `${plaintext.slice(0, 4)}...${plaintext.slice(-4)}`
}
```

### Anti-Patterns to Avoid

- **Storing the plaintext key in the DB:** Always encrypt before writing. Never log the plaintext key.
- **Returning the decrypted key from any API route:** GET `/api/settings/api-key` must only return the masked form — never the full key.
- **Using the Anthropic client on the client (browser) side:** The key is never sent to the browser; all Anthropic calls are server-proxied (worker or API route for validation).
- **Reusing the same IV:** Each `encryptApiKey()` call must generate a fresh `randomBytes(12)`. Reusing an IV with the same key catastrophically breaks GCM security.
- **AES-256-CBC instead of GCM:** CBC lacks authentication — an attacker can tamper with the ciphertext undetected. Use GCM exclusively.
- **Validating the key format with a regex instead of a live call:** Format-only checks don't catch revoked or quota-exhausted keys. Always make the live test call.
- **Worker using `@/` alias imports:** The worker runs as a standalone Node.js process via `tsx`. It uses relative imports, not `@/` path aliases. `llmEnrich` and `decryptApiKey` must be imported with relative paths.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client for Anthropic | Custom fetch wrapper | `@anthropic-ai/sdk` | SDK handles retry logic, streaming, typed errors (AuthenticationError, RateLimitError, etc.), content block parsing |
| JSON parsing of LLM output | Manual regex/extraction | Anthropic structured output (`output_config.format`) | LLM output is non-deterministic; structured outputs guarantee schema compliance on first attempt |
| Key format validation | Regex matching `sk-ant-...` | Live test call via SDK | Format is not publicly documented and changes; a live call is the only reliable validator |
| Crypto primitives | Custom XOR, base64 schemes | Node.js `crypto` AES-256-GCM | Custom crypto is universally wrong; GCM provides confidentiality + integrity in one pass |

**Key insight:** The Anthropic SDK's error taxonomy (`Anthropic.AuthenticationError`, `Anthropic.RateLimitError`, `Anthropic.APIConnectionError`) allows precise differentiation between "bad key" (reject on save), "rate limited" (fall back silently), and "network error" (fall back silently) in the worker.

---

## Common Pitfalls

### Pitfall 1: Worker Cannot Import `@/` Aliases
**What goes wrong:** The worker runs as `node --import tsx src/workers/scrape.worker.ts`. TypeScript path aliases (`@/lib/...`) are resolved by Next.js but not by `tsx` without extra config.
**Why it happens:** Established project decision: worker uses relative imports only.
**How to avoid:** All new worker imports (`llm-enrich`, `crypto`) use relative paths: `'../lib/enrichment/llm-enrich'`. Do NOT use `@/` alias in worker files.
**Warning signs:** `Cannot find module '@/...'` at worker startup.

### Pitfall 2: Structured Output `output_config` Only Available in Recent SDK
**What goes wrong:** `output_config` parameter doesn't exist in SDK versions before ~0.55.
**Why it happens:** Structured outputs were released in late 2025.
**How to avoid:** Install `@anthropic-ai/sdk ^0.80.0`. Fall back to prompting for JSON and `JSON.parse()` if structured output is unavailable for some reason — but prefer structured output.
**Warning signs:** TypeScript type error on `output_config` property.

### Pitfall 3: ENCRYPTION_KEY Not Set in Worker Environment
**What goes wrong:** Worker starts but `decryptApiKey` throws on first LLM-enabled enrich job.
**Why it happens:** Worker is started with `node --env-file=.env` — if `ENCRYPTION_KEY` is missing from `.env`, the decrypt helper throws.
**How to avoid:** Add `ENCRYPTION_KEY` to `.env` and any hosting platform env config (Render environment variables). The `getKey()` helper in `crypto.ts` throws a descriptive error immediately if the var is missing.
**Warning signs:** `Error: ENCRYPTION_KEY must be a 64-char hex string` in worker logs.

### Pitfall 4: LLM Tags Written with `source: 'rule'` Instead of `'llm'`
**What goes wrong:** LLM-enriched tags are silently mislabeled as rule-based in the DB.
**Why it happens:** The worker's existing tag upsert code hardcodes `source: 'rule'`.
**How to avoid:** Pass `source` as a variable into the tag insert: `source: result.source ?? 'rule'` where `llmEnrich` sets `source: 'llm'` in the tags. Alternatively, branch on whether LLM result was used.
**Warning signs:** `source = 'rule'` for all tags even after BYOK key is configured.

### Pitfall 5: Anthropic Validation Call Failing Due to Credits, Not Key Invalidity
**What goes wrong:** User enters a valid API key, but validation fails because their Anthropic account has no credits.
**Why it happens:** `Anthropic.PermissionDeniedError` or `Anthropic.AuthenticationError` both indicate "key rejected" — but the specific error message differs.
**How to avoid:** Return a specific error message for credit exhaustion (catch `err.status === 403` or check `err.message`) vs. key invalidity (`err.status === 401`). Show the user "Key is valid but your Anthropic account has no credits" vs. "Invalid API key".
**Warning signs:** User complains their key is rejected even though it works in Anthropic Console.

### Pitfall 6: Re-encrypting a Key That Is Already Encrypted
**What goes wrong:** If a user re-saves their key, the route must check if the submitted value looks like a masked display (`sk-an...xY9z`) and reject re-encryption.
**Why it happens:** UI sends back the masked display value on some form-submit patterns.
**How to avoid:** The POST route should require a full key (not the masked form). The UI's input field is always empty on load — masked display is read-only text, not a form input.
**Warning signs:** DB contains double-encrypted blobs that fail to decrypt.

---

## Code Examples

Verified patterns from official sources:

### Anthropic SDK: Basic messages.create (key validation)
```typescript
// Source: https://github.com/anthropics/anthropic-sdk-typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: 'sk-ant-...' })

const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 10,
  messages: [{ role: 'user', content: 'Hi' }],
})
// response.content[0].type === 'text'
```

### Anthropic SDK: Structured Output with JSON Schema
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 300,
  system: 'You are a content classifier.',
  messages: [{ role: 'user', content: 'Classify this page...' }],
  output_config: {
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
          category: { type: 'string', enum: ['Technology', 'News', ...] },
        },
        required: ['tags', 'description', 'category'],
        additionalProperties: false,
      },
    },
  },
})
const textBlock = response.content.find((b) => b.type === 'text')
const result = JSON.parse(textBlock.text)
```

### AES-256-GCM: Encrypt
```typescript
// Source: Node.js crypto docs (https://nodejs.org/api/crypto.html)
import { createCipheriv, randomBytes } from 'crypto'

const iv = randomBytes(12)
const cipher = createCipheriv('aes-256-gcm', key, iv)
const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
const tag = cipher.getAuthTag()
const stored = `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
```

### AES-256-GCM: Decrypt
```typescript
// Source: Node.js crypto docs (https://nodejs.org/api/crypto.html)
import { createDecipheriv } from 'crypto'

const [ivHex, tagHex, encHex] = stored.split(':')
const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
const plaintext = Buffer.concat([
  decipher.update(Buffer.from(encHex, 'hex')),
  decipher.final(),
]).toString('utf8')
```

### Next.js API Route: POST /api/settings/api-key (pattern)
```typescript
// Source: existing project pattern (src/app/api/links/route.ts)
import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { apiKey } = await req.json()
  // 1. Validate key (live Anthropic call)
  // 2. Encrypt key
  // 3. Store in DB
  // 4. Return masked key
  return Response.json({ maskedKey: 'sk-an...xY9z' })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prompt Claude to "return JSON" and hope | `output_config.format.type: 'json_schema'` (structured outputs) | Late 2025 (public beta) | Guaranteed schema compliance, no JSON.parse failures |
| `claude-3-haiku-20240307` | `claude-haiku-4-5-20251001` | Mid-2025 (Haiku 3 deprecated Apr 2026) | Better quality, same cost tier |
| AES-256-CBC (no auth) | AES-256-GCM (authenticated) | Node.js best practice ~2018 | GCM detects tampering; CBC does not |

**Deprecated/outdated:**
- `claude-3-haiku-20240307`: Deprecated, retiring April 19, 2026. Use `claude-haiku-4-5-20251001`.
- AES-CBC mode: Lacks authentication tag. Do not use for new implementations.
- Returning JSON with `JSON.stringify` in the LLM prompt and parsing manually: Replaced by structured output API.

---

## Open Questions

1. **`output_config` availability in the SDK**
   - What we know: Structured outputs were released Nov 2025; SDK 0.80.0 is latest
   - What's unclear: Whether `output_config` is in the TypeScript types for the current SDK; needs to be confirmed at install time
   - Recommendation: After installing, run `npx tsc --noEmit` to confirm type availability. If types are missing, fall back to JSON prompt + `JSON.parse()` with a try/catch.

2. **ENCRYPTION_KEY rotation strategy**
   - What we know: The decision says AES-256 with a server-side secret; no rotation is specified in scope
   - What's unclear: What happens if the key needs to be rotated (old encrypted blobs can't be decrypted)
   - Recommendation: Out of scope for Phase 5. Document in code comments that key rotation requires a migration. Keep the IV:tag:ciphertext format which makes future format versioning easier.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/enrichment/llm-enrich.test.ts tests/api/settings-api-key.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BYOK-01 | POST `/api/settings/api-key` validates key and stores encrypted blob | unit | `npx vitest run tests/api/settings-api-key.test.ts` | ❌ Wave 0 |
| BYOK-01 | DELETE `/api/settings/api-key` clears the key | unit | `npx vitest run tests/api/settings-api-key.test.ts` | ❌ Wave 0 |
| BYOK-01 | GET `/api/settings/api-key` returns only masked key | unit | `npx vitest run tests/api/settings-api-key.test.ts` | ❌ Wave 0 |
| BYOK-02 | `llmEnrich()` returns EnrichmentResult shape with 4-6 tags | unit | `npx vitest run tests/enrichment/llm-enrich.test.ts` | ❌ Wave 0 |
| BYOK-02 | Worker falls back to rule-based when `llmEnrich()` returns null | unit | `npx vitest run tests/enrichment/llm-enrich.test.ts` | ❌ Wave 0 |
| BYOK-03 | `encryptApiKey` / `decryptApiKey` round-trips correctly | unit | `npx vitest run tests/enrichment/llm-enrich.test.ts` | ❌ Wave 0 |
| BYOK-03 | GET route never returns full key — only masked form | unit | `npx vitest run tests/api/settings-api-key.test.ts` | ❌ Wave 0 |
| BYOK-03 | `decryptApiKey` throws on tampered ciphertext (GCM auth tag failure) | unit | `npx vitest run tests/enrichment/llm-enrich.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/enrichment/llm-enrich.test.ts tests/api/settings-api-key.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/enrichment/llm-enrich.test.ts` — covers BYOK-02 (`llmEnrich()` output shape, fallback) and BYOK-03 (encrypt/decrypt round-trip, auth tag verification)
- [ ] `tests/api/settings-api-key.test.ts` — covers BYOK-01 (POST/DELETE/GET route handlers) and BYOK-03 (masked key return)
- [ ] `src/lib/enrichment/crypto.ts` — new file; needs `ENCRYPTION_KEY` in test env (`tests/setup.ts` must set `process.env.ENCRYPTION_KEY`)
- [ ] `src/lib/enrichment/llm-enrich.ts` — new file; Anthropic SDK must be mocked in tests (similar to pg-boss mock pattern in `tests/setup.ts`)
- [ ] Anthropic SDK mock: add `vi.mock('@anthropic-ai/sdk', ...)` to `tests/setup.ts` or per-test file

---

## Sources

### Primary (HIGH confidence)
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — model IDs, pricing, context windows verified March 2026
- [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — `output_config.format` API, JSON schema usage
- [Node.js Crypto API](https://nodejs.org/api/crypto.html) — `createCipheriv`, `createDecipheriv`, `randomBytes`, AES-256-GCM

### Secondary (MEDIUM confidence)
- [anthropic-sdk-typescript GitHub](https://github.com/anthropics/anthropic-sdk-typescript) — SDK v0.80.0, import pattern, error types
- WebSearch: `@anthropic-ai/sdk` npm latest version 0.80.0 (March 2026) — confirmed against multiple sources

### Tertiary (LOW confidence)
- WebSearch findings on key validation patterns — cross-verified with SDK error taxonomy from official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SDK and Node.js crypto both verified against official docs
- Architecture: HIGH — follows established project patterns (API routes, worker handlers, Drizzle schema)
- Pitfalls: HIGH — derived from direct code inspection of existing worker + established project decisions
- Model choice: HIGH — pricing verified against Anthropic models page March 2026
- Structured output API: MEDIUM — `output_config` verified in official docs; SDK types need confirming at install time

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (Anthropic model/pricing pages change; SDK minor versions release frequently; verify structured output type availability after install)
