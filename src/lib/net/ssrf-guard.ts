/**
 * SSRF guard for every server-side fetch of a user-supplied URL
 * (scraper, uptime checker, screenshotter).
 *
 * Policy:
 * - Only http: and https: URLs.
 * - No credentials in the URL (user:pass@host).
 * - Only the default web ports (80 and 443). Bookmarks on other ports are
 *   rare, and refusing them keeps the worker away from admin UIs and
 *   databases that listen on odd ports of otherwise-public hosts.
 * - The host must not be, or resolve to, a private, loopback, link-local,
 *   CGNAT, multicast, reserved or otherwise non-public address. If ANY
 *   resolved address is blocked, the whole host is refused.
 *
 * Enforcement points:
 * - `validateUrl` checks a URL up front (scheme, credentials, port, DNS).
 * - `guardedLookup` re-checks DNS at connect time, so the address the
 *   socket actually connects to is always vetted (defeats DNS rebinding).
 *   Literal IP hosts skip DNS lookup in Node, which is why `validateUrl`
 *   runs before every request and every redirect hop.
 * - `safeFetch` follows redirects manually (max 5) and validates each hop.
 */
import dns from 'node:dns'
import { isIP, type LookupFunction } from 'node:net'
import { Agent, fetch as undiciFetch } from 'undici'

export class SsrfBlockedError extends Error {
  readonly code = 'ESSRFBLOCKED'
  constructor(message: string) {
    super(message)
    this.name = 'SsrfBlockedError'
  }
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])
const ALLOWED_PORTS = new Set(['', '80', '443'])
export const MAX_REDIRECTS = 5

// ---------------------------------------------------------------------------
// IP classification
// ---------------------------------------------------------------------------

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const bytes = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN))
  return bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255) ? bytes : null
}

function parseIPv6(ip: string): number[] | null {
  let s = ip
  // Rewrite an embedded dotted quad (::ffff:1.2.3.4) as two hextets.
  const lastColon = s.lastIndexOf(':')
  if (lastColon !== -1 && s.includes('.', lastColon)) {
    const v4 = parseIPv4(s.slice(lastColon + 1))
    if (!v4) return null
    const hi = ((v4[0] << 8) | v4[1]).toString(16)
    const lo = ((v4[2] << 8) | v4[3]).toString(16)
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const toHextets = (part: string) => (part === '' ? [] : part.split(':'))
  const head = toHextets(halves[0])
  const tail = halves.length === 2 ? toHextets(halves[1]) : []
  if (![...head, ...tail].every((h) => /^[0-9a-f]{1,4}$/i.test(h))) return null
  const known = head.length + tail.length
  if (halves.length === 2 ? known > 7 : known !== 8) return null
  const words = [
    ...head.map((h) => parseInt(h, 16)),
    ...new Array(8 - known).fill(0),
    ...tail.map((h) => parseInt(h, 16)),
  ]
  const bytes: number[] = []
  for (const w of words) bytes.push(w >> 8, w & 0xff)
  return bytes
}

type Cidr = [number[], number]

function cidr(spec: string): Cidr {
  const [addr, len] = spec.split('/')
  const bytes = addr.includes(':') ? parseIPv6(addr) : parseIPv4(addr)
  if (!bytes) throw new Error(`bad CIDR ${spec}`)
  return [bytes, Number(len)]
}

function inCidr(bytes: number[], [net, len]: Cidr): boolean {
  if (bytes.length !== net.length) return false
  for (let bit = 0; bit < len; bit++) {
    const i = bit >> 3
    const mask = 0x80 >> (bit & 7)
    if ((bytes[i] & mask) !== (net[i] & mask)) return false
  }
  return true
}

const BLOCKED_V4: Cidr[] = [
  '0.0.0.0/8', // "this" network / unspecified
  '10.0.0.0/8', // private
  '100.64.0.0/10', // CGNAT
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local (cloud metadata)
  '172.16.0.0/12', // private (incl. Docker default bridges)
  '192.0.0.0/24', // IETF protocol assignments
  '192.0.2.0/24', // TEST-NET-1
  '192.88.99.0/24', // 6to4 relay anycast
  '192.168.0.0/16', // private
  '198.18.0.0/15', // benchmarking
  '198.51.100.0/24', // TEST-NET-2
  '203.0.113.0/24', // TEST-NET-3
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reserved + broadcast
].map(cidr)

const BLOCKED_V6: Cidr[] = [
  '::/128', // unspecified
  '::1/128', // loopback
  '100::/64', // discard-only
  '2001::/32', // Teredo (tunnels to arbitrary IPv4)
  '2001:db8::/32', // documentation
  '3fff::/20', // documentation
  '64:ff9b:1::/48', // local-use NAT64
  'fc00::/7', // unique local (ULA)
  'fe80::/10', // link-local
  'fec0::/10', // site-local (deprecated)
  'ff00::/8', // multicast
].map(cidr)

/** IPv6 prefixes that embed an IPv4 address; [prefix, byte offset of the IPv4]. */
const EMBEDDED_V4: [Cidr, number][] = [
  [cidr('::ffff:0:0/96'), 12], // IPv4-mapped
  [cidr('::/96'), 12], // IPv4-compatible (deprecated)
  [cidr('::ffff:0:0:0/96'), 12], // SIIT IPv4-translated
  [cidr('64:ff9b::/96'), 12], // NAT64
  [cidr('2002::/16'), 2], // 6to4
]

function stripHost(host: string): string {
  let h = host.trim()
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1)
  const zone = h.indexOf('%')
  if (zone !== -1) h = h.slice(0, zone)
  return h.toLowerCase()
}

/**
 * True if `ip` is not a public unicast address. Unparseable input counts as
 * blocked (fail closed).
 */
export function isBlockedIp(ip: string): boolean {
  const h = stripHost(ip)
  const family = isIP(h)
  if (family === 4) {
    const b = parseIPv4(h)
    return !b || BLOCKED_V4.some((c) => inCidr(b, c))
  }
  if (family === 6) {
    const b = parseIPv6(h)
    if (!b) return true
    if (BLOCKED_V6.some((c) => inCidr(b, c))) return true
    for (const [prefix, offset] of EMBEDDED_V4) {
      if (inCidr(b, prefix)) {
        const v4 = b.slice(offset, offset + 4)
        if (BLOCKED_V4.some((c) => inCidr(v4, c))) return true
      }
    }
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/** URL hostname without IPv6 brackets. */
export function hostnameOf(url: URL): string {
  return stripHost(url.hostname)
}

/**
 * Synchronous checks that need no DNS: scheme, credentials, port, literal IP.
 * WHATWG URL parsing already normalises decimal/octal/hex IPv4 forms
 * (http://2130706433, http://0x7f.1) to dotted quads.
 */
export function assertUrlAllowed(input: string | URL): URL {
  let url: URL
  try {
    url = new URL(String(input))
  } catch {
    throw new SsrfBlockedError('invalid URL')
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new SsrfBlockedError(`scheme ${url.protocol} not allowed`)
  }
  if (url.username || url.password) {
    throw new SsrfBlockedError('credentials in URL not allowed')
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new SsrfBlockedError(`port ${url.port} not allowed`)
  }
  const host = hostnameOf(url)
  if (!host) throw new SsrfBlockedError('missing host')
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new SsrfBlockedError(`address ${host} not allowed`)
  } else if (/(^|\.)localhost\.?$/.test(host)) {
    throw new SsrfBlockedError(`host ${host} not allowed`)
  }
  return url
}

export interface ResolvedAddress {
  address: string
  family: number
}

export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>

const systemResolver: Resolver = (hostname) =>
  dns.promises.lookup(hostname, { all: true, verbatim: true })

/** Resolve `hostname` and refuse if any address is blocked. */
export async function resolveHost(
  hostname: string,
  resolver: Resolver = defaults.resolve,
): Promise<ResolvedAddress[]> {
  const host = stripHost(hostname)
  const family = isIP(host)
  if (family) {
    if (isBlockedIp(host)) throw new SsrfBlockedError(`address ${host} not allowed`)
    return [{ address: host, family }]
  }
  const addresses = await resolver(host)
  if (addresses.length === 0) throw new SsrfBlockedError(`host ${host} did not resolve`)
  const bad = addresses.find((a) => isBlockedIp(a.address))
  if (bad) throw new SsrfBlockedError(`host ${host} resolves to blocked address ${bad.address}`)
  return addresses
}

/** Full pre-flight check of a URL, including DNS. Returns the parsed URL. */
export async function validateUrl(input: string | URL, resolver?: Resolver): Promise<URL> {
  const url = assertUrlAllowed(input)
  await resolveHost(hostnameOf(url), resolver)
  return url
}

// ---------------------------------------------------------------------------
// Connect-time DNS check (anti DNS rebinding)
// ---------------------------------------------------------------------------

type BaseLookup = (
  hostname: string,
  options: dns.LookupAllOptions,
  callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void,
) => void

/**
 * Build a `lookup` for net/tls/http/undici that refuses blocked addresses.
 * Because the check runs on the resolution actually used for the socket,
 * a hostname cannot pass validation and then rebind to an internal IP.
 */
export function createGuardedLookup(
  base: BaseLookup = (hostname, options, callback) => dns.lookup(hostname, options, callback),
): LookupFunction {
  return ((hostname: string, options: unknown, callback: unknown) => {
    let opts: dns.LookupOptions
    let cb: (...args: unknown[]) => void
    if (typeof options === 'function') {
      cb = options as typeof cb
      opts = {}
    } else {
      cb = callback as typeof cb
      opts = typeof options === 'number' ? { family: options } : ((options as dns.LookupOptions) ?? {})
    }
    base(hostname, { ...opts, all: true }, (err, addresses) => {
      if (err) return cb(err)
      if (!addresses || addresses.length === 0) {
        const e: NodeJS.ErrnoException = new Error(`getaddrinfo ENOTFOUND ${hostname}`)
        e.code = 'ENOTFOUND'
        return cb(e)
      }
      const bad = addresses.find((a) => isBlockedIp(a.address))
      if (bad) {
        return cb(new SsrfBlockedError(`host ${hostname} resolves to blocked address ${bad.address}`))
      }
      if (opts.all) return cb(null, addresses)
      return cb(null, addresses[0].address, addresses[0].family)
    })
  }) as LookupFunction
}

export const guardedLookup = createGuardedLookup()

// ---------------------------------------------------------------------------
// safeFetch
// ---------------------------------------------------------------------------

export interface SafeFetchInit {
  method?: 'GET' | 'HEAD'
  headers?: Record<string, string>
  signal?: AbortSignal
}

export type FetchLike = (url: string, init: Record<string, unknown>) => Promise<Response>

let guardedAgent: Agent | undefined

const undiciGuardedFetch: FetchLike = (url, init) => {
  guardedAgent ??= new Agent({ connect: { lookup: guardedLookup } })
  return undiciFetch(url, { ...init, dispatcher: guardedAgent }) as unknown as Promise<Response>
}

const defaults: { fetch: FetchLike; resolve: Resolver } = {
  fetch: undiciGuardedFetch,
  resolve: systemResolver,
}

/**
 * Test seam: swap the underlying fetch and resolver. Returns a function that
 * restores the previous values.
 */
export function configureSafeFetch(overrides: Partial<{ fetch: FetchLike; resolve: Resolver }>): () => void {
  const previous = { ...defaults }
  Object.assign(defaults, overrides)
  return () => Object.assign(defaults, previous)
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/**
 * Fetch a user-supplied URL with the SSRF policy enforced on the initial URL
 * and on every redirect hop, with connect-time DNS checks underneath.
 */
export async function safeFetch(
  input: string,
  init: SafeFetchInit = {},
  maxRedirects: number = MAX_REDIRECTS,
): Promise<{ response: Response; url: string }> {
  let current = input
  let method = init.method ?? 'GET'
  for (let hop = 0; ; hop++) {
    const url = await validateUrl(current, defaults.resolve)
    const response = await defaults.fetch(url.href, {
      method,
      headers: init.headers,
      signal: init.signal,
      redirect: 'manual',
    })
    const location = response.headers.get('location')
    if (!REDIRECT_STATUSES.has(response.status) || !location) {
      return { response, url: url.href }
    }
    await response.body?.cancel().catch(() => {})
    if (hop >= maxRedirects) throw new SsrfBlockedError(`too many redirects (> ${maxRedirects})`)
    current = new URL(location, url).href
    if (response.status === 303 && method !== 'HEAD') method = 'GET'
  }
}
