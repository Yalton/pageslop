import { describe, it, expect } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { links, apiTokens } from '@/lib/db/schema'
import { STASH_STATES } from '@/types'
import type { LinkSource, StashState, Link } from '@/types'

describe('STASH_STATES', () => {
  it('lists exactly inbox, read, kept, archived in that order', () => {
    expect(STASH_STATES).toEqual(['inbox', 'read', 'kept', 'archived'])
  })

  it('StashState and LinkSource accept every allowed value', () => {
    const states: StashState[] = ['inbox', 'read', 'kept', 'archived']
    const sources: LinkSource[] = ['manual', 'import', 'stash']
    expect(states.every((s) => (STASH_STATES as readonly string[]).includes(s))).toBe(true)
    expect(sources).toHaveLength(3)
  })

  it('Link carries source, stashState and stashedAt', () => {
    const partial: Pick<Link, 'source' | 'stashState' | 'stashedAt'> = {
      source: 'stash',
      stashState: null,
      stashedAt: null,
    }
    expect(partial.source).toBe('stash')
  })
})

describe('links table stash columns', () => {
  const cfg = getTableConfig(links)
  const col = (name: string) => cfg.columns.find((c) => c.name === name)

  it('source is text, not null, default manual', () => {
    const source = col('source')
    expect(source).toBeDefined()
    expect(source?.notNull).toBe(true)
    expect(source?.default).toBe('manual')
  })

  it('stash_state and stashed_at are nullable', () => {
    expect(col('stash_state')).toBeDefined()
    expect(col('stash_state')?.notNull).toBe(false)
    expect(col('stashed_at')).toBeDefined()
    expect(col('stashed_at')?.notNull).toBe(false)
  })

  it('has index links_user_stash_state_idx on (user_id, stash_state)', () => {
    const idx = cfg.indexes.find((i) => i.config.name === 'links_user_stash_state_idx')
    expect(idx).toBeDefined()
    const cols = idx!.config.columns.map((c) => (c as { name: string }).name)
    expect(cols).toEqual(['user_id', 'stash_state'])
  })
})

describe('api_tokens table', () => {
  const cfg = getTableConfig(apiTokens)
  const col = (name: string) => cfg.columns.find((c) => c.name === name)

  it('is named api_tokens', () => {
    expect(cfg.name).toBe('api_tokens')
  })

  it('has the expected columns', () => {
    expect(cfg.columns.map((c) => c.name).sort()).toEqual(
      ['created_at', 'id', 'last_used_at', 'name', 'scopes', 'token_hash', 'user_id'].sort()
    )
  })

  it('scopes is a non-null text[] that defaults to stash, so pre-scope tokens keep working for the extension', () => {
    expect(col('scopes')?.notNull).toBe(true)
    expect(col('scopes')?.getSQLType()).toBe('text[]')
    const def = col('scopes')?.default as { queryChunks?: unknown[] } | undefined
    expect(JSON.stringify(def)).toContain("ARRAY['stash']::text[]")
  })

  it('token_hash is unique and not null', () => {
    expect(col('token_hash')?.isUnique).toBe(true)
    expect(col('token_hash')?.notNull).toBe(true)
  })

  it('name is not null, last_used_at is nullable', () => {
    expect(col('name')?.notNull).toBe(true)
    expect(col('last_used_at')?.notNull).toBe(false)
  })

  it('user_id references user with cascade delete', () => {
    expect(cfg.foreignKeys).toHaveLength(1)
    expect(cfg.foreignKeys[0].onDelete).toBe('cascade')
  })
})
