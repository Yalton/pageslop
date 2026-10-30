import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { safeFetch } from '../net/ssrf-guard'
import { readLimited } from '../net/read-limited'
import { hostForLog } from '../net/log-url'
import { SCREENSHOT_DIR, cachedImagePath, type ImageKind } from './screenshot-files'

/**
 * Link preview images and favicons are downloaded once by the worker and
 * served by the app, so a viewer's browser never contacts the saved sites.
 * They live next to the screenshots, re-encoded as WebP.
 */
const LIMITS: Record<ImageKind, { maxBytes: number; width: number; height: number }> = {
  og: { maxBytes: 8 * 1024 * 1024, width: 1200, height: 1200 },
  favicon: { maxBytes: 512 * 1024, width: 128, height: 128 },
}

export function cachedImageUrl(linkId: string, kind: ImageKind): string {
  return `/api/images/${linkId}/${kind}`
}

/** Whether a stored image URL still points at another site. */
export function isRemoteImageUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url)
}

/** A decoded .ico entry: an embedded PNG, or raw RGBA pixels from a BMP entry. */
export type IcoImage =
  | { png: Uint8Array }
  | { rgba: Uint8Array; width: number; height: number }

/**
 * The largest image in an .ico file, or null if the data is not an icon or
 * holds no entry this can read. Entries are either PNGs or uncompressed BMPs
 * (1, 4, 8, 24 or 32 bits per pixel), whose transparency comes from the
 * alpha channel (32-bit) or the 1-bit AND mask that follows the pixels.
 */
export function decodeIco(data: Uint8Array): IcoImage | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (data.byteLength < 6 || view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) return null
  const entries: { size: number; offset: number; length: number }[] = []
  for (let i = 0; i < view.getUint16(4, true); i++) {
    const entry = 6 + i * 16
    if (entry + 16 > data.byteLength) break
    const length = view.getUint32(entry + 8, true)
    const offset = view.getUint32(entry + 12, true)
    if (length < 40 || offset + length > data.byteLength) continue
    entries.push({ size: (data[entry] || 256) * (data[entry + 1] || 256), offset, length })
  }
  entries.sort((a, b) => b.size - a.size)
  for (const { offset, length } of entries) {
    const bytes = data.subarray(offset, offset + length)
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { png: bytes }
    const bmp = decodeIcoBitmap(bytes)
    if (bmp) return bmp
  }
  return null
}

function decodeIcoBitmap(bytes: Uint8Array): IcoImage | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerSize = view.getUint32(0, true)
  const width = view.getInt32(4, true)
  const height = view.getInt32(8, true) / 2 // the AND mask doubles the stored height
  const bpp = view.getUint16(14, true)
  if (headerSize < 40 || view.getUint32(16, true) !== 0) return null // compressed
  if (width <= 0 || width > 256 || height <= 0 || height > 256 || ![1, 4, 8, 24, 32].includes(bpp)) return null

  const paletteSize = bpp <= 8 ? view.getUint32(32, true) || 1 << bpp : 0
  const pixels = headerSize + paletteSize * 4
  const stride = Math.ceil((width * bpp) / 32) * 4
  const maskStride = Math.ceil(width / 32) * 4
  const mask = pixels + stride * height
  if (mask + maskStride * height > bytes.byteLength) return null

  const rgba = new Uint8Array(width * height * 4)
  let anyAlpha = false
  for (let y = 0; y < height; y++) {
    const row = pixels + (height - 1 - y) * stride // rows are stored bottom-up
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * 4
      let b: number, g: number, r: number, a = 255
      if (bpp >= 24) {
        const p = row + x * (bpp / 8)
        ;[b, g, r] = [bytes[p], bytes[p + 1], bytes[p + 2]]
        if (bpp === 32) {
          a = bytes[p + 3]
          if (a) anyAlpha = true
        }
      } else {
        const bit = x * bpp
        const index = (bytes[row + (bit >> 3)] >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1)
        const p = headerSize + index * 4
        ;[b, g, r] = [bytes[p], bytes[p + 1], bytes[p + 2]]
      }
      rgba.set([r, g, b, a], out)
    }
  }
  // Without a usable alpha channel, the AND mask marks transparent pixels
  if (!anyAlpha) {
    for (let y = 0; y < height; y++) {
      const row = mask + (height - 1 - y) * maskStride
      for (let x = 0; x < width; x++) {
        const transparent = (bytes[row + (x >> 3)] >> (7 - (x & 7))) & 1
        rgba[(y * width + x) * 4 + 3] = transparent ? 0 : 255
      }
    }
  }
  return { rgba, width, height }
}

/**
 * Download one image through the SSRF guard, re-encode it as WebP (which also
 * strips SVG scripts and metadata) and store it for the link. Returns the
 * app URL that serves it, or null if the image could not be fetched or
 * decoded. Never throws.
 */
export async function cacheImage(
  url: string,
  linkId: string,
  kind: ImageKind,
  dir: string = SCREENSHOT_DIR,
): Promise<string | null> {
  const { maxBytes, width, height } = LIMITS[kind]
  try {
    const { response } = await safeFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pageslop/1.0)', Accept: 'image/*' },
      signal: AbortSignal.timeout(8000),
    })
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
    if (!response.ok || (type && !type.startsWith('image/') && type !== 'application/octet-stream')) {
      await response.body?.cancel().catch(() => {})
      return null
    }
    const { bytes, truncated } = await readLimited(response.body, maxBytes)
    if (truncated || bytes.byteLength === 0) return null

    const icon = decodeIco(bytes)
    const image = !icon
      ? sharp(bytes, { limitInputPixels: 50_000_000, animated: false })
      : 'png' in icon
        ? sharp(icon.png)
        : sharp(icon.rgba, { raw: { width: icon.width, height: icon.height, channels: 4 } })
    const webp = await image
      .resize({ width, height, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    await mkdir(dir, { recursive: true })
    await writeFile(cachedImagePath(linkId, kind, dir), webp)
    return cachedImageUrl(linkId, kind)
  } catch (err) {
    console.error(`[images] could not cache the ${kind} image of link ${linkId} (${hostForLog(url)}): ${err instanceof Error ? err.message : err}`)
    return null
  }
}

/**
 * Replace a link's remote og:image and favicon URLs with cached copies. An
 * image that cannot be cached becomes null (the card falls back to a
 * screenshot or initial) rather than staying remote. Local and data: URLs are
 * kept as they are.
 */
export async function localiseLinkImages(
  linkId: string,
  images: { ogImage: string | null; favicon: string | null },
  dir: string = SCREENSHOT_DIR,
): Promise<{ ogImage: string | null; favicon: string | null }> {
  const [ogImage, favicon] = await Promise.all([
    isRemoteImageUrl(images.ogImage) ? cacheImage(images.ogImage, linkId, 'og', dir) : images.ogImage,
    isRemoteImageUrl(images.favicon) ? cacheImage(images.favicon, linkId, 'favicon', dir) : images.favicon,
  ])
  return { ogImage, favicon }
}
