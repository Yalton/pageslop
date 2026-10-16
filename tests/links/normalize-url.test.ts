import { describe, it, expect } from 'vitest'
import { normalizeUrl } from '@/lib/links/normalize-url'

describe('normalizeUrl', () => {
  it('adds the root slash so a bare host and host/ match', () => {
    expect(normalizeUrl('http://ombi.billbert.co')).toBe(normalizeUrl('http://ombi.billbert.co/'))
    expect(normalizeUrl('http://ombi.billbert.co')).toBe('http://ombi.billbert.co/')
  })

  it('lowercases scheme and host and drops default ports', () => {
    expect(normalizeUrl('HTTPS://Example.COM:443/Path')).toBe('https://example.com/Path')
    expect(normalizeUrl('http://example.com:80/')).toBe('http://example.com/')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  https://a.com/x  ')).toBe('https://a.com/x')
  })

  it('keeps path case, query, fragment, www and trailing path slashes, which can change the page', () => {
    expect(normalizeUrl('https://www.youtube.com/watch?v=tKkd6Zsz9gA')).toBe('https://www.youtube.com/watch?v=tKkd6Zsz9gA')
    expect(normalizeUrl('https://accounts.zoho.com/home#profile/personal')).toBe('https://accounts.zoho.com/home#profile/personal')
    expect(normalizeUrl('https://a.com/docs/')).not.toBe(normalizeUrl('https://a.com/docs'))
  })

  it('returns unparseable input unchanged', () => {
    expect(normalizeUrl('not a url')).toBe('not a url')
  })
})
