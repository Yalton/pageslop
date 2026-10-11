import { describe, it, expect } from 'vitest'
import { clearPersisted, createPersistentCache, loadPersisted } from '@/lib/swr/persistent-cache'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  }
}

describe('persistent SWR cache', () => {
  it('saves only the persisted keys and seeds them back for the same user', () => {
    const storage = memoryStorage()
    const first = createPersistentCache('u1', storage)
    first.cache.set('/api/links', { data: [{ id: 'a' }] })
    first.cache.set('/api/tags', { data: [{ name: 'ai', count: 2 }] })
    first.cache.set('/api/tokens', { data: { secret: true } })
    first.save()

    const second = createPersistentCache('u1', storage)
    expect(second.cache.size).toBe(0)
    expect(second.saved).toEqual({
      '/api/links': [{ id: 'a' }],
      '/api/tags': [{ name: 'ai', count: 2 }],
    })
  })

  it("never seeds another user's data", () => {
    const storage = memoryStorage()
    const u1 = createPersistentCache('u1', storage)
    u1.cache.set('/api/links', { data: [{ id: 'a' }] })
    u1.save()
    expect(createPersistentCache('u2', storage).saved).toEqual({})
  })

  it('saving an empty cache removes the saved entry', () => {
    const storage = memoryStorage()
    const p = createPersistentCache('u1', storage)
    p.cache.set('/api/links', { data: [] })
    p.save()
    p.cache.clear()
    p.save()
    expect(storage.getItem('pageslop-swr:u1')).toBeNull()
  })

  it('ignores corrupt storage and works without storage', () => {
    const storage = memoryStorage()
    storage.setItem('pageslop-swr:u1', '{not json')
    expect(loadPersisted('u1', storage)).toEqual({})
    expect(createPersistentCache('u1', null).saved).toEqual({})
  })

  it('clearPersisted removes saved data for every user and nothing else', () => {
    const storage = memoryStorage()
    storage.setItem('pageslop-swr:u1', '{}')
    storage.setItem('pageslop-swr:u2', '{}')
    storage.setItem('pageslop-view-mode', 'grid')
    clearPersisted(storage)
    expect(storage.length).toBe(1)
    expect(storage.getItem('pageslop-view-mode')).toBe('grid')
  })
})
