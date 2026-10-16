# Pageslop MCP server

Pageslop exposes your saved links to AI agents (Claude Code, Claude Desktop
and other [Model Context Protocol](https://modelcontextprotocol.io) clients)
through a Streamable HTTP endpoint:

```
https://<your-pageslop-host>/api/mcp
```

The server is stateless: every request is a single JSON-RPC `POST`, answered
with JSON. There are no sessions and no server-sent event stream, so `GET`
and `DELETE` return `405`.

## Authentication

The endpoint uses the same `ps_` API tokens as the [REST API](api.md). Create
one in **Settings → Browser Extension → API tokens** and give it:

- `links:read` to search, read and list tags
- `links:write` as well if the agent should save links

Send it on every request:

```
Authorization: Bearer ps_...
```

A missing, malformed, unknown or revoked token gets `401` with
`WWW-Authenticate: Bearer`. Any valid token can connect and list the tools.
Each tool checks its scope when called; without it the tool returns an error
result (`isError: true`) naming the missing scope, for example:

```
Forbidden: this token lacks the "links:write" scope. Create a Pageslop API token with "links:write" in Settings and reconnect with it.
```

Every tool only sees the token owner's links. Revoking the token in Settings
disconnects the agent immediately.

## Connecting

Settings has a **Connect an AI agent (MCP)** section with these snippets
filled in for your server.

Claude Code:

```sh
claude mcp add --transport http pageslop https://<your-pageslop-host>/api/mcp \
  --header "Authorization: Bearer ps_..."
```

Clients configured with JSON (e.g. a project `.mcp.json`):

```json
{
  "mcpServers": {
    "pageslop": {
      "type": "http",
      "url": "https://<your-pageslop-host>/api/mcp",
      "headers": { "Authorization": "Bearer ps_..." }
    }
  }
}
```

Claude Desktop only speaks stdio to local servers; bridge it with
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "pageslop": {
      "command": "npx",
      "args": ["mcp-remote", "https://<your-pageslop-host>/api/mcp", "--header", "Authorization: Bearer ps_..."]
    }
  }
}
```

## Tools

Results are JSON, both as text content and as `structuredContent`. Links use
the same [link object](api.md#link-object) as the REST API.

### `search_links` (links:read)

Lists links newest first, the same set as the app's All Links view and
`GET /api/v1/links`.

| Argument | Description |
| -------- | ----------- |
| `q`      | Case-insensitive substring match on title, URL or description |
| `tag`    | Only links with this tag (case-insensitive) |
| `domain` | Only links from this domain (`www.` is ignored) |
| `limit`  | Page size, 1 to 100. Default 20 |
| `cursor` | `nextCursor` from a previous result, passed back unchanged |

Returns `{ "links": [...], "nextCursor": "..." }`; `nextCursor` is `null` on
the last page.

### `get_link` (links:read)

Argument `id`. Returns `{ "link": { ... } }`, or an error if the link does not
exist or belongs to another user.

### `list_tags` (links:read)

No arguments. Returns `{ "tags": [ { "name": "rust", "count": 3 } ] }`,
alphabetical, counting links in the All Links view.

### `save_link` (links:write)

| Argument | Required | Description |
| -------- | -------- | ----------- |
| `url`    | yes      | `http` or `https` URL, at most 2048 characters |
| `title`  | no       | At most 500 characters. Used until scraping finds one |

Saves the link and queues it for scraping and enrichment, exactly like
`POST /api/v1/links`. Returns `{ "link": { ... }, "duplicate": false }`. If
the URL (in canonical form) is already saved, returns the existing link with
`"duplicate": true` and changes nothing.

## Testing by hand

```sh
curl -s -X POST https://<your-pageslop-host>/api/mcp \
  -H "Authorization: Bearer $PAGESLOP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_links","arguments":{"q":"postgres","limit":5}}}'
```
