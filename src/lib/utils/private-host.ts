/**
 * Hosts a public page must not load images from. Browsers with Local Network
 * Access checks (Chrome) prompt the visitor when a public site requests a
 * private address, so cards fall back to their initial or colour panel.
 */
export function isPrivateHostUrl(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  if (host.startsWith('[') && host.endsWith(']')) return isPrivateIPv6(host.slice(1, -1))
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.lan') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) return true
  if (!host.includes('.')) return true // single-label names only resolve on a local network
  const v4 = host.split('.').map(Number)
  if (v4.length === 4 && v4.every((n, i) => Number.isInteger(n) && n >= 0 && n <= 255 && host.split('.')[i] !== '')) {
    return isPrivateIPv4(v4)
  }
  return false
}

function isPrivateIPv4([a, b]: number[]): boolean {
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT, e.g. Tailscale
  )
}

function isPrivateIPv6(host: string): boolean {
  if (host === '::1' || host === '::') return true
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1].split('.').map(Number))
  if (host.startsWith('::ffff:')) {
    // URL normalises ::ffff:a.b.c.d to ::ffff:xxxx:xxxx
    const [hi, lo] = host.slice(7).split(':').map((h) => parseInt(h, 16))
    if (Number.isInteger(hi) && Number.isInteger(lo)) return isPrivateIPv4([hi >> 8, hi & 255, lo >> 8, lo & 255])
  }
  const first = parseInt(host.split(':')[0] || '0', 16)
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80
}

/** The image URL if a public page may load it, otherwise undefined. */
export function publicImageUrl(url: string | null | undefined): string | undefined {
  return url && !isPrivateHostUrl(url) ? url : undefined
}
