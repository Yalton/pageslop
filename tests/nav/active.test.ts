import { describe, it, expect } from 'vitest'
import { isNavActive } from '@/lib/nav/active'

describe('isNavActive', () => {
  it('matches /dashboard exactly and nowhere else', () => {
    expect(isNavActive('/dashboard', '/dashboard')).toBe(true)
    expect(isNavActive('/dashboard/revisit', '/dashboard')).toBe(false)
    expect(isNavActive('/dashboard/settings', '/dashboard')).toBe(false)
  })

  it('matches other items on the exact path or a child path', () => {
    expect(isNavActive('/dashboard/revisit', '/dashboard/revisit')).toBe(true)
    expect(isNavActive('/dashboard/tags/react', '/dashboard/tags')).toBe(true)
  })

  it('does not match a sibling that only shares a prefix', () => {
    expect(isNavActive('/dashboard/tagsearch', '/dashboard/tags')).toBe(false)
  })

  it('never matches the "#" placeholder href', () => {
    expect(isNavActive('/dashboard', '#')).toBe(false)
  })
})
