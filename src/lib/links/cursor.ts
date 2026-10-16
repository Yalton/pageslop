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
const TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,6})?$/

/**
 * True only for a real calendar date and time. The shape check alone would let
 * "2026-13-45 99:99:99" through, and Postgres's ::timestamp cast would then
 * throw (a 500 instead of a 400).
 */
function isValidTimestamp(text: string): boolean {
  const m = TIMESTAMP_RE.exec(text)
  if (!m) return false
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number)
  if (year < 1) return false
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  date.setUTCFullYear(year) // Date.UTC maps years 0-99 to 1900-1999
  // Round-trip: any out-of-range field rolls over and changes a component.
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  )
}

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
  if (typeof createdAt !== 'string' || !isValidTimestamp(createdAt)) return null
  if (typeof id !== 'string' || id.length === 0 || id.length > 200) return null
  return { createdAt, id }
}
