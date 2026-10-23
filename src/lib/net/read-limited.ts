/**
 * Reads a body stream into memory, stopping after `maxBytes`. The rest of the
 * stream is cancelled, so an oversized or endless body never sits in memory.
 * `truncated` is true when the body had more than `maxBytes`.
 */
export async function readLimited(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; truncated: boolean }> {
  if (!body) return { bytes: new Uint8Array(0), truncated: false }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const room = maxBytes - total
      if (value.byteLength > room) {
        if (room > 0) chunks.push(value.subarray(0, room))
        total += Math.max(room, 0)
        truncated = true
        break
      }
      chunks.push(value)
      total += value.byteLength
    }
  } finally {
    if (truncated) await reader.cancel().catch(() => {})
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { bytes, truncated }
}
