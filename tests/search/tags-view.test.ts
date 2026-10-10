import { describe, it, expect } from 'vitest'
import { selectTagsToShow } from '@/lib/utils/tags-view'

const tags = [
  { name: 'code', count: 25 },
  { name: 'conga', count: 1 },
  { name: 'cloud', count: 3 },
  { name: 'css', count: 1 },
]

describe('selectTagsToShow', () => {
  it('hides single-use tags by default and reports how many', () => {
    const r = selectTagsToShow(tags, '', false)
    expect(r.shown.map((t) => t.name)).toEqual(['code', 'cloud'])
    expect(r.hiddenCount).toBe(2)
  })

  it('shows every tag when showAll is on', () => {
    const r = selectTagsToShow(tags, '', true)
    expect(r.shown).toHaveLength(4)
    expect(r.hiddenCount).toBe(0)
  })

  it('searches all tags, single-use ones included', () => {
    const r = selectTagsToShow(tags, 'CS', false)
    expect(r.shown.map((t) => t.name)).toEqual(['css'])
    expect(r.hiddenCount).toBe(0)
  })
})
