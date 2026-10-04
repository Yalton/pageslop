import { createHash, randomBytes } from 'node:crypto'
import { findTokenByHash, touchApiToken } from '@/lib/db/queries/api-tokens'

export const TOKEN_PREFIX = 'ps_'

// "Bearer ps_<43 base64url chars>". The scheme is case-insensitive (RFC 7235).
// 32 random bytes encode to exactly 43 unpadded base64url characters.
const BEARER_RE = /^bearer\s+(ps_[A-Za-z0-9_-]{43})\s*$/i

// The extension calls the API every few minutes; record use at most this often.
const TOUCH_INTERVAL_MS = 5 * 60_000

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export function generateToken(): { raw: string; hash: string } {
  const raw = TOKEN_PREFIX + randomBytes(32).toString('base64url')
  return { raw, hash: hashToken(raw) }
}

/**
 * Authenticate a request by its `Authorization: Bearer ps_...` header.
 * Returns the owning user's id, or null for a missing, malformed, unknown or revoked token.
 */
export async function authenticateBearer(req: Request): Promise<{ userId: string } | null> {
  const header = req.headers.get('authorization')
  if (!header) return null

  const match = BEARER_RE.exec(header)
  if (!match) return null

  const row = await findTokenByHash(hashToken(match[1]))
  if (!row) return null

  // lastUsedAt is informational. A failed update must not reject a valid token.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() >= TOUCH_INTERVAL_MS) {
    await touchApiToken(row.id).catch(() => undefined)
  }

  return { userId: row.userId }
}
