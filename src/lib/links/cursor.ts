/**
 * Opaque keyset cursor for paging links newest first.
 *
 * createdAt is Postgres's own text form of links.created_at (microsecond
 * precision). A JS Date would truncate to milliseconds and skip rows whose
 * created_at falls inside the truncated microseconds.
 */
export interface LinkCursor {
  createdAt: string
  id: string
}

// "YYYY-MM-DD HH:MM:SS" with optional fractional seconds. Anything else is
// rejected before it reaches SQL (where it is still passed as a parameter).
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/

export function encodeCursor(cursor: LinkCursor): string {
  return Buffer.from(JSON.stringify([cursor.createdAt, cursor.id]), 'utf8').toString('base64url')
}

/** Returns null for anything encodeCursor could not have produced. */
export function decodeCursor(raw: string): LinkCursor | null {
  if (!raw || !/^[A-Za-z0-9_-]+$/.test(raw)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) return null
  const [createdAt, id] = parsed
  if (typeof createdAt !== 'string' || !TIMESTAMP_RE.test(createdAt)) return null
  if (typeof id !== 'string' || id.length === 0 || id.length > 200) return null
  return { createdAt, id }
}
