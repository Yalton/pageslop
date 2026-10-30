/**
 * API key management routes.
 *
 * POST   /api/settings/api-key — Validate key via live Anthropic call, encrypt, store
 * GET    /api/settings/api-key — Return { hasKey, maskedKey } — NEVER the full key
 * DELETE /api/settings/api-key — Clear the stored encrypted key
 *
 * All routes require an authenticated session (401 if missing).
 * The full plaintext key is NEVER returned after the initial save.
 */

import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { encryptApiKey, decryptApiKey, maskApiKey } from '@/lib/enrichment/crypto'
import { validateApiKey } from '@/lib/enrichment/llm-enrich'
import { getEncryptedApiKey, setEncryptedApiKey, clearEncryptedApiKey } from '@/lib/db/queries/users'

export async function POST(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  let body: { apiKey?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { apiKey } = body
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return Response.json({ error: 'apiKey is required' }, { status: 400 })
  }

  // Validate the key via a live Anthropic call
  const isValid = await validateApiKey(apiKey.trim())
  if (!isValid) {
    return Response.json(
      { error: 'Invalid API key. Please check your Anthropic API key and try again.' },
      { status: 400 }
    )
  }

  // Encrypt and store
  const encrypted = encryptApiKey(apiKey.trim(), session.user.id)
  await setEncryptedApiKey(session.user.id, encrypted)

  // Return masked form only
  const maskedKey = maskApiKey(apiKey.trim())
  return Response.json({ maskedKey, message: 'API key saved' })
}

export async function GET(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const encrypted = await getEncryptedApiKey(session.user.id)

  if (!encrypted) {
    return Response.json({ hasKey: false })
  }

  // Decrypt only to produce the masked form — full key never leaves the server
  const plaintext = decryptApiKey(encrypted, session.user.id)
  const maskedKey = maskApiKey(plaintext)
  return Response.json({ hasKey: true, maskedKey })
}

export async function DELETE(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  await clearEncryptedApiKey(session.user.id)
  return Response.json({ message: 'API key removed' })
}
