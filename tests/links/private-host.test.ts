import { describe, it, expect } from 'vitest'
import { isPrivateHostUrl, publicImageUrl } from '@/lib/utils/private-host'

describe('isPrivateHostUrl', () => {
  it.each([
    'http://192.168.50.154:8800/favicon.ico',
    'http://10.0.0.5/a.png',
    'http://172.16.0.1/a.png',
    'http://172.31.255.255/a.png',
    'http://127.0.0.1:3000/a.png',
    'http://169.254.1.1/a.png',
    'http://100.101.102.103/a.png',
    'http://0.0.0.0/a.png',
    'http://localhost:8080/a.png',
    'http://nas.lan/a.png',
    'http://printer.local/a.png',
    'http://router.home.arpa/a.png',
    'http://homeassistant/a.png',
    'http://[::1]/a.png',
    'http://[fd12:3456::1]/a.png',
    'http://[fe80::1]/a.png',
    'http://[::ffff:192.168.1.1]/a.png',
  ])('treats %s as private', (url) => {
    expect(isPrivateHostUrl(url)).toBe(true)
  })

  it.each([
    'https://example.com/favicon.ico',
    'https://i.ytimg.com/vi/x/hqdefault.jpg',
    'http://172.32.0.1/a.png',
    'http://8.8.8.8/a.png',
    'http://[2606:4700::1111]/a.png',
    'https://192.168.example.com/a.png',
    '/api/screenshots/abc.webp',
    'not a url',
  ])('treats %s as public', (url) => {
    expect(isPrivateHostUrl(url)).toBe(false)
  })
})

describe('publicImageUrl', () => {
  it('drops private and empty URLs', () => {
    expect(publicImageUrl('http://192.168.1.2/x.png')).toBeUndefined()
    expect(publicImageUrl(null)).toBeUndefined()
    expect(publicImageUrl('')).toBeUndefined()
    expect(publicImageUrl('https://example.com/x.png')).toBe('https://example.com/x.png')
  })
})
