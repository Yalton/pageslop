import { describe, it, expect } from 'vitest'
import { categoryUpdate } from '@/lib/enrichment/category-source'

describe('categoryUpdate', () => {
  it('writes category and rule source for rule-based results', () => {
    expect(categoryUpdate(null, 'Technology', 'rule')).toEqual({ category: 'Technology', categorySource: 'rule' })
  })
  it('writes category and llm source for LLM results', () => {
    expect(categoryUpdate('rule', 'News', 'llm')).toEqual({ category: 'News', categorySource: 'llm' })
  })
  it('overwrites an llm category on re-enrich', () => {
    expect(categoryUpdate('llm', 'Design', 'rule')).toEqual({ category: 'Design', categorySource: 'rule' })
  })
  it('never overwrites a hand-picked (user) category', () => {
    expect(categoryUpdate('user', 'News', 'llm')).toEqual({})
    expect(categoryUpdate('user', 'News', 'rule')).toEqual({})
  })
})
