/**
 * POST /api/mcp — Model Context Protocol endpoint (Streamable HTTP, stateless).
 *
 * Bearer token auth (any valid ps_ token connects; each tool checks its own
 * scope). A fresh server and transport handle every request, so there is no
 * session store, and responses are plain JSON rather than an SSE stream.
 * See docs/mcp.md.
 */

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticateBearer } from '@/lib/auth/api-token'
import { jsonError } from '@/lib/api/bearer'
import { createMcpServer } from '@/lib/mcp/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const authed = await authenticateBearer(req)
  if (!authed) {
    return jsonError(401, 'Unauthorized: send a valid API token as "Authorization: Bearer ps_..."', {
      'WWW-Authenticate': 'Bearer realm="pageslop"',
    })
  }

  const server = createMcpServer(authed)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  try {
    await server.connect(transport)
    return await transport.handleRequest(req)
  } catch (err) {
    console.error('[api/mcp] request failed', err)
    return Response.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null },
      { status: 500 },
    )
  } finally {
    // With enableJsonResponse the body is complete once handleRequest resolves.
    await server.close().catch(() => undefined)
  }
}

/** Stateless: no server-initiated SSE stream and no sessions to delete. */
function methodNotAllowed(): Response {
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: use POST' }, id: null },
    { status: 405, headers: { Allow: 'POST' } },
  )
}

export async function GET(): Promise<Response> {
  return methodNotAllowed()
}

export async function DELETE(): Promise<Response> {
  return methodNotAllowed()
}
