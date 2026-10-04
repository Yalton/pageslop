# Tab Stash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Firefox extension saves idle tabs to pageslop and closes them. Saved tabs land in a "To Revisit" inbox, grouped by domain, and auto-archive after 14 days.

**Architecture:** Bearer-token API (`/api/stash`, `/api/stash/ping`) next to the existing session-auth routes. Three new columns on `links` (`source`, `stash_state`, `stashed_at`) drive the inbox, and a new `api_tokens` table holds the tokens. A pg-boss cron job archives expired items. The MV3 extension has no bundler. Its tab selection and sweep logic are pure ES modules, unit-tested with vitest.

**Tech Stack:** Next.js 15.5 App Router, React 19.1, Drizzle 0.45 (node-postgres), Better Auth 1.5, pg-boss 12, zod 4, swr, sonner, lucide-react, shadcn/ui, date-fns, vitest 4, web-ext.

**Spec:** `docs/superpowers/specs/2026-10-03-tab-stash-design.md`

## Global Constraints

- Nothing is ever hard-deleted by stash logic. Expiry sets `stash_state='archived'` only.
- `stash_state` values: `inbox | read | kept | archived`, or null for links that never entered the stash flow.
- `source` values: `manual | import | stash`. The default is `'manual'`.
- Tokens are `ps_` + base64url(32 random bytes). Only the SHA-256 hex hash is stored, and the raw token is shown once.
- `POST /api/stash` takes at most 100 tabs per request and accepts only `http:`/`https:` URLs.
- `saved` in the stash response echoes the client's URL strings byte-for-byte.
- The extension closes a tab only if its current URL is in `saved`. On any error it closes nothing.
- `STASH_EXPIRE_DAYS` defaults to 14. The expire job runs on cron `0 3 * * *` UTC.
- `ALLOW_SIGNUP` defaults to true. `ALLOW_SIGNUP=false` disables signup server-side and `NEXT_PUBLIC_ALLOW_SIGNUP=false` hides the signup links.
- Extension defaults: `idleHours 6`, `maxTabs 25`, `enabled false`, `excludeDomains []`.
- Tests run with `npx vitest run <path>`, and the full suite with `npm test`.
- Do not `git commit` unless the user asks. Commit steps are written as "only if the user asks".

## Review Focus

1. A URL with a trailing slash or a `#fragment` must come back in `saved` exactly as sent, or the extension will leave that tab open forever. Tests: Task 4.
2. The same URL appearing twice in one batch must not raise a unique-constraint violation, and it is saved once. Tests: Task 3 and Task 4.
3. A server that is down or returns 500 must close no tabs, set a red `!` badge and record the error. Tests: Task 14.
4. A tab that navigated to another URL between selection and close must stay open. Only tabs whose current URL is in `saved` close. Tests: Task 14.
5. An invalid `closedAt` falls back to the server's now. Garbage extension settings (negative, NaN or string numbers) are clamped to defaults. Tests: Task 4 and Task 14.

## Shared Interfaces (contract across tasks)

| Name | Location | Signature |
|---|---|---|
| `LinkSource`, `StashState`, `STASH_STATES` | `src/types/index.ts` | `'manual'\|'import'\|'stash'`; `['inbox','read','kept','archived'] as const` |
| `apiTokens` | `src/lib/db/schema.ts` | table `api_tokens` |
| `generateToken` / `hashToken` / `authenticateBearer` | `src/lib/auth/api-token.ts` | `(): {raw,hash}` / `(raw: string): string` / `(req: Request): Promise<{userId: string}\|null>` |
| token queries | `src/lib/db/queries/api-tokens.ts` | `createApiToken(userId,name,hash)`, `listApiTokens(userId)`, `deleteApiToken(userId,id): Promise<boolean>`, `findTokenByHash(hash)`, `touchApiToken(id)` |
| `insertLink` | `src/lib/db/queries/links.ts` | `(userId, url, opts?: {source?, stashState?, stashedAt?, title?})` |
| `stashTabs` | `src/lib/db/queries/links.ts` | `(userId, tabs: {url: string; title?: string; closedAt: Date}[]): Promise<{saved: string[]; inserted: {id: string; url: string}[]}>` |
| `bulkSetStashState` | `src/lib/db/queries/links.ts` | `(userId, ids: string[], state: StashState): Promise<number>` |
| `stashExpiryCutoff` / `stashExpireDays` | `src/lib/stash/expiry.ts` | `(now: Date, days: number): Date` / `(raw?: string): number` |
| `groupByDomain` | `src/lib/utils/group-links.ts` | `(links: LinkWithTags[]): Map<string, LinkWithTags[]>` |
| `useLinks().setStashState` | `src/lib/hooks/useLinks.ts` | `(ids: string[], stashState: StashState): Promise<void>` |
| `selectTabsToStash` | `extension/select-tabs.js` | `(tabs, settings, now: number): Tab[]` |
| `normalizeSettings` / `DEFAULTS` | `extension/settings.js` | `(raw: object): Settings` |
| `runSweep` | `extension/sweep.js` | `(deps): Promise<{stashed: number} \| {error: string}>` |

---
