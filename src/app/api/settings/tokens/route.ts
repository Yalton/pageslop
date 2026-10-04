/**
 * Browser extension API tokens.
 *
 * GET  /api/settings/tokens — list the caller's tokens (never hashes)
 * POST /api/settings/tokens — create a token; the raw value is returned once
 *
 * Session auth. Revoking lives in ./[id]/route.ts.
 */

import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { generateToken } from '@/lib/auth/api-token'
import { createApiToken, listApiTokens } from '@/lib/db/queries/api-tokens'

const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(100),
})

export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const rows = await listApiTokens(session.user.id)
  // Pick fields explicitly so a hash can never leak, whatever the query selects
  const tokens = rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt ?? null,
  }))
  return Response.json({ tokens })
}

export async function POST(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = createTokenSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'name is required (1 to 100 characters)' }, { status: 400 })
  }

  const { raw: token, hash } = generateToken()
  const created = await createApiToken(session.user.id, parsed.data.name, hash)

  return Response.json({ id: created.id, name: created.name, token }, { status: 201 })
}
