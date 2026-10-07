import dns from 'node:dns'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertUrlAllowed,
  configureSafeFetch,
  createGuardedLookup,
  isBlockedIp,
  type Resolver,
  resolveHost,
  safeFetch,
  SsrfBlockedError,
  validateUrl,
} from '@/lib/net/ssrf-guard'

const PUBLIC_V4 = '93.184.215.14'
const PUBLIC_V6 = '2606:2800:21f:cb07:6820:80da:af6b:8b2c'

/** Resolver backed by a fixed table; unknown names fail like NXDOMAIN. */
function fakeResolver(table: Record<string, string[]>): Resolver {
  return async (host) => {
    const ips = table[host]
    if (!ips) throw Object.assign(new Error(`ENOTFOUND ${host}`), { code: 'ENOTFOUND' })
    return ips.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))
  }
}

describe('isBlockedIp', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.50.1',
    '192.168.50.78',
    '169.254.169.254',
    '100.64.0.1',
    '100.127.255.255',
    '0.0.0.0',
    '0.1.2.3',
    '224.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
    '::',
    '::1',
    '[::1]',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'fe80::1%eth0',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '[::ffff:192.168.50.1]',
    '::ffff:a00:1',
    '::127.0.0.1',
    '64:ff9b::10.0.0.1',
    '2002:c0a8:3201::1', // 6to4 of 192.168.50.1
    '2001:db8::1',
    'not-an-ip',
    '',
  ])('blocks %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(true)
  })

  it.each([
    PUBLIC_V4,
    '8.8.8.8',
    '1.1.1.1',
    '172.32.0.1',
    '100.128.0.1',
    '11.0.0.1',
    PUBLIC_V6,
    '2a00:1450:4001:80b::200e',
    '::ffff:8.8.8.8',
    '64:ff9b::8.8.8.8',
  ])('allows %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(false)
  })
})

describe('assertUrlAllowed', () => {
  it.each([
    ['ftp://example.com/', /scheme/],
    ['file:///etc/passwd', /scheme/],
    ['gopher://example.com/', /scheme/],
    ['javascript:alert(1)', /scheme/],
    ['data:text/html,hi', /scheme/],
    ['http://user:pass@example.com/', /credentials/],
    ['http://user@example.com/', /credentials/],
    ['http://example.com:8080/', /port/],
    ['https://example.com:5432/', /port/],
    ['http://192.168.50.78:81/', /port/],
    ['http://127.0.0.1/', /address/],
    ['http://127.0.0.1:80/', /address/],
    ['http://2130706433/', /address/], // decimal 127.0.0.1
    ['http://0x7f.1/', /address/], // hex + short form
    ['http://0x7f000001/', /address/],
    ['http://0177.0.0.1/', /address/], // octal
    ['http://127.1/', /address/],
    ['http://[::1]/', /address/],
    ['http://[::ffff:127.0.0.1]/', /address/],
    ['http://[::ffff:192.168.50.1]/', /address/],
    ['http://[fe80::1]/', /address/],
    ['http://[fd00::1]/', /address/],
    ['http://169.254.169.254/latest/meta-data/', /address/],
    ['http://192.168.50.1/', /address/],
    ['http://localhost/', /host/],
    ['http://foo.localhost/', /host/],
    ['http://localhost./', /host/],
    ['not a url', /invalid/],
  ])('refuses %s', (url, reason) => {
    expect(() => assertUrlAllowed(url)).toThrow(SsrfBlockedError)
    expect(() => assertUrlAllowed(url)).toThrow(reason)
  })

  it.each([
    'http://example.com/',
    'https://example.com/path?q=1#frag',
    'https://example.com:443/',
    'http://example.com:80/',
    `http://${PUBLIC_V4}/`,
    `https://[${PUBLIC_V6}]/`,
  ])('allows %s', (url) => {
    expect(assertUrlAllowed(url).href).toBeTruthy()
  })
})

describe('resolveHost / validateUrl', () => {
  const resolver = fakeResolver({
    'example.com': [PUBLIC_V4, PUBLIC_V6],
    'evil.example': ['127.0.0.1'],
    'mixed.example': [PUBLIC_V4, '192.168.50.1'],
    'ula.example': ['fd00::5'],
    'mapped.example': ['::ffff:10.0.0.1'],
  })

  it('allows a name that resolves only to public addresses', async () => {
    await expect(resolveHost('example.com', resolver)).resolves.toHaveLength(2)
    await expect(validateUrl('https://example.com/a', resolver)).resolves.toBeInstanceOf(URL)
  })

  it('refuses a name resolving to 127.0.0.1', async () => {
    await expect(validateUrl('http://evil.example/', resolver)).rejects.toThrow(/blocked address 127\.0\.0\.1/)
  })

  it('refuses when ANY resolved address is internal', async () => {
    await expect(validateUrl('http://mixed.example/', resolver)).rejects.toThrow(SsrfBlockedError)
  })

  it('refuses names resolving to ULA or IPv4-mapped private IPv6', async () => {
    await expect(validateUrl('http://ula.example/', resolver)).rejects.toThrow(SsrfBlockedError)
    await expect(validateUrl('http://mapped.example/', resolver)).rejects.toThrow(SsrfBlockedError)
  })

  it('does not call the resolver for literal IPs', async () => {
    const spy = vi.fn(resolver)
    await expect(validateUrl('http://10.1.2.3/', spy)).rejects.toThrow(SsrfBlockedError)
    await expect(validateUrl(`http://${PUBLIC_V4}/`, spy)).resolves.toBeInstanceOf(URL)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('createGuardedLookup (connect-time check)', () => {
  type Cb = (err: NodeJS.ErrnoException | null, addrs: { address: string; family: number }[]) => void
  const base = (table: Record<string, string[]>) =>
    vi.fn((host: string, _opts: unknown, cb: Cb) => {
      cb(null, (table[host] ?? []).map((address) => ({ address, family: address.includes(':') ? 6 : 4 })))
    })

  function call(lookup: ReturnType<typeof createGuardedLookup>, host: string, opts: object) {
    return new Promise<unknown[]>((resolve) => {
      // biome-ignore lint/suspicious/noExplicitAny: exercising both callback shapes
      ;(lookup as any)(host, opts, (...args: unknown[]) => resolve(args))
    })
  }

  it('refuses a rebinding host that now resolves to an internal address', async () => {
    const lookup = createGuardedLookup(base({ 'rebind.example': ['192.168.50.1'] }))
    const [err] = await call(lookup, 'rebind.example', {})
    expect(err).toBeInstanceOf(SsrfBlockedError)
  })

  it('returns a single address when all=false', async () => {
    const lookup = createGuardedLookup(base({ 'example.com': [PUBLIC_V4] }))
    const [err, address, family] = await call(lookup, 'example.com', {})
    expect(err).toBeNull()
    expect(address).toBe(PUBLIC_V4)
    expect(family).toBe(4)
  })

  it('returns all addresses when all=true', async () => {
    const lookup = createGuardedLookup(base({ 'example.com': [PUBLIC_V4, PUBLIC_V6] }))
    const [err, addresses] = await call(lookup, 'example.com', { all: true })
    expect(err).toBeNull()
    expect(addresses).toHaveLength(2)
  })

  it('fails with ENOTFOUND on an empty answer', async () => {
    const lookup = createGuardedLookup(base({}))
    const [err] = await call(lookup, 'nothing.example', {})
    expect((err as NodeJS.ErrnoException).code).toBe('ENOTFOUND')
  })
})

describe('safeFetch', () => {
  let restore: (() => void) | undefined
  afterEach(() => {
    restore?.()
    restore = undefined
  })

  const resolver = fakeResolver({
    'example.com': [PUBLIC_V4],
    'other.example': [PUBLIC_V4],
    'evil.example': ['127.0.0.1'],
  })

  function redirect(location: string, status = 302) {
    return new Response(null, { status, headers: { location } })
  }

  it('fetches an allowed public URL with manual redirect handling', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('ok', { status: 200 }))
    restore = configureSafeFetch({ fetch: fetchImpl, resolve: resolver })
    const { response, url } = await safeFetch('https://example.com/')
    expect(response.status).toBe(200)
    expect(url).toBe('https://example.com/')
    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/', expect.objectContaining({ redirect: 'manual' }))
  })

  it('follows a redirect to another public URL', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(redirect('https://other.example/next'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    restore = configureSafeFetch({ fetch: fetchImpl, resolve: resolver })
    const { url } = await safeFetch('https://example.com/')
    expect(url).toBe('https://other.example/next')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it.each([
    'http://192.168.50.1/',
    'http://127.0.0.1:80/',
    'http://[::1]/',
    'http://evil.example/',
    'http://2130706433/',
    'file:///etc/passwd',
  ])('refuses a public URL that redirects to %s', async (target) => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(redirect(target))
    restore = configureSafeFetch({ fetch: fetchImpl, resolve: resolver })
    await expect(safeFetch('https://example.com/')).rejects.toThrow(SsrfBlockedError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('refuses a relative redirect that keeps the host but changes the port', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(redirect('//example.com:8080/'))
    restore = configureSafeFetch({ fetch: fetchImpl, resolve: resolver })
    await expect(safeFetch('https://example.com/')).rejects.toThrow(/port/)
  })

  it('stops after too many redirects', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => redirect('https://example.com/loop'))
    restore = configureSafeFetch({ fetch: fetchImpl, resolve: resolver })
    await expect(safeFetch('https://example.com/')).rejects.toThrow(/too many redirects/)
    expect(fetchImpl).toHaveBeenCalledTimes(6)
  })

  it('keeps HEAD across a 303 (no body to fetch)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(redirect('https://other.example/', 303))
      .mockResolvedValueOnce(new Response('ok'))
    restore = configureSafeFetch({ fetch: fetchImpl, resolve: resolver })
    await safeFetch('https://example.com/', { method: 'HEAD' })
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://other.example/', expect.objectContaining({ method: 'HEAD' }))
  })

  it('never fetches an internal URL directly', async () => {
    const fetchImpl = vi.fn()
    restore = configureSafeFetch({ fetch: fetchImpl, resolve: resolver })
    await expect(safeFetch('http://127.0.0.1:3000/')).rejects.toThrow(SsrfBlockedError)
    await expect(safeFetch('http://evil.example/')).rejects.toThrow(SsrfBlockedError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('re-checks DNS at connect time (DNS rebinding)', async () => {
    // Pre-flight resolver says public; the resolution used for the socket says loopback.
    restore = configureSafeFetch({ resolve: fakeResolver({ 'rebind.test': [PUBLIC_V4] }) })
    const spy = vi.spyOn(dns, 'lookup').mockImplementation(((_h: string, _o: unknown, cb: (e: null, a: dns.LookupAddress[]) => void) =>
      cb(null, [{ address: '127.0.0.1', family: 4 }])) as never)
    try {
      const err = await safeFetch('http://rebind.test/').catch((e) => e)
      expect(err).toBeInstanceOf(Error)
      expect(err.cause).toBeInstanceOf(SsrfBlockedError)
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('refuses a real loopback server end to end (real fetch, real DNS)', async () => {
    const server = http.createServer((_req, res) => res.end('internal secret'))
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
    const { port } = server.address() as AddressInfo
    try {
      await expect(safeFetch(`http://127.0.0.1:${port}/`)).rejects.toThrow(SsrfBlockedError)
      await expect(safeFetch('http://localhost/')).rejects.toThrow(SsrfBlockedError)
    } finally {
      server.close()
    }
  })
})
