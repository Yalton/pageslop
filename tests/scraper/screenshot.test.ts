import { describe, expect, it, vi } from 'vitest'

const launch = vi.fn()
vi.mock('puppeteer', () => ({ default: { launch } }))

const { screenshotUrl } = await import('@/lib/scraper/screenshot')

describe('screenshotUrl SSRF guard', () => {
  it.each([
    'http://192.168.50.78:81/',
    'http://127.0.0.1:3000/',
    'http://[::1]/',
    'http://0x7f.1/',
    'http://localhost/',
    'file:///etc/passwd',
  ])('refuses %s without launching a browser', async (url) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await screenshotUrl(url, 'link-1')).toBeNull()
    expect(launch).not.toHaveBeenCalled()
  })
})
