import { describe, it, expect, vi } from 'vitest'
import { isHttpUrl } from '@/lib/links/http-url'
import { openExternal } from '@/lib/links/open-external'
import { parseUrls } from '@/lib/links/parse-urls'

const UNSAFE = [
  'javascript:alert(1)',
  'JavaScript:alert(document.cookie)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  'ftp://example.com/x',
  'about:blank',
]

describe('isHttpUrl', () => {
  it.each(['https://example.com', 'http://localhost:3000/x?y=1', '  https://a.com  '])('accepts %p', (url) => {
    expect(isHttpUrl(url)).toBe(true)
  })

  it.each([...UNSAFE, 'not a url', '', '/relative'])('refuses %p', (url) => {
    expect(isHttpUrl(url)).toBe(false)
  })
})

describe('parseUrls', () => {
  it('drops non-http(s) schemes so the session save path cannot store javascript: links', () => {
    expect(parseUrls(['https://ok.com', ...UNSAFE].join('\n'))).toEqual(['https://ok.com'])
  })
})

describe('openExternal', () => {
  it('opens http(s) URLs in a new tab with noopener,noreferrer', () => {
    const win = { open: vi.fn() }
    expect(openExternal('https://example.com/a', win)).toBe(true)
    expect(win.open).toHaveBeenCalledWith('https://example.com/a', '_blank', 'noopener,noreferrer')
  })

  it.each(UNSAFE)('refuses %p without calling window.open', (url) => {
    const win = { open: vi.fn() }
    expect(openExternal(url, win)).toBe(false)
    expect(win.open).not.toHaveBeenCalled()
  })
})

describe('parseUrls length cap', () => {
  it('drops URLs longer than 2048 characters', () => {
    const long = `https://example.com/${'a'.repeat(2100)}`
    expect(parseUrls(`${long}\nhttps://ok.com`)).toEqual(['https://ok.com'])
  })
})
