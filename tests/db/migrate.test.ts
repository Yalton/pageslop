import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { entriesToBaseline, PUSH_ERA_CHECKS } from '../../scripts/migrate.mjs'

const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as {
  entries: { tag: string; when: number }[]
}
const allPresent = Object.fromEntries(Object.keys(PUSH_ERA_CHECKS).map((tag) => [tag, true]))

describe('entriesToBaseline', () => {
  it('has a check for every migration the entrypoint used to push', () => {
    expect(journal.entries.slice(0, 4).map((e) => e.tag)).toEqual(Object.keys(PUSH_ERA_CHECKS))
  })

  it('records every push-era migration for a database pushed by the last push release', () => {
    expect(entriesToBaseline(journal.entries, allPresent).map((e) => e.tag)).toEqual(Object.keys(PUSH_ERA_CHECKS))
  })

  it('stops at the first missing migration so older pushed databases get the rest applied', () => {
    const present = { ...allPresent, '0002_safe_spyke': false }
    expect(entriesToBaseline(journal.entries, present).map((e) => e.tag)).toEqual([
      '0000_clean_justice',
      '0001_mean_purifiers',
    ])
  })

  it('never records migrations added after the switch from push', () => {
    const later = [...journal.entries, { tag: '9999_future', when: Date.now() }]
    expect(entriesToBaseline(later, { ...allPresent, '9999_future': true })).toHaveLength(4)
  })
})
