# Tab Stash: Auto-close Firefox tabs into Pageslop

Date: 2026-10-03
Status: Draft, awaiting review

## Goal

Stop hoarding open tabs. A Firefox extension closes idle tabs automatically, but only after Pageslop confirms it saved them. Saved tabs land in a "To Revisit" inbox, grouped by domain with topic categories as a secondary view. Unreviewed items archive after a set number of days, so the inbox can't become a second pile of 80 tabs.

The extension replaces the user's current tab-sleeper plugin.

### Success criteria

- No tab is ever closed unless the server has confirmed it saved that URL.
- The browser stays under the configured tab cap without manual effort.
- The revisit inbox is easy to scan, restore from, and clear out.

## Deployment model

- Pageslop is self-hostable and single-owner per instance. Others can run their own instances; they cannot use the owner's.
- The extension takes a configurable server URL. Nothing is hardcoded.
- New env var `ALLOW_SIGNUP` (default `true`). When `false`, Better Auth signup is disabled (`emailAndPassword.disableSignUp`) and the signup link is hidden. Self-hosters create their account first, then set it to `false`.

## Server (Pageslop)

### Schema changes

New columns on `links`:

| Column | Type | Notes |
|---|---|---|
| `source` | text, not null, default `'manual'` | `manual \| import \| stash` |
| `stash_state` | text, nullable | `inbox \| read \| kept \| archived`; null for links that were never stashed |
| `stashed_at` | timestamp, nullable | Set on each stash, including re-stash |

Index on `(user_id, stash_state)`.

New table `api_tokens`:

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | UUID |
| `user_id` | text FK to `user.id`, cascade delete | |
| `name` | text, not null | e.g. "Firefox laptop" |
| `token_hash` | text, not null, unique | SHA-256 hex of the raw token |
| `created_at` | timestamp, default now | |
| `last_used_at` | timestamp, nullable | Updated on each authenticated request |

Raw tokens are 32 random bytes, base64url-encoded with prefix `ps_`. The raw value is shown once at creation and never stored. Revoking a token deletes its row.

Existing rows get `source = 'manual'`. The import code path sets `source = 'import'` for new imports from now on.

### Token auth helper

`src/lib/auth/api-token.ts`:

- `generateToken(): { raw, hash }`
- `hashToken(raw): string`
- `authenticateBearer(req): Promise<{ userId } | null>` reads `Authorization: Bearer <token>`, looks up the hash, updates `last_used_at`, and returns the user ID or null.

### Endpoints

`POST /api/stash` (bearer token auth)

- Body: `{ tabs: [{ url: string, title?: string, favicon?: string, closedAt: string (ISO) }] }`
- At most 100 tabs per request, otherwise 400.
- Each URL must parse and use `http:` or `https:`. Invalid ones are listed in `rejected`, not saved.
- For each valid tab:
  - If no link exists for `(userId, url)`: insert it with `source='stash'`, `stash_state='inbox'`, `stashed_at=closedAt`, `title` from the tab, then enqueue the scrape job as `POST /api/links` does today.
  - If a link already exists: set `stash_state='inbox'` and `stashed_at=closedAt`. Leave other fields alone and do not re-scrape. If the link was `kept` or never stashed (`stash_state` null), it still moves to `inbox`, because re-stashing means the user wants to revisit it.
- Response 200: `{ saved: string[], rejected: { url, reason }[] }`. `saved` contains the exact URL strings the client sent.
- 401 when the token is missing, unknown, or revoked.

`GET /api/stash/ping` (bearer token auth): returns `{ ok: true, user: { email } }` or 401.

`GET /api/settings/tokens` (session auth): lists the user's tokens (`id, name, createdAt, lastUsedAt`), never hashes.

`POST /api/settings/tokens` (session auth): body `{ name }`, returns `{ id, name, token }` with the raw token. This is the only time the raw token is returned.

`DELETE /api/settings/tokens/[id]` (session auth): revokes a token owned by the caller.

`PATCH /api/links/[id]` (existing, session auth): additionally accepts `stashState` with the values `inbox | read | kept | archived`.

`POST /api/links/bulk-stash-state` (session auth): body `{ ids: string[], stashState }` for group actions (open all, keep all, dismiss all). Only touches links owned by the caller.

### Middleware

`src/middleware.ts` currently redirects any request without a session cookie to `/login`. Add `/api/stash` (prefix match, covering `/api/stash/ping`) to the pass-through list. Every route under `/api/stash` uses bearer auth and does its own checks; session-auth routes live elsewhere. API routes without auth should return 401 rather than a redirect, but changing that for other routes is out of scope.

CORS: the extension calls from a `moz-extension://` origin with host permissions, so Firefox skips CORS for granted hosts. No CORS headers are needed.

### Worker

New pg-boss schedule `stash-expire`, daily at `0 3 * * *` UTC:

```sql
UPDATE links SET stash_state = 'archived', updated_at = now()
WHERE stash_state IN ('inbox', 'read')
  AND stashed_at < now() - (STASH_EXPIRE_DAYS || ' days')::interval
```

`STASH_EXPIRE_DAYS` env var, default 14. Nothing is deleted. The cutoff calculation lives in a pure function (`stashExpiryCutoff(now, days)`) so it can be unit tested.

### Env additions

Add to `.env.example` and the README:

- `ALLOW_SIGNUP` (default `true`)
- `STASH_EXPIRE_DAYS` (default `14`)

## Firefox extension

### Layout

New top-level folder `extension/`, plain JavaScript ES modules, Manifest V3, no bundler.

```
extension/
  manifest.json
  background.js      # alarm handler, sweep orchestration, badge
  select-tabs.js     # pure: (tabs, settings, now) -> candidates
  api.js             # fetch wrappers for /api/stash and /api/stash/ping
  settings.js        # storage.local get/set with defaults
  popup.html / popup.js
  options.html / options.js
  icons/
```

Tooling: `web-ext` as a dev dependency, plus scripts `ext:run`, `ext:lint`, `ext:build` in the root `package.json`.

Permanent installation on release Firefox needs a signed build. The README documents submitting it to addons.mozilla.org as an **unlisted** add-on (free, signed automatically, not publicly listed) and loading it temporarily via `about:debugging` for development.

### Permissions

- `tabs`, `alarms`, `storage`
- `optional_host_permissions: ["*://*/*"]`. The options page calls `browser.permissions.request({ origins: [serverOrigin + '/*'] })` when the user saves the server URL.

### Settings (storage.local)

| Key | Default |
|---|---|
| `serverUrl` | `""` |
| `token` | `""` |
| `enabled` | `false` |
| `idleHours` | `6` |
| `maxTabs` | `25` |
| `excludeDomains` | `[]` |
| `pausedUntil` | `0` |
| `lastSweep` | `null` (`{ at, stashed, error? }`) |

### Selection logic (`select-tabs.js`)

`selectTabsToStash(tabs, settings, now) -> Tab[]`, pure with no browser APIs.

A tab is **protected**, and never selected, if any of these hold:

- `pinned`
- `active` (the active tab of any window)
- `audible`
- `incognito`
- URL scheme is not `http:` or `https:`
- URL origin equals the configured server origin
- Hostname matches an `excludeDomains` entry (the exact host, or any subdomain of it)

Selection:

1. **Idle pass:** unprotected tabs where `now - lastAccessed > idleHours * 3600000`.
2. **Cap pass:** count the remaining open tabs (all tabs, minus pinned ones, minus those selected in step 1). While that count is above `maxTabs`, add the unprotected, unselected tab with the oldest `lastAccessed`. Stop if no unprotected tabs remain.
3. Return the selected tabs ordered by `lastAccessed` ascending.

### Sweep (`background.js`)

Triggers: `browser.alarms` every 5 minutes, and "Stash idle now" in the popup.

1. Skip if `!enabled`, `now < pausedUntil`, or the server URL or token is unset.
2. `browser.tabs.query({})` across all windows, then `selectTabsToStash`.
3. POST to `/api/stash` in batches of 100.
4. Close only the selected tabs whose URL appears in `saved`. If several selected tabs share a saved URL, close all of them; unselected or protected tabs with the same URL (e.g. the active tab) are left alone.
5. Record `lastSweep`. Clear the badge on success. On a network error, non-200 response, or 401, set the badge to `!` (red), record the error, and close nothing. The next sweep retries naturally, so there is no local queue: an open tab is its own backup.

Only one sweep runs at a time (an in-memory lock flag).

### Popup

- Connection status: the result of a ping when the popup opens.
- The last sweep's result and time, or its error.
- Buttons:
  - **Stash idle now:** runs a sweep. It works even when auto-close is off, but still requires a configured server.
  - **Stash this tab:** sends the active tab and closes it on confirmation. Protections are bypassed, except the http/https requirement.
  - **Pause 1h:** toggles `pausedUntil`.
  - **Never close this domain:** adds the active tab's hostname to `excludeDomains`.

### Options page

- Server URL, token, and a **Test connection** button (ping), which shows a ✓ with the account email or an error.
- Idle hours, max tabs, excluded domains (one per line).
- Auto-close on/off toggle. It is disabled until a ping has succeeded.
- **Preview:** lists the tabs the next sweep would close, without closing anything.

## Revisit UI (Pageslop)

### Page `/dashboard/revisit`

- New sidebar entry "To Revisit" with a badge showing the count of items in `inbox`. The count comes from the existing links fetch, filtered client-side.
- Shows links with `stash_state` in `inbox` or `read`.
- A toggle switches between **Domain** (default) and **Topic** grouping.
  - Domain grouping: new `groupByDomain(links)` in `src/lib/utils/group-links.ts`. Groups are sorted by size descending, then by domain name. Links within a group are sorted by `stashedAt` descending. A null domain falls back to the hostname parsed from the URL.
  - Topic grouping: the existing `groupLinks`.
- Group header: favicon, domain (or category), count, and the buttons **Open all**, **Keep all**, **Dismiss all**. Dismiss all asks for confirmation when the group has more than 10 items.
- Row: title (falling back to the URL), category chip, up to 3 tags, "stashed Nd ago", and "expires in Nd" once 3 days or fewer remain. `read` rows are dimmed.
- Row actions:
  - Clicking the title opens the URL in a new tab and sets `read`.
  - **Keep** sets `kept`, and the row leaves the page.
  - **Dismiss** sets `archived`, and the row leaves the page.
- **Open all** opens each URL with `window.open` and marks them all `read` via `/api/links/bulk-stash-state`. Browsers may block pop-ups after the first one. If they do, the page shows a notice telling the user to allow pop-ups for the site.
- A search box filters within the page using `src/lib/utils/search.ts`.
- Empty state: "Nothing to revisit", with a link to the settings card.

### "All Links" page changes

- Hide links whose `stash_state` is `inbox` or `read`.
- `archived` links show an "archived" badge and a **Restore to inbox** action, which sets `inbox` and resets `stashed_at` to now.
- `kept` links show normally.

### Settings page

New "Browser extension" card:

- A create-token form (name field). The new token appears once with a copy button and the warning "you won't see this again".
- A token list with name, created date, last-used date, and **Revoke**.
- Short setup steps with a link to the extension section of the README.

## Testing

### Unit tests (vitest)

- `tests/extension/select-tabs.test.ts`:
  - each protection rule
  - the idle threshold boundary
  - cap ordering (oldest first)
  - cap already satisfied
  - every tab protected
  - idle and cap passes overlapping
  - pinned tabs excluded from the cap count
  - exclude domains matching subdomains
- `tests/search/group-by-domain.test.ts`: ordering, the null-domain fallback, and sorting within groups.
- `tests/stash/stash-expiry.test.ts`: `stashExpiryCutoff`.
- `tests/auth/api-token.test.ts`: hash determinism, the generated token format, and that hashes never match the raw token.

### API tests (vitest, following the existing `tests/api` patterns)

- `/api/stash`:
  - missing, bad, and revoked tokens return 401
  - a valid token saves the tabs and enqueues scraping
  - batches over 100 return 400
  - non-http URLs are rejected
  - re-stashing an existing URL resets it to `inbox` without a duplicate row
  - another user's token cannot affect this user's links
- `/api/stash/ping`: success and 401.
- Token CRUD: create returns the raw token once, list never returns hashes, and revoke only works for the token's owner.
- `PATCH /api/links/[id]` with `stashState`, and `/api/links/bulk-stash-state` ownership enforcement.
- Middleware: `/api/stash` without a cookie is not redirected.
- `ALLOW_SIGNUP=false` blocks signup.

Command: `npm test`.

### Manual verification

1. Run `npm run dev`, the worker, and `npm run ext:run`.
2. Create a token and connect the extension. Set idle to 0.02h (about 1 minute) and max tabs to 10.
3. Open about 30 tabs across 4 or 5 domains, including a pinned tab, an audible tab, and an `about:` page.
4. Confirm that the protected tabs survive, the rest close, and they appear on `/dashboard/revisit` grouped correctly.
5. Stop the server and open more tabs. Confirm nothing closes and the badge shows `!`. Restart the server and confirm the next sweep recovers.
6. Run Open all, Keep, and Dismiss. Set `STASH_EXPIRE_DAYS=0`, trigger `stash-expire`, and confirm the items are archived.

## Out of scope

- A Chrome build. The extension uses the WebExtension APIs, so a port is possible later.
- Grouping by the tab a link was opened from.
- Syncing extension settings across devices.
- Stashing from mobile.
- Changing auth behavior for existing API routes beyond the `/api/stash` bypass.
