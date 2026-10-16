/**
 * What an API token may do. Kept free of server-only imports so the
 * Settings UI can use the same list.
 *
 * - stash:       POST /api/stash and GET /api/stash/ping (browser extension)
 * - links:read:  GET /api/v1/links, /api/v1/links/:id, /api/v1/tags (and MCP search_links, get_link, list_tags)
 * - links:write: POST /api/v1/links (and MCP save_link)
 *
 * Tokens created before scopes existed have ['stash'] (the column default).
 */
export const TOKEN_SCOPES = ['stash', 'links:read', 'links:write'] as const

export type TokenScope = (typeof TOKEN_SCOPES)[number]

export const DEFAULT_TOKEN_SCOPES: TokenScope[] = ['stash']

export const TOKEN_SCOPE_LABELS: Record<TokenScope, string> = {
  stash: 'Browser extension (stash tabs)',
  'links:read': 'Read links and tags (API)',
  'links:write': 'Save links (API)',
}

export function isTokenScope(value: unknown): value is TokenScope {
  return typeof value === 'string' && (TOKEN_SCOPES as readonly string[]).includes(value)
}

/** Known scopes only, deduplicated, in TOKEN_SCOPES order. */
export function normalizeScopes(values: readonly unknown[]): TokenScope[] {
  return TOKEN_SCOPES.filter((scope) => values.includes(scope))
}
