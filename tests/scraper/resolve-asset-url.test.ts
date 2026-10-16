import { describe, it, expect } from 'vitest'
import { resolveAssetUrl } from '@/lib/scraper/resolve-asset-url'

describe('resolveAssetUrl', () => {
  const page = 'https://ombi.billbert.co/app/index.html'
  it('resolves root-relative paths against the page origin', () => {
    expect(resolveAssetUrl('/assets/img/logo.png', 'https://repo.billbert.co/x')).toBe('https://repo.billbert.co/assets/img/logo.png')
  })
  it('resolves ~/ style paths as a path segment', () => {
    expect(resolveAssetUrl('~/images/logo.png', page)).toBe('https://ombi.billbert.co/app/~/images/logo.png')
  })
  it('resolves document-relative paths against the page path', () => {
    expect(resolveAssetUrl('img/a.png', page)).toBe('https://ombi.billbert.co/app/img/a.png')
  })
  it('resolves protocol-relative URLs', () => {
    expect(resolveAssetUrl('//cdn.x.com/a.png', page)).toBe('https://cdn.x.com/a.png')
  })
  it('keeps absolute http(s) URLs', () => {
    expect(resolveAssetUrl('http://a.com/i.png', page)).toBe('http://a.com/i.png')
  })
  it('drops non-http(s) results and empty values', () => {
    expect(resolveAssetUrl('data:image/png;base64,AAA', page)).toBeNull()
    expect(resolveAssetUrl('javascript:alert(1)', page)).toBeNull()
    expect(resolveAssetUrl('  ', page)).toBeNull()
    expect(resolveAssetUrl(undefined, page)).toBeNull()
    expect(resolveAssetUrl('/a.png', 'not a url')).toBeNull()
  })
})
