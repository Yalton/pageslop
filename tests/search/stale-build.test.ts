import { describe, it, expect } from 'vitest'
import { isStaleBuildError, shouldReloadForStaleBuild } from '@/lib/utils/stale-build'

describe('isStaleBuildError', () => {
  it.each([
    [{ name: 'ChunkLoadError', message: 'x' }],
    [{ name: 'Error', message: 'Loading chunk 4815 failed.' }],
    [{ name: 'Error', message: 'Loading CSS chunk app/layout failed' }],
    [{ name: 'TypeError', message: 'Failed to fetch dynamically imported module: /_next/x.js' }],
    [{ name: 'Error', message: 'Failed to find Server Action "abc". This request might be from an older or newer deployment.' }],
  ])('recognises %o', (error) => {
    expect(isStaleBuildError(error)).toBe(true)
  })

  it('ignores ordinary errors', () => {
    expect(isStaleBuildError({ name: 'TypeError', message: 'tags.some is not a function' })).toBe(false)
    expect(isStaleBuildError(null)).toBe(false)
  })
})

describe('shouldReloadForStaleBuild', () => {
  it('reloads the first time and again only after the cooldown', () => {
    expect(shouldReloadForStaleBuild(null, 1_000)).toBe(true)
    expect(shouldReloadForStaleBuild(1_000, 20_000)).toBe(false)
    expect(shouldReloadForStaleBuild(1_000, 40_000)).toBe(true)
  })
})
