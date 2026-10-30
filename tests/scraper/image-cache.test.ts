import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureSafeFetch } from '@/lib/net/ssrf-guard'
import { cacheImage, decodeIco, localiseLinkImages } from '@/lib/scraper/image-cache'
import { cachedImagePath } from '@/lib/scraper/screenshot-files'

const LINK = '11111111-1111-1111-1111-111111111111'

let dir: string
let respond: (url: string) => Response
let restore: () => void
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'images-'))
  restore = configureSafeFetch({
    fetch: async (url) => respond(url),
    resolve: async () => [{ address: '93.184.215.14', family: 4 }],
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  restore()
  vi.restoreAllMocks()
})

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#3366cc' } }).png().toBuffer()

function ico(entry: Buffer): Buffer {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header[6] = 32
  header[7] = 32
  header.writeUInt32LE(entry.length, 14)
  header.writeUInt32LE(22, 18)
  return Buffer.concat([header, entry])
}

describe('cacheImage', () => {
  it('stores a remote image as WebP, scaled down, and returns its app URL', async () => {
    const big = await png(3000, 1500)
    respond = () => new Response(new Uint8Array(big), { headers: { 'content-type': 'image/png' } })

    expect(await cacheImage('https://example.com/og.png', LINK, 'og', dir)).toBe(`/api/images/${LINK}/og`)
    const meta = await sharp(await readFile(cachedImagePath(LINK, 'og', dir))).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(1200)
  })

  it('rasterises an SVG favicon, so no script survives', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><script>alert(1)</script><rect width="64" height="64" fill="red"/></svg>'
    respond = () => new Response(svg, { headers: { 'content-type': 'image/svg+xml' } })

    expect(await cacheImage('https://example.com/icon.svg', LINK, 'favicon', dir)).toBe(`/api/images/${LINK}/favicon`)
    const stored = await readFile(cachedImagePath(LINK, 'favicon', dir))
    expect((await sharp(stored).metadata()).format).toBe('webp')
    expect(stored.toString('latin1')).not.toContain('script')
  })

  it('reads the PNG inside an .ico favicon', async () => {
    const icon = ico(await png(32, 32))
    respond = () => new Response(new Uint8Array(icon), { headers: { 'content-type': 'image/x-icon' } })
    expect(await cacheImage('https://example.com/favicon.ico', LINK, 'favicon', dir)).toBe(`/api/images/${LINK}/favicon`)
  })

  it('returns null for a non-image response, an error status or an oversized body', async () => {
    respond = () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
    expect(await cacheImage('https://example.com/a', LINK, 'og', dir)).toBeNull()

    respond = () => new Response('nope', { status: 404, headers: { 'content-type': 'image/png' } })
    expect(await cacheImage('https://example.com/b', LINK, 'og', dir)).toBeNull()

    respond = () => new Response(new Uint8Array(600 * 1024), { headers: { 'content-type': 'image/png' } })
    expect(await cacheImage('https://example.com/c', LINK, 'favicon', dir)).toBeNull()

    expect(await readdir(dir)).toEqual([])
  })

  it('refuses a private address without fetching it', async () => {
    respond = () => {
      throw new Error('should not fetch')
    }
    expect(await cacheImage('http://192.168.1.10/og.png', LINK, 'og', dir)).toBeNull()
  })
})

describe('localiseLinkImages', () => {
  it('caches remote images, nulls failed ones and keeps local URLs', async () => {
    const image = await png(64, 64)
    respond = (url) =>
      url.includes('good') ? new Response(new Uint8Array(image), { headers: { 'content-type': 'image/png' } }) : new Response('x', { status: 500 })

    expect(await localiseLinkImages(LINK, { ogImage: 'https://example.com/good.png', favicon: 'https://example.com/bad.ico' }, dir)).toEqual({
      ogImage: `/api/images/${LINK}/og`,
      favicon: null,
    })
    expect(await localiseLinkImages(LINK, { ogImage: `/api/screenshots/${LINK}`, favicon: null }, dir)).toEqual({
      ogImage: `/api/screenshots/${LINK}`,
      favicon: null,
    })
  })
})

/** A 2x2 BMP icon entry: 32-bit with alpha, or 4-bit paletted with an AND mask. */
function bmpEntry(bpp: 4 | 32): Buffer {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(2, 4)
  header.writeInt32LE(4, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(bpp, 14)
  const mask = Buffer.from([0b01000000, 0, 0, 0, 0b00000000, 0, 0, 0]) // bottom row: right pixel transparent
  if (bpp === 32) {
    // bottom row first: blue, green; top row: red, half-transparent white
    const pixels = Buffer.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 128])
    return Buffer.concat([header, pixels, mask])
  }
  header.writeUInt32LE(2, 32) // two palette entries
  const palette = Buffer.from([0, 0, 255, 0, 255, 0, 0, 0]) // 0 = red, 1 = blue (BGRX)
  const pixels = Buffer.from([0x10, 0, 0, 0, 0x01, 0, 0, 0]) // bottom row: blue, red; top row: red, blue
  return Buffer.concat([header, palette, pixels, mask])
}

describe('decodeIco', () => {
  it('returns null for data that is not an icon', () => {
    expect(decodeIco(new Uint8Array([1, 2, 3, 4, 5, 6, 7]))).toBeNull()
  })

  it('decodes a 32-bit BMP entry with its alpha channel, top row first', () => {
    expect(decodeIco(ico(bmpEntry(32)))).toEqual({
      width: 2,
      height: 2,
      rgba: new Uint8Array([255, 0, 0, 255, 255, 255, 255, 128, 0, 0, 255, 255, 0, 255, 0, 255]),
    })
  })

  it('decodes a paletted BMP entry and takes transparency from the AND mask', () => {
    expect(decodeIco(ico(bmpEntry(4)))).toEqual({
      width: 2,
      height: 2,
      rgba: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255, 255, 0, 0, 0]),
    })
  })
})
