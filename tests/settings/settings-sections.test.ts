import { describe, it, expect } from 'vitest'
import { SETTINGS_SECTIONS, getActiveSectionId, isSettingsSectionId } from '@/lib/utils/settings-sections'

describe('SETTINGS_SECTIONS', () => {
  const ids: string[] = SETTINGS_SECTIONS.map((s) => s.id)

  it('keeps the anchors other pages link to', () => {
    expect(ids).toContain('browser-extension')
    expect(ids).toContain('mcp')
  })

  it('puts integrations first and rare/destructive sections last', () => {
    expect(ids[0]).toBe('browser-extension')
    expect(ids.indexOf('account')).toBeLessThan(ids.indexOf('data'))
    expect(ids[ids.length - 1]).toBe('danger-zone')
  })

  it('has unique ids', () => {
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('recognises section ids', () => {
    expect(isSettingsSectionId('mcp')).toBe(true)
    expect(isSettingsSectionId('nope')).toBe(false)
  })
})

describe('getActiveSectionId', () => {
  const at = (...tops: number[]) => tops.map((top, i) => ({ id: `s${i}`, top }))

  it('returns null with no sections', () => {
    expect(getActiveSectionId([], 80)).toBeNull()
  })

  it('defaults to the first section before any reaches the line', () => {
    expect(getActiveSectionId(at(200, 900, 1600), 80)).toBe('s0')
  })

  it('picks the last section whose top passed the offset', () => {
    expect(getActiveSectionId(at(-700, 40, 800), 80)).toBe('s1')
    expect(getActiveSectionId(at(-1400, -600, 80), 80)).toBe('s2')
  })

  it('selects the last section when scrolled to the bottom', () => {
    expect(getActiveSectionId(at(-1400, -600, 300), 80, true)).toBe('s2')
  })
})
