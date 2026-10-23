import { describe, it, expect } from 'vitest'
import { readLimited } from '@/lib/net/read-limited'

function streamOf(chunks: Uint8Array[]) {
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = chunks.shift()
      if (next) controller.enqueue(next)
      else controller.close()
    },
    cancel() {
      cancelled = true
    },
  })
  return { stream, wasCancelled: () => cancelled }
}

const bytes = (n: number, fill = 97) => new Uint8Array(n).fill(fill)

describe('readLimited', () => {
  it('reads a body under the limit whole', async () => {
    const { stream } = streamOf([bytes(3), bytes(4)])
    const out = await readLimited(stream, 10)
    expect(out.truncated).toBe(false)
    expect(out.bytes.byteLength).toBe(7)
  })

  it('reads a body of exactly the limit without truncating', async () => {
    const { stream } = streamOf([bytes(5), bytes(5)])
    const out = await readLimited(stream, 10)
    expect(out.truncated).toBe(false)
    expect(out.bytes.byteLength).toBe(10)
  })

  it('stops at the limit, keeps the first bytes and cancels the rest', async () => {
    const { stream, wasCancelled } = streamOf([bytes(6, 1), bytes(6, 2), bytes(6, 3)])
    const out = await readLimited(stream, 10)
    expect(out.truncated).toBe(true)
    expect([...out.bytes]).toEqual([1, 1, 1, 1, 1, 1, 2, 2, 2, 2])
    expect(wasCancelled()).toBe(true)
  })

  it('treats a null body as empty', async () => {
    expect(await readLimited(null, 10)).toEqual({ bytes: new Uint8Array(0), truncated: false })
  })
})
