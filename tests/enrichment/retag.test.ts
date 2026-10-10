import { describe, it, expect } from 'vitest'
import { planTagCleanup } from '@/lib/enrichment/retag'

describe('planTagCleanup', () => {
  it('merges plural tags into their singular form', () => {
    const plan = planTagCleanup([
      { id: 't1', name: 'agent', source: 'rule' },
      { id: 't2', name: 'agents', source: 'rule' },
    ])
    expect(plan.merges).toEqual([{ fromId: 't2', toName: 'agent' }])
    expect(plan.deletes).toEqual([])
  })

  it('merges into a singular tag that does not exist yet', () => {
    const plan = planTagCleanup([{ id: 't1', name: 'tools', source: 'llm' }])
    expect(plan.merges).toEqual([{ fromId: 't1', toName: 'tool' }])
  })

  it('deletes junk rule tags but never user or llm tags', () => {
    const plan = planTagCleanup([
      { id: 'r1', name: 'aboutpresscopyrightcontact', source: 'rule' },
      { id: 'r2', name: '221f1f', source: 'rule' },
      { id: 'r3', name: 'please', source: 'rule' },
      { id: 'u1', name: 'please', source: 'user' },
      { id: 'l1', name: 'machine learning', source: 'llm' },
      { id: 'k1', name: 'python', source: 'rule' },
    ])
    expect(plan.deletes.sort()).toEqual(['r1', 'r2', 'r3'])
    expect(plan.merges).toEqual([])
  })

  it('leaves user tags un-merged', () => {
    const plan = planTagCleanup([{ id: 'u1', name: 'notes', source: 'user' }])
    expect(plan).toEqual({ merges: [], deletes: [] })
  })
})
