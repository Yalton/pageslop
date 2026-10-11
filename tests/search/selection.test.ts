import { describe, it, expect } from 'vitest'
import { groupIdsByState, restoreTarget, toggleSelection } from '@/lib/utils/selection'

const order = ['a', 'b', 'c', 'd', 'e']

describe('toggleSelection', () => {
  it('toggles one id on a plain click', () => {
    expect([...toggleSelection(new Set(), order, 'b', false, null)]).toEqual(['b'])
    expect([...toggleSelection(new Set(['b']), order, 'b', false, 'b')]).toEqual([])
  })

  it('selects the range from the anchor on shift-click, either direction', () => {
    expect([...toggleSelection(new Set(['b']), order, 'd', true, 'b')].sort()).toEqual(['b', 'c', 'd'])
    expect([...toggleSelection(new Set(['d']), order, 'a', true, 'd')].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('clears the range when the shift-clicked id was selected', () => {
    const selected = new Set(['a', 'b', 'c', 'd'])
    expect([...toggleSelection(selected, order, 'c', true, 'a')]).toEqual(['d'])
  })

  it('falls back to a plain toggle when the anchor is gone', () => {
    expect([...toggleSelection(new Set(), order, 'c', true, 'zz')]).toEqual(['c'])
  })
})

describe('restoreTarget', () => {
  it('sends stash tabs to the inbox and hand-saved links to All Links', () => {
    expect(restoreTarget({ source: 'stash' })).toBe('inbox')
    expect(restoreTarget({ source: 'manual' })).toBeNull()
  })
})

describe('groupIdsByState', () => {
  it('groups ids by state, keeping null as its own group', () => {
    const groups = groupIdsByState<string | null>([['a', null], ['b', 'kept'], ['c', null]])
    expect(groups.get(null)).toEqual(['a', 'c'])
    expect(groups.get('kept')).toEqual(['b'])
  })
})
