# Pageslop REST API (v1)

A JSON API for reading and managing your links from scripts and other
services. Every request is scoped to the user who owns the token.

Base URL: your Pageslop server, e.g. `https://pageslop.example.com`. All
paths below are under `/api/v1`.

## Authentication

Create a token in **Settings → Browser Extension → API tokens** and tick the
permissions it needs. The raw token (`ps_` followed by 43 characters) is shown
once; Pageslop stores only its SHA-256 hash. Send it on every request:

```
Authorization: Bearer ps_...
```

### Scopes

| Scope         | Allows                                                     |
| ------------- | ---------------------------------------------------------- |
| `stash`       | `POST /api/stash`, `GET /api/stash/ping` (browser extension) |
| `links:read`  | List and read links and tags |
| `links:write` | Save links |
| `links:manage` | Edit, tag and delete links |

Tokens created before scopes existed have only `stash`, so they keep working
for the extension but cannot use `/api/v1`. Create a new token for API use.
Existing `links:write` tokens remain save-only; create a new token with
`links:manage` to allow edits and deletion.

Revoking a token in Settings takes effect immediately.

## Errors

Errors are JSON with a single `error` string:

```json
{ "error": "Forbidden: this token lacks the \"links:read\" scope" }
```

| Status | Meaning |
| ------ | ------- |
| 400 | Bad query parameter or request body |
| 401 | Missing, malformed, unknown or revoked token (`WWW-Authenticate: Bearer` is set) |
| 403 | Valid token without the scope this endpoint needs |
| 404 | No such link for this token's user |
| 500 | Server error |

## Link object

```json
{
  "id": "6f1c0e8e-1f7a-4a53-9a86-0c9b1b2f7e11",
  "url": "https://example.com/post",
  "title": "A post",
  "description": "Summary from the page or enrichment",
  "domain": "example.com",
  "category": "Technology",
  "status": "ready",
  "favicon": "/api/images/6f1c0e8e-1f7a-4a53-9a86-0c9b1b2f7e11/favicon",
  "ogImage": null,
  "source": "manual",
  "stashState": null,
  "stashedAt": null,
  "tags": ["rust", "databases"],
  "createdAt": "2026-10-16T12:00:00.000Z",
  "updatedAt": "2026-10-16T12:00:05.000Z"
}
```

- `status`: `pending` (just saved, not scraped yet), `ready` or `error`.
- `favicon`, `ogImage`: paths on your Pageslop server, or `null`. The worker
  downloads each page's icon and preview image once and serves its own copy
  (`/api/images/...`), or a screenshot (`/api/screenshots/...`) when the page
  has no preview image. Fetching them needs a signed-in browser session, not
  an API token.
- `source`: `manual`, `import` or `stash`.
- `stashState`: `null` for an ordinary saved link; for a stashed tab one of
  `inbox`, `read`, `kept` or `archived`. The list endpoint returns only `null`
  and `kept` links by default; use `view` to access every state.
- `stashedAt`: when the link was last stashed, or `null`. Links in `inbox` or
  `read` are the To Revisit queue.

## Endpoints

### `GET /api/v1/links`

Scope `links:read`. Lists links newest first, the same set the app's All
Links view shows (stashed tabs still in To Revisit are left out).

| Query    | Description |
| -------- | ----------- |
| `q`      | Case-insensitive substring match on title, URL or description |
| `tag`    | Only links with this tag (case-insensitive) |
| `domain` | Only links from this domain (`www.` is ignored) |
| `view`   | `saved` (default; All Links), `revisit` (`inbox` and `read`), `all`, or one of `inbox`, `read`, `kept`, `archived` |
| `limit`  | Page size, 1 to 200. Default 50 |
| `cursor` | `nextCursor` from the previous page, passed back unchanged |

Response:

```json
{ "links": [ /* link objects */ ], "nextCursor": "WyIyMDI2LTEwLTE2IDEyOjAwOjAwLjEyMzQ1NiIsIjZmMWMuLi4iXQ" }
```

`nextCursor` is `null` on the last page. Cursors are opaque and stable: links
saved after you start paging do not shift later pages.

```sh
curl -s -H "Authorization: Bearer $PAGESLOP_TOKEN" \
  "https://pageslop.example.com/api/v1/links?q=postgres&tag=databases&limit=20"

# next page
curl -s -H "Authorization: Bearer $PAGESLOP_TOKEN" \
  "https://pageslop.example.com/api/v1/links?q=postgres&tag=databases&limit=20&cursor=$NEXT"
```

Fetch everything (needs `jq`):

```sh
cursor=""
while :; do
  page=$(curl -s -H "Authorization: Bearer $PAGESLOP_TOKEN" \
    "https://pageslop.example.com/api/v1/links?limit=200${cursor:+&cursor=$cursor}")
  echo "$page" | jq -c '.links[]'
  cursor=$(echo "$page" | jq -r '.nextCursor // empty')
  [ -z "$cursor" ] && break
done
```

### `GET /api/v1/links/:id`

Scope `links:read`. Returns `{ "link": { ... } }`, or 404 if the id does not
exist or belongs to another user. Unlike the list, this returns any of your
links, including stashed tabs.

```sh
curl -s -H "Authorization: Bearer $PAGESLOP_TOKEN" \
  https://pageslop.example.com/api/v1/links/6f1c0e8e-1f7a-4a53-9a86-0c9b1b2f7e11
```

### `POST /api/v1/links`

Scope `links:write`. Saves one link and queues it for scraping and
enrichment (title, description, tags and category fill in shortly after).

Body:

| Field   | Required | Description |
| ------- | -------- | ----------- |
| `url`   | yes      | `http` or `https` URL, at most 2048 characters |
| `title` | no       | At most 500 characters. Used until scraping finds one |

URLs are stored in canonical form (lowercase scheme and host, no default
port, `https://a.com` = `https://a.com/`), and a URL is never saved twice:

- New link: `201` with `{ "link": { ... }, "duplicate": false }`
- Already saved: `200` with the existing link and `"duplicate": true`. Nothing
  is changed and no new scrape is queued.

```sh
curl -s -X POST \
  -H "Authorization: Bearer $PAGESLOP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/post", "title": "A post"}' \
  https://pageslop.example.com/api/v1/links
```

### `GET /api/v1/tags`

Scope `links:read`. Your tags, alphabetical, with how many links (in the
All Links view, matching `GET /api/v1/links?tag=`) carry each. Tags on no
such link are left out. Set `view=all` to include tags on every link, or
`view=revisit` to count only the To Revisit queue.

```json
{ "tags": [ { "name": "databases", "count": 12 }, { "name": "rust", "count": 3 } ] }
```

```sh
curl -s -H "Authorization: Bearer $PAGESLOP_TOKEN" \
  https://pageslop.example.com/api/v1/tags
```

### `PATCH /api/v1/links/:id`

Scope `links:manage`. Supply at least one of `description` (string, at most
10,000 characters), `category` (one of the app's categories), or `stashState`
(`inbox`, `read`, `kept`, `archived`, or `null`). A hand-picked category is
preserved through later enrichment. Moving a link to `inbox` restarts its
revisit expiry clock; moving it to `read` starts the clock if it has none.
Returns `{ "link": { ... } }`. Unknown or another user's id returns 404.

### `POST /api/v1/links/:id/tags`

Scope `links:manage`. Send `{ "name": "research" }` (1–50 characters). Adds
the lowercase tag to this link, creating it if needed. Repeating the call is
safe. Returns the updated `{ "link": { ... } }`.

### `DELETE /api/v1/links/:id/tags/:name`

Scope `links:manage`. Removes a tag from this link by name, case-insensitively.
URL-encode names containing spaces or special characters. Returns the updated
`{ "link": { ... } }`. A missing link or tag returns 404.

### `DELETE /api/v1/links/:id`

Scope `links:manage`. Permanently deletes the link and its tag associations.
Returns `{ "deleted": true }`; a missing link returns 404.

## MCP server for AI agents

The same tokens and scopes work with Pageslop's Model Context Protocol
endpoint at `/api/mcp`, so agents can search and manage links directly.
See [mcp.md](mcp.md).
