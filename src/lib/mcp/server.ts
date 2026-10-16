/**
 * The Pageslop MCP server: tools that let an AI agent search, read and save
 * the token owner's links. /api/mcp builds one per request (stateless), bound
 * to the user and scopes of the bearer token that made the request.
 *
 * Each tool checks its scope when called, so any valid token can connect and
 * list tools, and a tool the token may not use says which scope is missing.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { TokenScope } from '@/lib/auth/token-scopes'
import { findDuplicate, getLinkWithTags, insertLink, listLinksPage } from '@/lib/db/queries/links'
import { listTagsWithCount } from '@/lib/db/queries/tags'
import { enqueueScrapeJob } from '@/lib/queue/boss'
import { decodeCursor } from '@/lib/links/cursor'
import { toApiLink } from '@/lib/links/api-link'

export interface McpAuth {
  userId: string
  scopes: TokenScope[]
}

// Smaller than /api/v1's default: results land in an agent's context window.
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const MAX_URL_LENGTH = 2048
const MAX_TITLE_LENGTH = 500

function ok(data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
  }
}

function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

/** The error result for a missing scope, or null when the token has it. */
function missingScope(auth: McpAuth, scope: TokenScope): CallToolResult | null {
  if (auth.scopes.includes(scope)) return null
  return fail(
    `Forbidden: this token lacks the "${scope}" scope. Create a Pageslop API token with "${scope}" in Settings and reconnect with it.`,
  )
}

function isHttpUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw.trim())
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** Trimmed text, or undefined when absent or blank. */
function text(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

export function createMcpServer(auth: McpAuth): McpServer {
  const server = new McpServer({ name: 'pageslop', version: '1.0.0' })

  server.registerTool(
    'search_links',
    {
      title: 'Search saved links',
      description:
        "Search the user's saved Pageslop links, newest first. Filters are optional and combine with AND. " +
        'Returns { links, nextCursor }; pass nextCursor back as cursor for the next page (null means no more).',
      inputSchema: {
        q: z.string().max(500).optional().describe('Case-insensitive text to match in title, URL or description'),
        tag: z.string().max(100).optional().describe('Only links with this tag'),
        domain: z.string().max(253).optional().describe('Only links on this domain, e.g. "github.com"'),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Page size, default ${DEFAULT_LIMIT}`),
        cursor: z.string().max(500).optional().describe('nextCursor from a previous search_links result'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ q, tag, domain, limit, cursor: rawCursor }) => {
      const denied = missingScope(auth, 'links:read')
      if (denied) return denied

      const cursorText = text(rawCursor)
      const cursor = cursorText === undefined ? null : decodeCursor(cursorText)
      if (cursorText !== undefined && !cursor) {
        return fail('cursor is invalid: pass nextCursor from a previous search_links result unchanged')
      }

      try {
        const page = await listLinksPage(auth.userId, {
          q: text(q),
          // Tags are stored lowercase; domains lowercase without a leading www.
          tag: text(tag)?.toLowerCase(),
          domain: text(domain)?.toLowerCase().replace(/^www\./, ''),
          limit: limit ?? DEFAULT_LIMIT,
          cursor,
        })
        return ok({ links: page.links.map(toApiLink), nextCursor: page.nextCursor })
      } catch (err) {
        console.error('[api/mcp] search_links failed', err)
        return fail('Failed to search links')
      }
    },
  )

  server.registerTool(
    'get_link',
    {
      title: 'Get a saved link',
      description: "Get one of the user's saved links by id, with its tags, category and description.",
      inputSchema: { id: z.string().min(1).max(100).describe('Link id from search_links') },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const denied = missingScope(auth, 'links:read')
      if (denied) return denied

      try {
        // Another user's link is not found, the same as a missing one.
        const link = await getLinkWithTags(auth.userId, id)
        if (!link) return fail(`Link not found: ${id}`)
        return ok({ link: toApiLink(link) })
      } catch (err) {
        console.error('[api/mcp] get_link failed', err)
        return fail('Failed to load link')
      }
    },
  )

  server.registerTool(
    'list_tags',
    {
      title: 'List tags',
      description: "List the user's tags with how many saved links carry each, sorted by name.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const denied = missingScope(auth, 'links:read')
      if (denied) return denied

      try {
        return ok({ tags: await listTagsWithCount(auth.userId) })
      } catch (err) {
        console.error('[api/mcp] list_tags failed', err)
        return fail('Failed to list tags')
      }
    },
  )

  server.registerTool(
    'save_link',
    {
      title: 'Save a link',
      description:
        "Save an http(s) URL to the user's Pageslop links. Pageslop fetches the page and fills in title, " +
        'description, category and tags in the background. If the URL is already saved, returns the existing ' +
        'link with duplicate: true.',
      inputSchema: {
        url: z.string().max(MAX_URL_LENGTH).describe('The http(s) URL to save'),
        title: z.string().max(MAX_TITLE_LENGTH).optional().describe('Optional title; otherwise taken from the page'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ url, title }) => {
      const denied = missingScope(auth, 'links:write')
      if (denied) return denied

      if (!isHttpUrl(url)) return fail('url must be an http(s) URL')
      const cleanTitle = text(title)

      try {
        // Same flow as POST /api/v1/links. findDuplicate and insertLink both
        // canonicalise the URL, so the same page is never saved twice.
        const existing = await findDuplicate(auth.userId, url)
        if (existing) {
          const withTags = await getLinkWithTags(auth.userId, existing.id)
          return ok({ link: toApiLink(withTags ?? existing), duplicate: true })
        }

        const link = await insertLink(auth.userId, url, cleanTitle ? { title: cleanTitle } : {})

        // The link is saved; a queue failure only delays enrichment.
        try {
          await enqueueScrapeJob(link.id, link.url)
        } catch (err) {
          console.error('[api/mcp] enqueueScrapeJob failed', link.id, err)
        }

        return ok({ link: toApiLink(link), duplicate: false })
      } catch (err) {
        console.error('[api/mcp] save_link failed', err)
        return fail('Failed to save link')
      }
    },
  )

  return server
}
